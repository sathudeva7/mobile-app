/**
 * Knowledge Base Service
 * 
 * Connects the admin portal's knowledge base to the AI Coach.
 * 
 * Flow:
 *   Admin adds entry in portal
 *     → saved to Firestore (ai_knowledge collection)
 *     → aiCoach.js fetches active entries at runtime
 *     → injected into every AI prompt automatically
 * 
 * Admin can also:
 *   - Edit the master system prompt (ai_config/system_prompt)
 *   - Control AI behavior toggles (ai_config/behavior)
 *   - Sync teachings from video transcripts
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.client';

// ─── Collection names ─────────────────────────────────────────────
export const KB_COLLECTION     = 'ai_knowledge';      // individual entries
export const CONFIG_COLLECTION = 'ai_config';         // system prompt + settings

// ─── Fetch all ACTIVE knowledge entries ──────────────────────────
// Called by aiCoach.js before every prompt build
export async function fetchActiveKnowledge() {
  if (!db) return [];
  try {
    const q    = query(
      collection(db, KB_COLLECTION),
      where('status', '==', 'active'),
      orderBy('priority', 'desc'),  // higher priority entries appear first
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('fetchActiveKnowledge:', e);
    return [];
  }
}

// ─── Fetch knowledge relevant to a specific topic ────────────────
// More targeted — used when user's question matches a topic
export async function fetchKnowledgeByTopic(topic) {
  if (!db) return [];
  try {
    const q    = query(
      collection(db, KB_COLLECTION),
      where('status', '==', 'active'),
      where('keywords', 'array-contains', topic.toLowerCase())
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('fetchKnowledgeByTopic:', e);
    return [];
  }
}

// ─── Fetch knowledge for a specific personality type ─────────────
export async function fetchKnowledgeForType(personalityType) {
  if (!db) return [];
  try {
    // Get entries that apply to all types OR this specific type
    const allQ  = query(
      collection(db, KB_COLLECTION),
      where('status', '==', 'active'),
      where('types', '==', [])  // empty array = applies to all
    );
    const typeQ = query(
      collection(db, KB_COLLECTION),
      where('status', '==', 'active'),
      where('types', 'array-contains', personalityType)
    );

    const [allSnap, typeSnap] = await Promise.all([getDocs(allQ), getDocs(typeQ)]);

    const allEntries  = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const typeEntries = typeSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Merge and deduplicate
    const seen = new Set();
    return [...typeEntries, ...allEntries].filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  } catch (e) {
    console.error('fetchKnowledgeForType:', e);
    return [];
  }
}

// ─── Format knowledge entries for injection into AI prompt ───────
export function formatKnowledgeForPrompt(entries) {
  if (!entries.length) return '';

  const grouped = {};
  for (const entry of entries) {
    const cat = entry.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(entry);
  }

  let formatted = '\n\n## RIVNITZ TEACHINGS & GUIDELINES\n';
  formatted += '(Drawn from Rabbi Landau\'s knowledge base — use these to ground your responses)\n\n';

  for (const [category, items] of Object.entries(grouped)) {
    formatted += `### ${category}\n`;
    for (const item of items) {
      formatted += `**${item.title}**\n${item.content}\n\n`;
    }
  }

  return formatted;
}

// ─── Fetch the master system prompt from Firestore ───────────────
export async function fetchSystemPrompt() {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, CONFIG_COLLECTION, 'system_prompt'));
    if (snap.exists()) return snap.data().content;
  } catch (e) {
    console.error('fetchSystemPrompt:', e);
  }
  return null; // fall back to default in aiCoach.js
}

// ─── Fetch AI behavior settings ───────────────────────────────────
export async function fetchAIBehaviorSettings() {
  if (!db) {
    return {
      personalizeByType:        true,
      referenceRabbiByName:     true,
      includeHebrewTerms:       true,
      askFollowUpQuestions:     true,
      recommendVideos:          true,
      encourageDirectAccess:    true,
      responseLength:           'balanced',
      tone:                     'warm-direct',
      openingStyle:             'feeling-first',
      escalationSensitivity:    3,
    };
  }
  try {
    const snap = await getDoc(doc(db, CONFIG_COLLECTION, 'behavior'));
    if (snap.exists()) return snap.data();
  } catch (e) {
    console.error('fetchAIBehaviorSettings:', e);
  }
  return {
    personalizeByType:        true,
    referenceRabbiByName:     true,
    includeHebrewTerms:       true,
    askFollowUpQuestions:     true,
    recommendVideos:          true,
    encourageDirectAccess:    true,
    responseLength:           'balanced',
    tone:                     'warm-direct',
    openingStyle:             'feeling-first',
    escalationSensitivity:    3,
  };
}

// ─── Add a new knowledge entry (called from admin portal) ─────────
export async function addKnowledgeEntry({
  title, category, content, source = 'Manual Entry',
  status = 'draft', keywords = [], types = [], priority = 1,
  sourceVideoId = null,
}) {
  const entry = {
    title, category, content, source, status,
    keywords: keywords.map(k => k.toLowerCase()),
    types,
    priority,
    sourceVideoId,
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp(),
  };
  const ref = await addDoc(collection(db, KB_COLLECTION), entry);
  return ref.id;
}

// ─── Update a knowledge entry ────────────────────────────────────
export async function updateKnowledgeEntry(id, updates) {
  await updateDoc(doc(db, KB_COLLECTION, id), {
    ...updates,
    keywords:  updates.keywords?.map(k => k.toLowerCase()) ?? undefined,
    updatedAt: serverTimestamp(),
  });
}

// ─── Delete a knowledge entry ─────────────────────────────────────
export async function deleteKnowledgeEntry(id) {
  await deleteDoc(doc(db, KB_COLLECTION, id));
}

// ─── Save master system prompt ────────────────────────────────────
export async function saveSystemPrompt(content) {
  await setDoc(doc(db, CONFIG_COLLECTION, 'system_prompt'), {
    content,
    updatedAt: serverTimestamp(),
  });
}

// ─── Save AI behavior settings ────────────────────────────────────
export async function saveAIBehaviorSettings(settings) {
  await setDoc(doc(db, CONFIG_COLLECTION, 'behavior'), {
    ...settings,
    updatedAt: serverTimestamp(),
  });
}

// ─── Extract teachings from a video transcript using AI ──────────
// Called when admin uploads a transcript in the sync tab
export async function extractTeachingsFromTranscript({ videoId, videoTitle, transcript, openai }) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: `You are helping build an AI knowledge base from Rabbi Landau's teachings.
Extract the key spiritual teachings, principles, and actionable insights from the provided transcript.

For each teaching, respond ONLY with a JSON array in this format:
[
  {
    "title": "Short headline for this teaching",
    "category": "One of: Core Teachings | Marriage & Relationships | Faith & Prayer | Anger & Emotions | Parenting | Purpose & Mission | Daily Life | AI Guidelines",
    "content": "The full teaching in 2-4 sentences. Write in third person: 'Rabbi Landau teaches that...'",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "priority": 1
  }
]

Extract 3-8 teachings. Be faithful to the Rabbi's actual words and intent.`,
      },
      {
        role: 'user',
        content: `Video: "${videoTitle}"\n\nTranscript:\n${transcript}`,
      },
    ],
    temperature: 0.3,
    max_tokens:  2000,
  });

  try {
    const text    = response.choices[0].message.content;
    const clean   = text.replace(/```json|```/g, '').trim();
    const entries = JSON.parse(clean);

    // Save all extracted entries as drafts
    const ids = await Promise.all(
      entries.map(entry =>
        addKnowledgeEntry({
          ...entry,
          source:        'From Video',
          status:        'draft',        // Admin must approve before going live
          sourceVideoId: videoId,
        })
      )
    );

    return { count: ids.length, ids };
  } catch (e) {
    console.error('extractTeachingsFromTranscript parse error:', e);
    throw new Error('Could not parse extracted teachings. Try again.');
  }
}

export default {
  fetchActiveKnowledge,
  fetchKnowledgeByTopic,
  fetchKnowledgeForType,
  formatKnowledgeForPrompt,
  fetchSystemPrompt,
  fetchAIBehaviorSettings,
  addKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  saveSystemPrompt,
  saveAIBehaviorSettings,
  extractTeachingsFromTranscript,
};
