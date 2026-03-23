/**
 * RAG Service — Retrieval Augmented Generation
 *
 * Retrieves relevant chunks from Rabbi's uploaded documents
 * based on the user's question, so the AI Coach can answer
 * grounded in actual teachings rather than generic LLM knowledge.
 *
 * Flow:
 *   1. Rewrite query to formal retrieval form (query expansion via GPT-4o-mini)
 *   2. Embed expanded query via OpenAI text-embedding-3-small
 *   3. Run topic-filtered AND global Pinecone queries in parallel
 *   4. Merge + deduplicate results by vector ID, keeping highest score
 *   5. Filter by similarity score threshold (MIN_SCORE = 0.50)
 *   6. Return top chunks { text, docTitle, score }
 *
 * Graceful degradation: any failure returns [] so the AI Coach
 * still works normally, just without document context.
 */

import OpenAI from 'openai';
import { openai as openaiConfig, pinecone as pineconeConfig, hasOpenAIConfig, hasPineconeConfig } from '../config';

const openai = openaiConfig.apiKey
  ? new OpenAI({ apiKey: openaiConfig.apiKey, dangerouslyAllowBrowser: true })
  : null;

// Normalise the Pinecone host — accept both formats:
//   "rivnitz-rag-xxx.svc.aped-xxx.pinecone.io"          (without protocol)
//   "https://rivnitz-rag-xxx.svc.aped-xxx.pinecone.io"  (with protocol)
function getPineconeBaseUrl() {
  const host = pineconeConfig.host || '';
  return host.startsWith('http') ? host.replace(/\/$/, '') : `https://${host}`;
}

// ─── Topic keyword map ────────────────────────────────────────────
const TOPIC_KEYWORDS = {
  shabbat:      ['shabbat', 'shabbos', 'sabbath', 'six days', 'שבת', 'candle lighting'],
  prayer:       ['prayer', 'pray', 'davening', 'tefillah', 'תפילה', 'bless', 'blessing', 'synagogue'],
  marriage:     ['marriage', 'married', 'spouse', 'wife', 'husband', 'shalom bayis', 'relationship', 'divorce', 'partner'],
  parenting:    ['children', 'child', 'kids', 'parenting', 'son', 'daughter', 'raise', 'family', 'teen'],
  emunah:       ['faith', 'emunah', 'believe', 'belief', 'trust in god', 'hashem', 'אמונה', 'doubt'],
  bitachon:     ['bitachon', 'anxiety', 'worry', 'stress', 'fear', 'nervous', 'panic', 'בטחון'],
  anger:        ['anger', 'angry', 'rage', 'frustration', 'temper', 'irritated', 'furious', 'lose it'],
  growth:       ['growth', 'improve', 'better myself', 'change', 'habit', 'discipline', 'middos', 'character'],
  'daily-life': ['daily', 'everyday', 'routine', 'morning', 'night', 'schedule', 'week'],
  zohar:        ['zohar', 'kabbalah', 'mystical', 'sefira', 'sefirot', 'soul', 'neshamah', 'spiritual worlds'],
  torah:        ['torah', 'parasha', 'parashah', 'learning', 'study', 'mitzvah', 'commandment', 'halacha', 'talmud'],
  teshuva:      ['teshuva', 'repentance', 'forgiveness', 'return', 'sin', 'regret', 'atone', 'atonement'],
};

// Minimum cosine similarity to include a chunk (0–1 scale).
// Raised from 0.40 → 0.50 to filter out weakly-related chunks.
const MIN_SCORE = 0.50;

// Maximum number of chunks returned to the caller.
const MAX_CHUNKS = 4;

// How many candidates to fetch from Pinecone per query.
// Raised from 6 → 18 so relevant chunks ranked lower still get a chance.
const TOP_K = 18;

// ─── Query rewriting ─────────────────────────────────────────────
// Converts a conversational user message into a formal retrieval query.
// Bridges the vocabulary gap between casual speech and formal religious documents.
// Example: "I feel so lost lately" →
//   "spiritual guidance for feeling lost, finding purpose, emunah, direction in life"
async function rewriteQueryForRetrieval(question) {
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a search query rewriter for a Jewish spiritual teaching database. ' +
            'Convert the user message into a concise retrieval query using relevant Torah and spiritual terms. ' +
            'Include Hebrew transliterations (emunah, bitachon, middos, teshuva, etc.) where appropriate. ' +
            'Return ONLY the query — no explanation, no quotes.',
        },
        { role: 'user', content: question },
      ],
      temperature: 0,
      max_tokens: 60,
    });
    return res.choices[0].message.content.trim() || question;
  } catch {
    // If rewrite fails, fall back to original question
    return question;
  }
}

// ─── Topic detection ──────────────────────────────────────────────
function detectTopics(question) {
  const lower = question.toLowerCase();
  const detected = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      detected.push(topic);
    }
  }
  return detected;
}

// ─── Pinecone query ───────────────────────────────────────────────
async function queryPinecone(vector, filter = null) {
  const body = {
    vector,
    topK: TOP_K,
    includeMetadata: true,
    ...(filter ? { filter } : {}),
  };

  try {
    const url = `${getPineconeBaseUrl()}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Api-Key': pineconeConfig.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[ragService] Pinecone query failed:', res.status, errText);
      return [];
    }

    const data = await res.json();
    return data.matches || [];
  } catch (err) {
    console.warn('[ragService] Pinecone fetch error:', err.message);
    return [];
  }
}

// ─── Merge + deduplicate matches ──────────────────────────────────
// When running multiple queries in parallel, the same vector can appear
// in both results. Keep the highest score for each unique vector ID.
function mergeMatches(resultsArray) {
  const seen = new Map();
  for (const matches of resultsArray) {
    for (const m of matches) {
      if (!seen.has(m.id) || m.score > seen.get(m.id).score) {
        seen.set(m.id, m);
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

// ─── Format matches ───────────────────────────────────────────────
function formatMatches(matches) {
  return matches
    .filter((m) => (m.score ?? 0) >= MIN_SCORE)
    .slice(0, MAX_CHUNKS)
    .map((m) => ({
      text:     m.metadata?.text     || '',
      docTitle: m.metadata?.docTitle || 'Teaching',
      score:    m.score,
    }))
    .filter((c) => c.text.length > 30);
}

// ─── Public API ───────────────────────────────────────────────────
export async function retrieveRelevantChunks(question) {
  if (!hasOpenAIConfig() || !openai) return [];
  if (!hasPineconeConfig()) return [];
  if (!question?.trim()) return [];

  try {
    // 1. Rewrite the conversational question into a formal retrieval query
    const expandedQuery = await rewriteQueryForRetrieval(question);
    console.log(`[ragService] Expanded query: "${expandedQuery}"`);

    // 2. Embed the expanded query
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: expandedQuery,
    });
    const queryVector = embeddingRes.data[0].embedding;

    // 3. Run global query + topic-filtered query in parallel.
    //    Global always runs — topic filter is additive, not a replacement.
    const topics = detectTopics(question);
    const queryPromises = [queryPinecone(queryVector)]; // always run global
    if (topics.length > 0) {
      queryPromises.push(queryPinecone(queryVector, { topics: { '$in': topics } }));
      console.log(`[ragService] Also running topic-filtered query for: [${topics.join(', ')}]`);
    }
    const results = await Promise.all(queryPromises);

    // 4. Merge + deduplicate by vector ID, sort by score descending
    const merged = mergeMatches(results);

    // Log top raw scores so we can tune MIN_SCORE
    const topScores = merged.slice(0, 4).map(m => `${m.score?.toFixed(3)}(${m.metadata?.docTitle?.slice(0,20)})`).join(', ');
    console.log(`[ragService] Top merged scores: [${topScores || 'none'}]`);

    const chunks = formatMatches(merged);

    if (chunks.length > 0) {
      console.log(`[ragService] Injecting ${chunks.length} chunks (score >= ${MIN_SCORE})`);
      chunks.forEach((c, i) => {
        console.log(`[ragService] Chunk ${i + 1} | score: ${c.score?.toFixed(3)} | doc: "${c.docTitle}" | text: "${c.text.slice(0, 120)}..."`);
      });
    } else {
      console.log(`[ragService] No chunks above MIN_SCORE=${MIN_SCORE} — answering without doc context`);
      merged.slice(0, 4).forEach((m, i) => {
        console.log(`  [${i + 1}] score: ${m.score?.toFixed(3)} | doc: "${m.metadata?.docTitle}" | text: "${String(m.metadata?.text || '').slice(0, 100)}..."`);
      });
    }

    return chunks;

  } catch (err) {
    // Never crash the AI Coach — RAG is an enhancement, not a dependency
    console.warn('[ragService] retrieveRelevantChunks error:', err.message);
    return [];
  }
}

export default { retrieveRelevantChunks };
