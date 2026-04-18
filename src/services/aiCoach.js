/**
 * AI Coach Service
 *
 * All AI logic (OpenAI, Pinecone) runs server-side via Firebase Cloud Functions.
 * This file is a thin client layer — it registers the callables and exports
 * the public API used by screens.
 *
 * Cloud Functions called:
 *   coachMessage               — main AI coaching reply (RAG + memory + GPT-4o)
 *   saveConversationMemory     — embed + upsert exchange to Pinecone
 *   processLifeContext         — extract personal facts from conversation
 *   generateDailyTasksOnDemand — on-demand daily task generation
 *   applyRabbiGuidance         — personalise Rabbi's answer for the user
 *   assessmentChat             — onboarding AI assessment conversation
 *   triTypeChat                — Nature Quiz MCQ flow
 *   photoReading               — face/palm Kabbalistic reading (GPT-4o vision)
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebase.client';
import app from './firebase.client';

const firebaseFunctions = getFunctions(app);

// ─── Cloud Function callables ─────────────────────────────────────
const _coachMessageFn               = httpsCallable(firebaseFunctions, 'coachMessage',               { timeout: 60000 });
const _saveConversationMemoryFn     = httpsCallable(firebaseFunctions, 'saveConversationMemory');
const _processLifeContextFn         = httpsCallable(firebaseFunctions, 'processLifeContext');
const _generateDailyTasksOnDemandFn = httpsCallable(firebaseFunctions, 'generateDailyTasksOnDemand', { timeout: 60000 });
const _applyRabbiGuidanceFn         = httpsCallable(firebaseFunctions, 'applyRabbiGuidance',         { timeout: 60000 });
const _assessmentChatFn             = httpsCallable(firebaseFunctions, 'assessmentChat');
const _triTypeChatFn                = httpsCallable(firebaseFunctions, 'triTypeChat');
const _photoReadingFn               = httpsCallable(firebaseFunctions, 'photoReading',               { timeout: 60000 });

// ─── Send message to AI Coach ─────────────────────────────────────
// RAG retrieval, memory recall, prompt building, and OpenAI call all
// run inside the coachMessage Cloud Function.
export async function sendCoachMessage({ user, messages, newMessage }) {
  if (!db) {
    throw new Error('Database not configured. Add Firebase keys to .env');
  }
  try {
    const result = await _coachMessageFn({ user, messages, newMessage });
    const { reply, escalated } = result.data;

    // Fire-and-forget — embed + save exchange to Pinecone memory server-side.
    _saveConversationMemoryFn({ userId: user.uid, userMsg: newMessage, aiReply: reply })
      .catch(() => {});

    return { reply, escalated };
  } catch (error) {
    console.error('AI Coach error:', error);
    throw error;
  }
}

// ─── AI Assessment (onboarding step 2) ───────────────────────────
export async function sendAssessmentMessage({ messages, newMessage, tritype, isCounterphobic = false }) {
  const result = await _assessmentChatFn({ messages, newMessage, tritype, isCounterphobic });
  return result.data; // { reply, completed, result }
}

// ─── Nature Quiz (Tri-Type MCQ) ───────────────────────────────────
// User's selection is already appended to messages before calling.
export async function sendTriTypeMessage({ messages }) {
  const result = await _triTypeChatFn({ messages });
  return result.data; // { question, options, completed, result }
}

// ─── Photo Reading (face / right hand / left hand) ───────────────
export async function analyzePhoto({ type, base64, tritype, isCounterphobic = false }) {
  if (!base64) {
    throw new Error('No image data received. Please try taking the photo again.');
  }
  const result = await _photoReadingFn({ type, base64, tritype, isCounterphobic });
  return result.data.insight;
}

// ─── Apply Rabbi's guidance to an escalated question ─────────────
export async function applyRabbiGuidance({ escalationId, rabbiGuidance }) {
  const result = await _applyRabbiGuidanceFn({ escalationId, rabbiGuidance });
  return result.data.response;
}

// ─── Life context memory (called after every AI reply) ────────────
// Detects personal info shared + extracts structured facts server-side.
export async function processLifeMemory(uid, userMsg, aiReply, messages) {
  _processLifeContextFn({ uid, userMsg, aiReply, messages }).catch(() => {});
}

// ─── Daily task generation (on-demand fallback) ───────────────────
// Used by GrowthScreen when no pre-generated tasks exist for today.
// The scheduled generateDailyTasksForAllUsers handles most users at 6 AM UTC.
export async function generateDailyTasks(user) {
  const result = await _generateDailyTasksOnDemandFn({ user });
  return result.data; // { tasks, motivation }
}

export default {
  sendCoachMessage,
  sendAssessmentMessage,
  sendTriTypeMessage,
  analyzePhoto,
  applyRabbiGuidance,
  processLifeMemory,
  generateDailyTasks,
};
