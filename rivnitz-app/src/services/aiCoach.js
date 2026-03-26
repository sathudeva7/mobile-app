/**
 * AI Coach Service
 * The core of the Rivnitz personalization engine.
 *
 * - Builds system prompts based on user personality type
 * - Handles the nature discovery quiz conversation
 * - Flags uncertain questions for Rabbi review (escalation)
 * - All responses grounded in Rivnitz/Rovnitz teachings
 */

import OpenAI from 'openai';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import {
  fetchKnowledgeForType,
  fetchSystemPrompt,
  fetchAIBehaviorSettings,
  formatKnowledgeForPrompt,
} from './knowledgeBase';
import { OPENAI_API_KEY, OPENAI_MODEL } from '@env';
import { getTriTypeByCode } from '../data/triTypes';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
});
const MODEL  = OPENAI_MODEL || 'gpt-4-turbo-preview';

// ─── Base System Prompt ───────────────────────────────────────────
const BASE_SYSTEM_PROMPT = `
You are the Rivnitz AI Coach — a deeply personalized spiritual and life coaching assistant 
built on the teachings of the Rivnitzer Rebbe and guided by Rabbi Landau.

Your role is to be a trusted personal coach who knows each person deeply — their nature, 
their struggles, their strengths — and responds with wisdom, warmth, and precision.

Core principles you always follow:
1. Every person has a unique nature (teva) — always speak to THEIR specific type, never generically
2. Ground all guidance in Rivnitz/Rovnitz teachings and Torah wisdom
3. Be warm but honest — don't just validate, guide toward growth
4. When uncertain, it's better to ask a clarifying question than give the wrong answer
5. You are NOT a replacement for the Rabbi — always encourage direct connection with Rabbi Landau
6. Keep responses concise and meaningful — no padding or filler
7. Sometimes the deepest answer is a question back to the person

Topics you can help with:
- Marriage and relationships (shalom bayis)
- Parenting and family
- Personal growth and character (middos)
- Faith, prayer, and spiritual practice
- Work, parnassah, and purpose
- Anger, anxiety, and emotional regulation
- Daily habits and discipline
`;

// ─── Build personalized system prompt (with live knowledge base) ─
// Fetches the master system prompt AND knowledge entries from Firestore
// so admin changes in the portal take effect immediately.
export async function buildPersonalizedPrompt(user) {
  // 1. Fetch master system prompt from Firestore (admin can edit this live)
  //    Falls back to BASE_SYSTEM_PROMPT if not set yet
  const masterPrompt = (await fetchSystemPrompt()) || BASE_SYSTEM_PROMPT;

  // 2. Fetch knowledge entries relevant to this user's personality type
  const knowledgeEntries = user?.personalityType
    ? await fetchKnowledgeForType(user.personalityType)
    : [];
  const knowledgeBlock = formatKnowledgeForPrompt(knowledgeEntries);

  // 3. Fetch behavior settings (tone, response length, toggles)
  const behavior = await fetchAIBehaviorSettings();

  // 4. Build user-specific personality section from tri-type data
  const triType = user?.triType ? getTriTypeByCode(user.triType) : null;
  const personalityBlock = triType
    ? `
## THIS USER'S NATURE (Tri-Type Profile)
Name:             ${user.displayName || 'Friend'}
Personality Type: ${triType.name} (${triType.hebrewName})
Tri-Type:         ${triType.triType}
MBTI:             ${user.mbtiType || 'not yet determined'}
Enneagram:        ${user.enneagramType || 'not yet determined'}
Head Center:      Type ${triType.headType} (${triType.headSephira})
Heart Center:     Type ${triType.heartType} (${triType.heartSephira})
Gut Center:       Type ${triType.gutType} (${triType.gutSephira})

LIFE MISSION: ${triType.lifeMission}

ARCHETYPE: ${triType.archetype}

CORE FEARS (be sensitive to these): ${triType.coreFears}

BLIND SPOT (gently guide them here): ${triType.blindSpot}
`
    : user?.personalityType
    ? `
## THIS USER'S NATURE
Name:             ${user.displayName || 'Friend'}
Personality Type: ${user.personalityType}
MBTI:             ${user.mbtiType || 'not yet determined'}
Enneagram:        ${user.enneagramType || 'not yet determined'}
`
    : '';

  // 5. Build behavior instructions from admin settings
  const behaviorBlock = `
## RESPONSE BEHAVIOR (set by admin)
- Length: ${behavior.responseLength || 'balanced'}
- Tone: ${behavior.tone || 'warm-direct'}
- Opening: ${behavior.openingStyle || 'feeling-first'}
- Personalize by type: ${behavior.personalizeByType ? 'yes' : 'no'}
- Reference Rabbi by name: ${behavior.referenceRabbiByName ? 'yes' : 'no'}
- Use Hebrew terms naturally: ${behavior.includeHebrewTerms ? 'yes' : 'no'}
- Ask follow-up questions when helpful: ${behavior.askFollowUpQuestions ? 'yes' : 'no'}
- Recommend relevant videos: ${behavior.recommendVideos ? 'yes' : 'no'}
- Encourage direct access to Rabbi: ${behavior.encourageDirectAccess ? 'yes' : 'no'}
`;

  // 6. Assemble full prompt
  //    Replace {KNOWLEDGE_BASE} placeholder if present in master prompt
  let fullPrompt = masterPrompt
    .replace('{KNOWLEDGE_BASE}', knowledgeBlock)
    .replace('{user.displayName}',   user?.displayName || 'Friend')
    .replace('{user.personalityType}', user?.personalityType || 'not yet determined')
    .replace('{user.mbtiType}',      user?.mbtiType || 'not yet determined')
    .replace('{user.enneagramType}', user?.enneagramType || 'not yet determined')
    .replace('{user.humanDesignType}', user?.humanDesignType || 'not yet determined');

  // Append sections not already in master prompt
  if (!fullPrompt.includes('THIS USER\'S NATURE')) {
    fullPrompt += personalityBlock;
  }
  if (!fullPrompt.includes('RESPONSE BEHAVIOR')) {
    fullPrompt += behaviorBlock;
  }
  if (!fullPrompt.includes('RIVNITZ TEACHINGS') && knowledgeBlock) {
    fullPrompt += knowledgeBlock;
  }

  return fullPrompt;
}

// ─── Send message to AI Coach ─────────────────────────────────────
export async function sendCoachMessage({ user, messages, newMessage }) {
  try {
    // Builds prompt with live knowledge base + system prompt from Firestore
    const systemPrompt = await buildPersonalizedPrompt(user);

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: newMessage },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply         = response.choices[0].message.content;
    const shouldEscalate = checkShouldEscalate(reply, newMessage);

    // Save to Firestore
    const sessionRef = collection(db, COLLECTIONS.AI_SESSIONS);
    await addDoc(sessionRef, {
      userId:    user.uid,
      userMsg:   newMessage,
      aiReply:   reply,
      escalated: shouldEscalate,
      createdAt: serverTimestamp(),
    });

    // If escalated, add to escalation queue for Rabbi review
    if (shouldEscalate) {
      await escalateQuestion({ user, question: newMessage, aiAttempt: reply });
    }

    return { reply, escalated: shouldEscalate };
  } catch (error) {
    console.error('AI Coach error:', error);
    throw error;
  }
}

// ─── Check if question needs escalation ──────────────────────────
// Escalate if: AI is uncertain, question is highly sensitive,
// or involves halachic rulings
function checkShouldEscalate(aiReply, userMessage) {
  const escalationTriggers = [
    'i\'m not certain',
    'i\'m not sure',
    'this is a complex',
    'rabbi should',
    'speak with a rabbi',
    'beyond my guidance',
    'halachic question',
    'i would recommend consulting',
  ];

  const replyLower = aiReply.toLowerCase();
  return escalationTriggers.some(trigger => replyLower.includes(trigger));
}

// ─── Escalate question to admin queue ────────────────────────────
async function escalateQuestion({ user, question, aiAttempt }) {
  await addDoc(collection(db, COLLECTIONS.AI_ESCALATIONS), {
    userId:          user.uid,
    userName:        user.displayName,
    personalityType: user.personalityType,
    mbtiType:        user.mbtiType,
    enneagramType:   user.enneagramType,
    question,
    aiAttempt,
    adminGuidance:   null,   // Rabbi fills this in via admin portal
    status:          'pending', // pending | answered
    createdAt:       serverTimestamp(),
  });
}

// ─── Apply Rabbi's guidance to escalated question ─────────────────
export async function applyRabbiGuidance({ escalationId, rabbiGuidance, user }) {
  // Get the escalation
  const escalationRef = doc(db, COLLECTIONS.AI_ESCALATIONS, escalationId);
  await updateDoc(escalationRef, {
    adminGuidance: rabbiGuidance,
    status:        'answered',
    answeredAt:    serverTimestamp(),
  });

  // Now generate personalized response using Rabbi's guidance
  const systemPrompt = buildPersonalizedPrompt(user);
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'system',
        content: `The Rabbi has provided the following guidance on this question: "${rabbiGuidance}". 
        Use this as the core of your response, but expand it and personalize it for this specific person's 
        nature and situation. Do not quote the Rabbi's guidance verbatim — integrate it naturally.`,
      },
    ],
    temperature: 0.6,
    max_tokens: 400,
  });

  return response.choices[0].message.content;
}

// sendQuizMessage is no longer used — quiz is now MCQ-based (local scoring)
// Kept for backward compatibility
export async function sendQuizMessage({ messages, newMessage }) {
  return { reply: 'Quiz is now MCQ-based. Please use the assessment screen.', completed: false, result: null };
}

export default {
  sendCoachMessage,
  sendQuizMessage,
  applyRabbiGuidance,
  buildPersonalizedPrompt,
};
