/**
 * Rivnitz Firebase Cloud Functions
 *
 * notifyLiveSessionStarted
 *   Triggers when a live_sessions document is written.
 *   When status changes to 'live', fetches all registered
 *   Expo push tokens from the users collection and sends
 *   a push notification to every device.
 *
 * generateDailyTasksForAllUsers
 *   Scheduled function — runs every day at 6:00 AM UTC.
 *   Iterates all users and pre-generates personalized daily tasks
 *   via OpenAI so tasks are ready when users open the app.
 *   Skips users who already have tasks for today.
 *   Requires OPENAI_API_KEY set via: firebase functions:secrets:set OPENAI_API_KEY
 *
 * renewYoutubeSubscription
 *   Scheduled function — runs every Monday at 00:00 UTC (weekly).
 *   Renews the PubSubHubbub subscription to the Rabbi's YouTube channel
 *   so new videos are automatically pushed to the app.
 *   YouTube subscriptions expire after 10 days — weekly renewal keeps it alive.
 *   Set env vars in functions/.env:
 *     YOUTUBE_CHANNEL_ID=UCxxxxxxxx
 *     YOUTUBE_ADMIN_URL=https://your-admin-site.netlify.app
 */

const { onDocumentWritten }            = require('firebase-functions/v2/firestore');
const { onSchedule }                   = require('firebase-functions/v2/scheduler');
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret }                 = require('firebase-functions/params');
const { initializeApp }                = require('firebase-admin/app');
const { getFirestore, FieldValue }     = require('firebase-admin/firestore');
const { getAuth }                      = require('firebase-admin/auth');

const { defineString } = require('firebase-functions/params');

const OPENAI_API_KEY    = defineSecret('OPENAI_API_KEY');
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const PINECONE_API_KEY  = defineSecret('PINECONE_API_KEY');

// Non-secret config — add to functions/.env:
//   PINECONE_HOST=rivnitz-rag-xxx.svc.aped-xxx.pinecone.io
const PINECONE_HOST = defineString('PINECONE_HOST', { default: '' });

// Non-secret config — add to functions/.env file:
//   YOUTUBE_CHANNEL_ID=UCxxxxxxxx
//   YOUTUBE_ADMIN_URL=https://your-admin-site.netlify.app
const YOUTUBE_CHANNEL_ID = defineString('YOUTUBE_CHANNEL_ID', { default: '' });
const YOUTUBE_ADMIN_URL  = defineString('YOUTUBE_ADMIN_URL',  { default: '' });

initializeApp();

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE    = 100; // Expo push API limit per request

// ─── createPaymentIntent ─────────────────────────────────────────
// HTTPS endpoint called from the mobile app before presenting Stripe payment sheet.
// invoker: 'public' allows the request through Cloud Run IAM;
// we verify the Firebase ID token manually inside.
// Requires STRIPE_SECRET_KEY: firebase functions:secrets:set STRIPE_SECRET_KEY
exports.createPaymentIntent = onRequest(
  { secrets: [STRIPE_SECRET_KEY], invoker: 'public', cors: true },
  async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
      res.status(405).json({ error: { message: 'Method not allowed' } });
      return;
    }

    // Verify Firebase ID token from Authorization header
    const authHeader = req.headers.authorization || '';
    const idToken    = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!idToken) {
      res.status(401).json({ error: { message: 'Missing auth token' } });
      return;
    }

    let uid;
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (e) {
      res.status(401).json({ error: { message: 'Invalid auth token' } });
      return;
    }

    const { amount, currency = 'usd', donationType } = req.body?.data || {};

    if (!amount || typeof amount !== 'number' || amount < 50) {
      res.status(400).json({ error: { message: 'Amount must be at least $0.50' } });
      return;
    }

    const secretKey = STRIPE_SECRET_KEY.value();
    if (!secretKey) {
      res.status(500).json({ error: { message: 'Stripe is not configured' } });
      return;
    }

    const body = new URLSearchParams({
      amount:   String(Math.round(amount)),
      currency,
      'automatic_payment_methods[enabled]': 'true',
      'metadata[donationType]': donationType || 'general',
      'metadata[userId]':       uid,
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await stripeRes.json();

    if (data.error) {
      console.error('Stripe error:', data.error);
      res.status(500).json({ error: { message: data.error.message || 'Stripe error' } });
      return;
    }

    res.status(200).json({ result: { clientSecret: data.client_secret, paymentIntentId: data.id } });
  }
);

// ─── buildAssessmentSystemPrompt ────────────────────────────────────
// Mirrors the same function in aiCoach.js — kept server-side so the full
// prompt and OpenAI key never ship in the mobile bundle.
function buildAssessmentSystemPrompt(tritype, isCounterphobic) {
  if (!tritype) {
    return `You are the Rivnitz Soul Guide completing a deep spiritual profile.
Determine through warm conversation: 1) Enneagram type + wing (e.g. 4w5), 2) MBTI type (e.g. INFJ), 3) Date of birth for Zodiac.
Open with: "There are a few more things I'd like to understand before building your complete profile..."
Ask ONE question at a time. After 8-12 exchanges output:
RESULT: {"enneagramType":"4w5","mbtiType":"INFJ","dateOfBirth":"1990-11-15","zodiacSign":"Scorpio","summary":"One sentence about their nature."}`;
  }

  const cpNote = isCounterphobic && tritype.headType === 6
    ? ' They are counter-phobic — they move toward their fears rather than away from them.'
    : '';

  return `You are the Rivnitz Soul Guide completing a deep spiritual profile.

This person just completed their Nature Discovery Quiz. Here is what we know:
• Tri-Type: ${tritype.code} — the ${tritype.englishName} (${tritype.hebrewName})
• Life Mission: ${tritype.lifeMissionEn}
• Head center: Type ${tritype.headType} (${tritype.headSephira}) — ${tritype.headType === 5 ? 'The Observer: seeks knowledge and depth' : tritype.headType === 6 ? 'The Loyalist: seeks security and guidance' : 'The Enthusiast: seeks joy and possibility'}
• Heart center: Type ${tritype.heartType} (${tritype.heartSephira}) — ${tritype.heartType === 2 ? 'The Helper: driven by connection and giving' : tritype.heartType === 3 ? 'The Achiever: driven by success and image' : 'The Individualist: driven by authenticity and depth'}
• Gut center: Type ${tritype.gutType} (${tritype.gutSephira}) — ${tritype.gutType === 1 ? 'The Reformer: driven by integrity and improvement' : tritype.gutType === 8 ? 'The Challenger: driven by strength and protection' : 'The Peacemaker: driven by harmony and acceptance'}${cpNote}
• Core fears: ${tritype.coreFears}

Your job now is to gather 3 more pieces through warm, natural conversation — in this order:

PHASE 1 — ENNEAGRAM TYPE + WING
Determine their single primary Enneagram type (1-9) and wing (e.g. 4w5).
Their tri-type already reveals a lot — use it as strong context.
The primary type is usually the one they identify with most strongly across all situations.
Ask 2-3 targeted questions to confirm and identify the specific wing.

PHASE 2 — MBTI
Determine their 4-letter Myers-Briggs type (e.g. INFJ, ENFP).
Ask 2-3 questions covering: how they direct energy (Introvert/Extravert), how they process information (iNtuitive/Sensing), how they make decisions (Feeling/Thinking), how they approach life (Judging/Perceiving).

PHASE 3 — DATE OF BIRTH
Simply ask for their date of birth. You will use it to determine their Zodiac sign.

Rules:
- Open with: "There are a few more things I'd like to understand before I can build your complete profile..."
- Ask ONE question at a time — never two questions in one message
- Be warm, personal and conversational — this is a sacred discovery process, not a clinical test
- Reference what you already know about them from the tri-type to make questions feel personal
- Build each question naturally on their previous answer
- After 8-12 exchanges you should have all 3 pieces
- When you have determined all 3, output ONLY valid JSON in exactly this format on its own line:
RESULT: {"enneagramType":"4w5","mbtiType":"INFJ","dateOfBirth":"1990-11-15","zodiacSign":"Scorpio","summary":"One sentence capturing their complete spiritual nature across all systems."}`;
}

// ─── triTypeChat ─────────────────────────────────────────────────────
// Callable function used by NatureQuizScreen.
// Runs the MCQ-style Tri-Type soul discovery quiz server-side.
// Returns { question, options, completed, result }.

const TRITYPE_SYSTEM_PROMPT = `You are the Rivnitz Soul Guide — a warm, spiritually-grounded guide helping someone discover their soul nature through a quiz.

Your goal is to determine their dominant Enneagram type in each of three centers:
HEAD CENTER — Type 5 (Observer), 6 (Loyalist), or 7 (Enthusiast)
HEART CENTER — Type 2 (Helper), 3 (Achiever), or 4 (Individualist)
GUT CENTER — Type 1 (Reformer), 8 (Challenger), or 9 (Peacemaker)

YOU MUST ALWAYS respond in EXACTLY this format — no exceptions, no extra text before or after:
QUESTION: [A warm, situational question about real behaviour or experience]
A) [First option]
B) [Second option]
C) [Third option]

RULES:
- ONE question at a time with exactly THREE options labelled A), B), C)
- Questions must be about real situations and feelings — warm and personal, never clinical
- Options must be distinct behavioural descriptions that feel equally valid — never make one seem "better"
- NEVER mention Enneagram, type numbers, or psychological terms in questions or options
- Adapt each new question based on all previous answers to zero in on the types
- Cover all three centers across 8–12 questions total
- If head type appears to be 6, include one question to detect phobic (moves away from fear) vs counter-phobic (moves toward fear, becomes more intense)
- When you are confident about all three centers, output ONLY the following line — nothing else:
RESULT: {"headType":5,"heartType":2,"gutType":1,"isCounterphobic":false}

Valid values: headType = 5, 6, or 7 | heartType = 2, 3, or 4 | gutType = 1, 8, or 9
isCounterphobic applies only when headType is 6, otherwise always false.`;

function parseMCQResponse(reply) {
  const qMatch = reply.match(/QUESTION:\s*([\s\S]+?)(?=\nA\))/);
  const aMatch = reply.match(/A\)\s*([\s\S]+?)(?=\nB\))/);
  const bMatch = reply.match(/B\)\s*([\s\S]+?)(?=\nC\))/);
  const cMatch = reply.match(/C\)\s*([\s\S]+?)$/);
  if (qMatch && aMatch && bMatch && cMatch) {
    return {
      question: qMatch[1].trim(),
      options: [aMatch[1].trim(), bMatch[1].trim(), cMatch[1].trim()],
    };
  }
  return { question: reply.trim(), options: [] };
}

exports.triTypeChat = onCall(
  { secrets: [OPENAI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { messages = [] } = request.data || {};

    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'OpenAI not configured on server');
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'gpt-4o',
        messages:    [
          { role: 'system', content: TRITYPE_SYSTEM_PROMPT },
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.8,
        max_tokens:  300,
      }),
    });

    const json = await res.json();

    if (json.error) {
      console.error('OpenAI error in triTypeChat:', json.error);
      throw new HttpsError('internal', json.error.message || 'OpenAI error');
    }

    const reply = json.choices?.[0]?.message?.content || '';

    // Check if the AI has determined all three centers
    const resultMatch = reply.match(/RESULT:\s*(\{[\s\S]*?\})/);
    if (resultMatch) {
      try {
        const result = JSON.parse(resultMatch[1]);
        return { question: null, options: [], completed: true, result };
      } catch (_) { /* fall through to MCQ parse */ }
    }

    // Parse MCQ format
    const qMatch = reply.match(/QUESTION:\s*([\s\S]+?)(?=\nA\))/);
    const aMatch = reply.match(/A\)\s*([\s\S]+?)(?=\nB\))/);
    const bMatch = reply.match(/B\)\s*([\s\S]+?)(?=\nC\))/);
    const cMatch = reply.match(/C\)\s*([\s\S]+?)$/);
    if (qMatch && aMatch && bMatch && cMatch) {
      return {
        question:  qMatch[1].trim(),
        options:   [aMatch[1].trim(), bMatch[1].trim(), cMatch[1].trim()],
        completed: false,
        result:    null,
      };
    }

    return { question: reply.trim(), options: [], completed: false, result: null };
  }
);

// ─── photoReading ─────────────────────────────────────────────────────
// Callable function used by PhotoReadingScreen (onboarding step 3).
// Receives base64 image + type (face/rightHand/leftHand) + tritype context.
// Runs GPT-4o vision server-side. Returns the insight string.

function buildPhotoReadingSystemPrompt(type, tritype, isCounterphobic) {
  let tritypeContext = '';
  if (tritype) {
    const cpNote = isCounterphobic && tritype.headType === 6
      ? ' They are counter-phobic — they move toward their fears rather than away from them.'
      : '';
    tritypeContext = `\n\nThis person's soul profile — Tri-Type ${tritype.code} (${tritype.englishName} / ${tritype.hebrewName}):
• Life Mission: ${tritype.lifeMissionEn}
• Core Fears: ${tritype.coreFears}
• Head center: Type ${tritype.headType} (${tritype.headSephira})
• Heart center: Type ${tritype.heartType} (${tritype.heartSephira})
• Gut center: Type ${tritype.gutType} (${tritype.gutSephira})${cpNote}`;
  }

  const baseInstructions = 'Respond in 3-4 sentences. Be personal and grounded in tradition — not clinical or generic. Speak directly to this soul as if you see them.';

  if (type === 'face') {
    return `You are a Kabbalistic face reader trained in the tradition of Chochmat HaPartzuf as taught in the Zohar and by the Arizal.
In this tradition, the face is a sacred map of the soul. Each feature corresponds to a Sephira: the forehead to Keter (divine will), the eyes to Chochmah and Binah (wisdom and understanding), the nose to Tiferet (harmony and truth), the mouth to Malchut (expression and manifestation), the ears to Chesed and Gevurah (expansion and boundary).${tritypeContext}

${baseInstructions} Root your reading in which Sephirot appear most prominent, what they reveal about this soul's divine nature, and one specific spiritual quality you see.`;
  }

  if (type === 'rightHand') {
    return `You are a Kabbalistic palm reader. The right hand is the vessel of Chesed — it represents the hand extended to the world, the soul's expressed spiritual gifts, divine generosity, and the energy one puts forth into creation.${tritypeContext}

${baseInstructions} Read the lines and shape of this right palm through the lens of Chesed. Speak to the gifts this soul brings to the world, their capacity for giving, and one clear spiritual strength visible here.`;
  }

  // leftHand
  return `You are a Kabbalistic palm reader. The left hand is the vessel of Gevurah — it represents the inner world, the soul's blueprint, hidden strengths, divine boundaries, and the depths that few ever see.${tritypeContext}

${baseInstructions} Read the lines and shape of this left palm through the lens of Gevurah. Speak to this soul's inner nature, their hidden depth and strength, and one soul quality that lives beneath the surface.`;
}

function buildPhotoUserPrompt(type) {
  if (type === 'face')      return 'What does my face reveal about my soul?';
  if (type === 'rightHand') return 'What does my right palm reveal about my gifts and spiritual path?';
  return 'What does my left palm reveal about my inner nature and soul depth?';
}

exports.photoReading = onCall(
  { secrets: [OPENAI_API_KEY], cors: true, memory: '512MiB', timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const {
      type            = 'face',
      base64          = '',
      tritype         = null,
      isCounterphobic = false,
    } = request.data || {};

    if (!base64) {
      throw new HttpsError('invalid-argument', 'No image data received');
    }

    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'OpenAI not configured on server');
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'gpt-4o',
        messages:    [
          { role: 'system', content: buildPhotoReadingSystemPrompt(type, tritype, isCounterphobic) },
          {
            role: 'user',
            content: [
              { type: 'text', text: buildPhotoUserPrompt(type) },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'auto' } },
            ],
          },
        ],
        temperature: 0.7,
        max_tokens:  500,
      }),
    });

    const json = await res.json();

    if (json.error) {
      console.error('OpenAI error in photoReading:', json.error);
      throw new HttpsError('internal', json.error.message || 'OpenAI error');
    }

    const insight = json.choices?.[0]?.message?.content?.trim() || '';
    return { insight };
  }
);

// ─── assessmentChat ──────────────────────────────────────────────────
// Callable function used by AIAssessmentScreen (onboarding step 2).
// Keeps OPENAI_API_KEY server-side; verifies Firebase auth before calling.
exports.assessmentChat = onCall(
  { secrets: [OPENAI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const {
      messages        = [],
      newMessage      = '',
      tritype         = null,
      isCounterphobic = false,
    } = request.data || {};

    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'OpenAI not configured on server');
    }

    const systemPrompt = buildAssessmentSystemPrompt(tritype, isCounterphobic);

    const apiMessages = newMessage === '__INIT__'
      ? [{ role: 'system', content: systemPrompt }]
      : [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: newMessage },
        ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'gpt-4o',
        messages:    apiMessages,
        temperature: 0.8,
        max_tokens:  350,
      }),
    });

    const json = await res.json();

    if (json.error) {
      console.error('OpenAI error in assessmentChat:', json.error);
      throw new HttpsError('internal', json.error.message || 'OpenAI error');
    }

    const reply = json.choices?.[0]?.message?.content || '';

    // Check if the AI has determined all personality systems
    const resultMatch = reply.match(/RESULT:\s*(\{[\s\S]*?\})/);
    if (resultMatch) {
      try {
        const result = JSON.parse(resultMatch[1]);
        return { reply: reply.replace(/RESULT:[\s\S]*/, '').trim(), completed: true, result };
      } catch (_) {
        // JSON parse failed — continue assessment
      }
    }

    return { reply, completed: false, result: null };
  }
);

exports.notifyLiveSessionStarted = onDocumentWritten(
  'live_sessions/{sessionId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after  = event.data?.after?.data();

    // Only fire when status transitions to 'live'
    if (after?.status !== 'live' || before?.status === 'live') return;

    const db = getFirestore();

    // Fetch all users who have a push token saved
    const usersSnap = await db.collection('users')
      .where('expoPushToken', '!=', null)
      .where('pushEnabled', '==', true)
      .get();

    const tokens = usersSnap.docs
      .map(d => d.data().expoPushToken)
      .filter(Boolean);

    if (tokens.length === 0) {
      console.log('No registered push tokens found.');
      return;
    }

    console.log(`Sending live notification to ${tokens.length} devices.`);

    // Build one Expo push message per token
    const messages = tokens.map(token => ({
      to:        token,
      channelId: 'live',
      title:     '📺 Rabbi Landau is Live Now!',
      body:      after.title || 'Join the live session with Rabbi Landau.',
      data:      { screen: 'Live' },
      sound:     'default',
      priority:  'high',
    }));

    // Send in batches of 100
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method:  'POST',
          headers: {
            'Content-Type':    'application/json',
            'Accept':          'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(batch),
        });

        const json = await res.json();
        console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} result:`, JSON.stringify(json));
      } catch (err) {
        console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err);
      }
    }
  }
);

// ─── Scheduled: Generate daily tasks for all users ───────────────
// Runs 6:00 AM UTC every day. Pre-generates AI tasks so users see
// their plan instantly when they open the app.
// Set the secret: firebase functions:secrets:set OPENAI_API_KEY
exports.generateDailyTasksForAllUsers = onSchedule(
  {
    schedule:  'every day 06:00',
    timeZone:  'UTC',
    secrets:   [OPENAI_API_KEY],
    timeoutSeconds: 540,  // 9 min — allows up to ~500 users
    memory:    '512MiB',
  },
  async () => {
    const db      = getFirestore();
    const today   = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const apiKey  = OPENAI_API_KEY.value();

    if (!apiKey) {
      console.error('OPENAI_API_KEY secret not set — aborting');
      return;
    }

    // Fetch all users in pages of 500
    let lastDoc    = null;
    let totalDone  = 0;
    let totalSkip  = 0;
    let totalFail  = 0;
    const PAGE_SIZE = 500;

    // Build a concise OpenAI prompt for a single user
    function buildPrompt(user) {
      const lifeCtx = (user.lifeContext || [])
        .slice(-10)
        .map(f => `- ${f.category}: ${f.fact}`)
        .join('\n') || 'No life context yet.';

      const tritypeBlock = user.tritypeCode
        ? `Tri-Type: ${user.tritypeCode} | Life Mission: ${user.lifeMissionEn || ''} | Core Fears: ${user.coreFears || ''}`
        : '';

      return `SOUL PROFILE:
- Name: ${user.displayName || 'Friend'}
- Soul Archetype: ${user.personalityType || 'Unknown'}
- Enneagram: ${user.enneagramType || 'Unknown'}
- MBTI: ${user.mbtiType || 'Unknown'}
${tritypeBlock ? `- ${tritypeBlock}` : ''}
- Current streak: ${user.streakCount || 0} days

TODAY'S CONTEXT:
- Date: ${today} (${dayName})

WHAT THIS PERSON HAS SHARED IN COACHING SESSIONS:
${lifeCtx}`;
    }

    const SYSTEM_PROMPT = `You are the Rivnitz Daily Growth Guide. Generate a personalized daily growth plan.
Return ONLY valid JSON in exactly this format:
{
  "motivation": "A single inspiring sentence (max 30 words) tailored to this person's soul type. Warm, personal, rooted in Rivnitz/Torah wisdom.",
  "tasks": [
    { "id": "1", "text": "Task description (max 10 words, action-oriented)", "category": "spiritual", "done": false },
    { "id": "2", "text": "Task description", "category": "health", "done": false },
    { "id": "3", "text": "Task description", "category": "mindset", "done": false },
    { "id": "4", "text": "Task description", "category": "relationship", "done": false },
    { "id": "5", "text": "Task description", "category": "spiritual", "done": false }
  ]
}
Categories: spiritual, health, mindset, relationship. Always return exactly 5 tasks. Never use generic tasks — personalize to this specific soul profile and life context.`;

    // Process one user: check if tasks exist, generate if not, save
    async function processUser(userDoc) {
      const uid  = userDoc.id;
      const user = userDoc.data();

      // Skip if tasks already generated for today (e.g. user already opened app)
      const taskRef  = db.doc(`daily_tasks/${uid}_${today}`);
      const taskSnap = await taskRef.get();
      if (taskSnap.exists) {
        totalSkip++;
        return;
      }

      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model:           'gpt-4o-mini',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user',   content: buildPrompt(user) },
            ],
            temperature:     0.85,
            max_tokens:      600,
            response_format: { type: 'json_object' },
          }),
        });

        const json   = await res.json();
        const raw    = json.choices?.[0]?.message?.content;
        if (!raw) throw new Error('Empty OpenAI response');

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
          throw new Error('Invalid task structure');
        }

        const tasks = parsed.tasks.map((t, i) => ({
          id:       String(t.id || i + 1),
          text:     t.text,
          category: t.category || 'spiritual',
          done:     false,
        }));

        await taskRef.set({
          userId:      uid,
          date:        today,
          tasks,
          motivation:  parsed.motivation || '',
          aiGenerated: true,
          createdAt:   FieldValue.serverTimestamp(),
        });

        totalDone++;
      } catch (err) {
        console.error(`Failed to generate tasks for user ${uid}:`, err.message);
        totalFail++;
      }
    }

    // Paginate through all users
    do {
      let q = db.collection('users').limit(PAGE_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      // Process users sequentially to avoid rate-limiting OpenAI
      for (const userDoc of snap.docs) {
        await processUser(userDoc);
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < PAGE_SIZE) break;
    } while (true);

    console.log(`Daily tasks generation complete — generated: ${totalDone}, skipped: ${totalSkip}, failed: ${totalFail}`);
  }
);

// ─── Scheduled: Renew YouTube PubSubHubbub subscription ──────────
// Runs every Monday at 00:00 UTC.
// YouTube subscriptions expire after max 10 days — weekly renewal
// ensures new videos are always pushed to the app automatically.
// Add to functions/.env:
//   YOUTUBE_CHANNEL_ID=UCxxxxxxxx
//   YOUTUBE_ADMIN_URL=https://your-admin-site.netlify.app
exports.renewYoutubeSubscription = onSchedule(
  {
    schedule: 'every monday 00:00',
    timeZone: 'UTC',
  },
  async () => {
    const channelId = YOUTUBE_CHANNEL_ID.value();
    const adminUrl  = YOUTUBE_ADMIN_URL.value();

    if (!channelId) {
      console.error('[renewYoutubeSubscription] YOUTUBE_CHANNEL_ID is not set — skipping');
      return;
    }
    if (!adminUrl) {
      console.error('[renewYoutubeSubscription] YOUTUBE_ADMIN_URL is not set — skipping');
      return;
    }

    const HUB_URL    = 'https://pubsubhubbub.appspot.com/subscribe';
    const topicUrl   = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;
    const callbackUrl = `${adminUrl}/api/youtube-webhook`;

    const body = new URLSearchParams({
      'hub.mode':          'subscribe',
      'hub.topic':         topicUrl,
      'hub.callback':      callbackUrl,
      'hub.lease_seconds': '864000',
      'hub.verify':        'async',
    });

    try {
      const res = await fetch(HUB_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
      });

      if (res.status === 202) {
        console.log(`[renewYoutubeSubscription] Subscription renewed successfully for channel: ${channelId}`);
      } else {
        const text = await res.text();
        console.error(`[renewYoutubeSubscription] Hub returned ${res.status}:`, text);
      }
    } catch (err) {
      console.error('[renewYoutubeSubscription] Failed to renew subscription:', err);
    }
  }
);

// ════════════════════════════════════════════════════════════════════
// coachMessage — Main AI Coach callable
//
// Replaces sendCoachMessage() in rivnitz-app/src/services/aiCoach.js.
// All OpenAI and Pinecone calls run server-side so neither key is
// ever shipped in the mobile bundle.
//
// Input:  { user: {...}, messages: [{role,content}], newMessage: string }
// Output: { reply: string, escalated: boolean }
// ════════════════════════════════════════════════════════════════════

// ─── Pinecone base URL ────────────────────────────────────────────
function _pcUrl(host) {
  return host.startsWith('http') ? host.replace(/\/$/, '') : `https://${host}`;
}

// ─── Embed text via OpenAI text-embedding-3-small ─────────────────
async function _embed(text, apiKey) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body:    JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 2000) }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data[0].embedding;
}

// ─── Query a single Pinecone namespace ───────────────────────────
async function _pcQuery(vector, filter, pineconeKey, pineconeHost) {
  try {
    const res = await fetch(`${_pcUrl(pineconeHost)}/query`, {
      method:  'POST',
      headers: { 'Api-Key': pineconeKey, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ vector, topK: 18, includeMetadata: true, ...(filter ? { filter } : {}) }),
    });
    if (!res.ok) return [];
    return (await res.json()).matches || [];
  } catch {
    return [];
  }
}

// ─── RAG topic keywords (mirrors ragService.js) ───────────────────
const _RAG_TOPICS = {
  shabbat:   ['shabbat', 'shabbos', 'sabbath', 'שבת'],
  prayer:    ['prayer', 'pray', 'davening', 'tefillah', 'תפילה'],
  marriage:  ['marriage', 'married', 'spouse', 'wife', 'husband', 'shalom bayis'],
  parenting: ['children', 'child', 'kids', 'parenting', 'son', 'daughter'],
  emunah:    ['faith', 'emunah', 'believe', 'hashem', 'אמונה', 'doubt'],
  bitachon:  ['bitachon', 'anxiety', 'worry', 'stress', 'fear', 'בטחון'],
  anger:     ['anger', 'angry', 'rage', 'frustration', 'temper'],
  growth:    ['growth', 'improve', 'change', 'habit', 'middos', 'character'],
  teshuva:   ['teshuva', 'repentance', 'forgiveness', 'regret', 'atone'],
};

function _detectTopics(text) {
  const lower = text.toLowerCase();
  return Object.entries(_RAG_TOPICS)
    .filter(([, kws]) => kws.some(kw => lower.includes(kw)))
    .map(([topic]) => topic);
}

// ─── Retrieve relevant RAG chunks (mirrors ragService.js) ─────────
async function _retrieveRagChunks(context, apiKey, pineconeKey, pineconeHost) {
  try {
    // Rewrite query to formal retrieval language
    const rwRes  = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body:    JSON.stringify({
        model:       'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Convert the user message into a concise retrieval query using Torah and spiritual terms (emunah, bitachon, middos, teshuva, etc.). Return ONLY the query — no explanation.' },
          { role: 'user',   content: context },
        ],
        temperature: 0,
        max_tokens:  60,
      }),
    });
    const rwJson       = await rwRes.json();
    const expandedQuery = rwJson.choices?.[0]?.message?.content?.trim() || context;

    const vector  = await _embed(expandedQuery, apiKey);
    const topics  = _detectTopics(context);
    const queries = [_pcQuery(vector, null, pineconeKey, pineconeHost)];
    if (topics.length > 0) {
      queries.push(_pcQuery(vector, { topics: { '$in': topics } }, pineconeKey, pineconeHost));
    }

    // Merge + deduplicate by vector ID
    const seen = new Map();
    for (const matches of await Promise.all(queries)) {
      for (const m of matches) {
        if (!seen.has(m.id) || m.score > seen.get(m.id).score) seen.set(m.id, m);
      }
    }
    return Array.from(seen.values())
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .filter(m => (m.score ?? 0) >= 0.50)
      .slice(0, 4)
      .map(m => ({ text: m.metadata?.text || '', docTitle: m.metadata?.docTitle || 'Teaching', score: m.score }))
      .filter(c => c.text.length > 30);
  } catch (err) {
    console.warn('[coachMessage] RAG error:', err.message);
    return [];
  }
}

// ─── Recall past conversation memories from Pinecone ─────────────
async function _recallMemories(userId, currentMessage, apiKey, pineconeKey, pineconeHost) {
  try {
    const vector  = await _embed(currentMessage, apiKey);
    const matches = await _pcQuery(
      vector,
      { type: { '$eq': 'memory' }, userId: { '$eq': userId } },
      pineconeKey,
      pineconeHost
    );
    return matches
      .filter(m => (m.score ?? 0) >= 0.45)
      .slice(0, 4)
      .map(m => ({
        userMsg:   m.metadata?.userMsg   || '',
        aiReply:   m.metadata?.aiReply   || '',
        timestamp: m.metadata?.timestamp || 0,
      }));
  } catch {
    return [];
  }
}

// ─── Format RAG chunks for prompt injection ───────────────────────
function _fmtRag(chunks) {
  if (!chunks || chunks.length === 0) return '';
  let block = "\n\n## RABBI LANDAU'S TEACHINGS (retrieved for this question)\n";
  block += 'IMPORTANT: Ground your answer in these passages. Quote or paraphrase them directly.\n\n';
  for (const c of chunks) block += `### From "${c.docTitle}":\n${c.text}\n\n`;
  return block + '---\n';
}

// ─── Format memories for prompt injection ────────────────────────
function _fmtMemories(memories) {
  if (!memories || memories.length === 0) return '';
  function relTime(ts) {
    const d = Math.floor((Date.now() - ts * 1000) / 86400000);
    if (d === 0) return 'earlier today';
    if (d === 1) return 'yesterday';
    if (d < 7)   return `${d} days ago`;
    const w = Math.floor(d / 7);
    if (d < 30)  return `${w} week${w > 1 ? 's' : ''} ago`;
    const mo = Math.floor(d / 30);
    return `${mo} month${mo > 1 ? 's' : ''} ago`;
  }
  let block = '\n\n## THINGS THIS PERSON SHARED IN PAST SESSIONS:\n';
  block += 'Reference these naturally when relevant — weave them in as a mentor who remembers.\n\n';
  for (const m of memories) {
    block += `(${m.timestamp ? relTime(m.timestamp) : 'previously'}) They said: "${m.userMsg}"\n`;
  }
  return block + '\n---\n';
}

// ─── Tri-type coaching tone guides (mirrors aiCoach.js) ──────────
const _HEAD = {
  5: 'analytical and depth-oriented — respect their need for knowledge and private space',
  6: 'reassuring and grounded — acknowledge uncertainty and build trust step by step',
  7: 'energetic and possibility-focused — match their enthusiasm and keep things moving',
};
const _HEART = {
  2: 'warm and relational — acknowledge their care for others before addressing personal needs',
  3: 'direct and achievement-oriented — link guidance to goals and tangible outcomes',
  4: 'emotionally attuned and affirming of uniqueness — honour depth and authenticity',
};
const _GUT = {
  1: 'principled and structured — speak to their values and desire for integrity',
  8: 'frank and empowering — be direct, challenge gently, never condescend',
  9: 'gentle and conflict-sensitive — create safety before addressing hard truths',
};

// Hardcoded fallback used when Firestore has no system_prompt document.
const _BASE_PROMPT = `You are the Rivnitz AI Coach — a deeply personalized spiritual and life coaching companion built on the teachings of the Rivnitzer Rebbe, as transmitted by Rabbi Landau.

You are NOT a generic chatbot or search engine. You are a warm, wise spiritual coach who knows this user personally through their soul profile. You speak like a trusted mentor — honest, caring, and grounded in Torah wisdom through the Rivnitz lens.

WHO YOU ARE: A devoted student of Rabbi Landau who has deeply internalized the Rivnitz approach to life. You combine Torah wisdom, Chassidic tradition, mussar, and practical psychological insight — always filtered through Rivnitz philosophy. For deep personal matters, encourage direct connection with Rabbi Landau.

YOUR VOICE: Warm but honest. Conversational — like a trusted mentor, not a textbook. Use Hebrew Torah terms naturally (middos, emunah, teshuva, bitachon, shalom bayis, tefillah). Keep responses 80-200 words. No bullet points — this is a conversation. One core insight per response.

CRITICAL RULES:
1. NEVER give generic advice — filter through this user's soul profile.
2. NEVER act as a halachic authority.
3. NEVER ignore emotional pain to jump into teaching — empathy FIRST.
4. ALWAYS encourage direct connection with Rabbi Landau for deep matters.
5. Teach through story and metaphor (mashalim) whenever possible.`;

// ─── Build the full personalised system prompt (server-side) ─────
async function _buildPrompt(db, user, ragChunks, memories) {
  // 1. Fetch master prompt from Firestore (admin can edit this in the portal)
  let basePrompt = _BASE_PROMPT;
  try {
    const snap = await db.doc('ai_config/system_prompt').get();
    if (snap.exists && snap.data().content) basePrompt = snap.data().content;
  } catch { /* use fallback */ }

  // 2. Fetch knowledge base entries for this personality type
  let knowledgeBlock = '';
  try {
    const pType = user?.personalityType;
    let entries = [];
    if (pType) {
      const snap = await db.collection('ai_knowledge')
        .where('status', '==', 'active')
        .where('types', 'array-contains', pType)
        .get();
      entries = snap.docs.map(d => d.data());
    }
    if (entries.length > 0) {
      const grouped = {};
      for (const e of entries) {
        const cat = e.category || 'General';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(e);
      }
      knowledgeBlock = '\n\n## RIVNITZ TEACHINGS & GUIDELINES\n';
      for (const [cat, items] of Object.entries(grouped)) {
        knowledgeBlock += `### ${cat}\n`;
        for (const item of items) knowledgeBlock += `**${item.title}**\n${item.content}\n\n`;
      }
    }
  } catch { /* skip knowledge block */ }

  // 3. Fetch AI behaviour settings
  let behaviorBlock = '';
  try {
    const snap = await db.doc('ai_config/behavior').get();
    if (snap.exists) {
      const b = snap.data();
      behaviorBlock = `\n## STYLE: length=${b.responseLength || 'balanced'} tone=${b.tone || 'warm-direct'} hebrew=${b.includeHebrewTerms ? 'yes' : 'no'}`;
    }
  } catch { /* skip */ }

  // 4. Build personality block from tri-type or basic type
  let personalityBlock = '';
  if (user?.tritypeCode) {
    personalityBlock = `\n## USER: ${user.displayName || 'Friend'} | Tri-Type ${user.tritypeCode} | ${user.archetypeEn || user.personalityType || ''}
Mission: ${user.lifeMissionEn || ''} | Fears: ${user.coreFears || ''} | Blind spot: ${user.blindSpot || ''}
Tone — Head(${user.headType}): ${_HEAD[user.headType] || ''} · Heart(${user.heartType}): ${_HEART[user.heartType] || ''} · Gut(${user.gutType}): ${_GUT[user.gutType] || ''}${user.isCounterphobic ? ' · Counter-phobic type 6.' : ''}`;
  } else if (user?.personalityType) {
    personalityBlock = `\n## USER: ${user.displayName || 'Friend'} | Type: ${user.personalityType}`;
  }

  // 5. Life context (not cached — fresh each call)
  const lifeCtxBlock = user?.lifeContext?.length
    ? `\n\n## WHAT THIS PERSON HAS SHARED IN PREVIOUS SESSIONS:\n${user.lifeContext
        .map(f => `- ${f.category.charAt(0).toUpperCase() + f.category.slice(1)}: ${f.fact}`)
        .join('\n')}\nUse this context naturally — don't recite it back, let it inform how you guide them.`
    : '';

  // 6. Assemble — replace placeholders from master prompt if present
  let prompt = basePrompt
    .replace('{KNOWLEDGE_BASE}', knowledgeBlock)
    .replace('{user.displayName}',     user?.displayName     || 'Friend')
    .replace('{user.personalityType}', user?.personalityType || 'unknown')
    .replace('{user.mbtiType}',        user?.mbtiType        || 'unknown')
    .replace('{user.enneagramType}',   user?.enneagramType   || 'unknown')
    .replace('{user.humanDesignType}', user?.humanDesignType || 'unknown');

  if (!prompt.includes('USER:') && personalityBlock)    prompt += personalityBlock;
  if (!prompt.includes('STYLE:') && behaviorBlock)      prompt += behaviorBlock;
  if (!prompt.includes('RIVNITZ TEACHINGS') && knowledgeBlock) prompt += knowledgeBlock;

  // 7. Append dynamic blocks (life context, memories, RAG)
  prompt += lifeCtxBlock;
  prompt += _fmtMemories(memories);
  prompt += _fmtRag(ragChunks);

  return prompt;
}

// ─── Escalation trigger check (mirrors aiCoach.js) ────────────────
function _shouldEscalate(reply) {
  const triggers = [
    "i'm not certain", "i'm not sure", 'this is a complex',
    'rabbi should', 'speak with a rabbi', 'beyond my guidance',
    'halachic question', 'i would recommend consulting',
  ];
  const lower = reply.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

// ─── coachMessage (exported Cloud Function) ───────────────────────
exports.coachMessage = onCall(
  { secrets: [OPENAI_API_KEY, PINECONE_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { user, messages = [], newMessage } = request.data || {};

    if (!newMessage?.trim()) {
      throw new HttpsError('invalid-argument', 'newMessage is required');
    }

    const apiKey      = OPENAI_API_KEY.value();
    const pineconeKey = PINECONE_API_KEY.value();
    const pineconeHost = PINECONE_HOST.value();
    const hasPinecone = !!(pineconeKey && pineconeHost);

    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'OpenAI not configured on server');
    }

    const db  = getFirestore();
    const uid = user?.uid || request.auth.uid;

    // ── 1. RAG + Memory recall in parallel ──────────────────────
    const ragContext = [
      ...messages.slice(-2).map(m => m.content),
      newMessage,
    ].filter(Boolean).join(' ');

    const [ragChunks, memories] = await Promise.all([
      hasPinecone
        ? _retrieveRagChunks(ragContext, apiKey, pineconeKey, pineconeHost)
        : Promise.resolve([]),
      hasPinecone
        ? _recallMemories(uid, newMessage, apiKey, pineconeKey, pineconeHost)
        : Promise.resolve([]),
    ]);

    // ── 2. Build personalised system prompt ──────────────────────
    const systemPrompt = await _buildPrompt(db, user, ragChunks, memories);

    // ── 3. Trim history to last 6 turns (12 messages) ────────────
    const MAX_MSGS = 12;
    const trimmed  = messages.length > MAX_MSGS
      ? messages.slice(messages.length - MAX_MSGS)
      : messages;

    // ── 4. Main OpenAI chat completion ───────────────────────────
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body:    JSON.stringify({
        model:       'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...trimmed.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: newMessage },
        ],
        temperature: 0.5,
        max_tokens:  600,
      }),
    });

    const aiJson = await aiRes.json();
    if (aiJson.error) {
      console.error('[coachMessage] OpenAI error:', aiJson.error);
      throw new HttpsError('internal', aiJson.error.message || 'OpenAI error');
    }

    const reply          = aiJson.choices?.[0]?.message?.content || '';
    const shouldEscalate = _shouldEscalate(reply);

    // ── 5. Persist (fire-and-forget — never block the reply) ─────
    db.collection('ai_sessions').add({
      userId:    uid,
      userMsg:   newMessage,
      aiReply:   reply,
      escalated: shouldEscalate,
      createdAt: FieldValue.serverTimestamp(),
    }).catch(err => console.warn('[coachMessage] session save failed:', err.message));

    if (shouldEscalate) {
      db.collection('ai_escalations').add({
        userId:          uid,
        userName:        user?.displayName    || '',
        personalityType: user?.personalityType || '',
        mbtiType:        user?.mbtiType        || '',
        enneagramType:   user?.enneagramType   || '',
        question:        newMessage,
        aiAttempt:       reply,
        adminGuidance:   null,
        status:          'pending',
        createdAt:       FieldValue.serverTimestamp(),
      }).catch(err => console.warn('[coachMessage] escalation save failed:', err.message));
    }

    return { reply, escalated: shouldEscalate };
  }
);

// ════════════════════════════════════════════════════════════════════
// saveConversationMemory — Fire-and-forget memory upsert
//
// Replaces saveMemory() in rivnitz-app/src/services/memoryAgent.js.
// Embeds the user+coach exchange via OpenAI and upserts to Pinecone
// so future sessions can recall it via recallMemories().
//
// Input:  { userId: string, userMsg: string, aiReply: string }
// Output: { saved: boolean }
// ════════════════════════════════════════════════════════════════════
exports.saveConversationMemory = onCall(
  { secrets: [OPENAI_API_KEY, PINECONE_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { userId, userMsg, aiReply } = request.data || {};

    if (!userId || !userMsg?.trim()) {
      throw new HttpsError('invalid-argument', 'userId and userMsg are required');
    }

    const apiKey       = OPENAI_API_KEY.value();
    const pineconeKey  = PINECONE_API_KEY.value();
    const pineconeHost = PINECONE_HOST.value();

    if (!apiKey || !pineconeKey || !pineconeHost) {
      // Silently succeed — memory is an enhancement, not a hard requirement
      return { saved: false };
    }

    // Embed the full exchange so the vector captures both sides of the conversation.
    // Example: "User: I love mango juice\nCoach: That's wonderful..."
    const text      = `User: ${userMsg.trim()}\nCoach: ${(aiReply || '').trim()}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const suffix    = Math.random().toString(36).slice(2, 7);
    const vectorId  = `mem_${userId}_${timestamp}_${suffix}`;

    try {
      // 1. Embed via OpenAI
      const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body:    JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.slice(0, 2000),
        }),
      });
      const embedJson = await embedRes.json();
      if (embedJson.error) {
        console.warn('[saveConversationMemory] embed error:', embedJson.error.message);
        return { saved: false };
      }
      const vector = embedJson.data[0].embedding;

      // 2. Upsert to Pinecone
      const pcUrl  = pineconeHost.startsWith('http')
        ? pineconeHost.replace(/\/$/, '')
        : `https://${pineconeHost}`;
      const upsertRes = await fetch(`${pcUrl}/vectors/upsert`, {
        method:  'POST',
        headers: { 'Api-Key': pineconeKey, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          vectors: [{
            id:     vectorId,
            values: vector,
            metadata: {
              type:      'memory',
              userId,
              userMsg:   userMsg.trim().slice(0, 500),
              aiReply:   (aiReply || '').trim().slice(0, 500),
              text:      text.slice(0, 1000),
              timestamp,
            },
          }],
        }),
      });

      if (!upsertRes.ok) {
        const errText = await upsertRes.text();
        console.warn('[saveConversationMemory] Pinecone upsert failed:', upsertRes.status, errText);
        return { saved: false };
      }

      console.log('[saveConversationMemory] Saved memory:', vectorId);
      return { saved: true };
    } catch (err) {
      // Never throw — memory saving must never break the chat flow
      console.warn('[saveConversationMemory] error:', err.message);
      return { saved: false };
    }
  }
);

// ════════════════════════════════════════════════════════════════════
// processLifeContext — Extract and save personal life facts
//
// Replaces processLifeMemory() → detectLifeDiscussion() +
// extractAndSaveLifeFacts() in rivnitz-app/src/services/aiCoach.js.
//
// Step 1: cheap YES/NO gpt-4o-mini call — did the user share personal info?
// Step 2: if YES, extract structured facts and merge into users/{uid}.lifeContext
//
// Called fire-and-forget from CoachScreen after every AI reply.
//
// Input:  { uid: string, userMsg: string, aiReply: string, messages: [{role,content}] }
// Output: { processed: boolean }
// ════════════════════════════════════════════════════════════════════
exports.processLifeContext = onCall(
  { secrets: [OPENAI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { uid, userMsg, aiReply, messages = [] } = request.data || {};

    if (!uid || !userMsg?.trim()) {
      throw new HttpsError('invalid-argument', 'uid and userMsg are required');
    }

    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      // Silently succeed — life context is an enhancement, not a hard requirement
      return { processed: false };
    }

    try {
      // ── Step 1: YES/NO — did the user share personal life info? ──
      const detectRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body:    JSON.stringify({
          model:       'gpt-4o-mini',
          messages: [
            {
              role:    'system',
              content: `You detect whether a user shared personal life information in a coaching conversation.
Personal info includes: family details, relationships, personal struggles, goals, spiritual journey, work situation, health, life events, emotions they described.
Respond with ONLY one word: YES or NO.`,
            },
            {
              role:    'user',
              content: `User said: "${userMsg}"\nCoach replied: "${aiReply}"`,
            },
          ],
          temperature: 0,
          max_tokens:  5,
        }),
      });
      const detectJson = await detectRes.json();
      const hasPersonalInfo = detectJson.choices?.[0]?.message?.content?.trim().toUpperCase() === 'YES';

      if (!hasPersonalInfo) return { processed: false };

      // ── Step 2: Extract structured facts ─────────────────────────
      const conversation = messages
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
        .join('\n');

      const extractRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body:    JSON.stringify({
          model:       'gpt-4o-mini',
          messages: [
            {
              role:    'system',
              content: `Extract personal life facts from this spiritual coaching conversation.
Return a JSON array only. Each item must have "category" and "fact".
Categories: family | struggle | goal | progress | spiritual | work | health | preferences
- family: spouse, kids, parents, siblings, relationships
- struggle: current challenges, fears, recurring problems
- goal: things they want to achieve or improve
- progress: wins, breakthroughs, improvements they mentioned
- spiritual: prayer habits, Jewish practice, spiritual experiences
- work: job, career, business, financial situation
- health: physical or mental health details they shared
- preferences: food likes/dislikes, hobbies, interests, things they enjoy or avoid
Rules:
- Only extract clear, specific facts the user stated about themselves
- Keep each fact concise (max 10 words)
- Max 5 facts per call
- If nothing meaningful, return []
Return ONLY the JSON array, no other text.`,
            },
            { role: 'user', content: conversation },
          ],
          temperature: 0,
          max_tokens:  300,
        }),
      });
      const extractJson = await extractRes.json();

      let newFacts = [];
      try {
        newFacts = JSON.parse(extractJson.choices?.[0]?.message?.content?.trim());
      } catch {
        return { processed: false };
      }
      if (!Array.isArray(newFacts) || newFacts.length === 0) return { processed: false };

      // ── Step 3: Merge into users/{uid}.lifeContext (cap at 20) ───
      const db      = getFirestore();
      const userRef = db.doc(`users/${uid}`);
      const snap    = await userRef.get();
      const existing = snap.data()?.lifeContext || [];

      const merged = [...existing];
      for (const newFact of newFacts) {
        const idx = merged.findIndex(
          f => f.category === newFact.category &&
               f.fact.split(' ').slice(0, 3).join(' ').toLowerCase() ===
               newFact.fact.split(' ').slice(0, 3).join(' ').toLowerCase()
        );
        if (idx >= 0) {
          merged[idx] = { ...newFact, updatedAt: new Date().toISOString() };
        } else {
          merged.push({ ...newFact, updatedAt: new Date().toISOString() });
        }
      }

      await userRef.update({ lifeContext: merged.slice(-20) });
      console.log(`[processLifeContext] Saved ${newFacts.length} fact(s) for user ${uid}`);
      return { processed: true };

    } catch (err) {
      // Never throw — life context must never break the chat flow
      console.warn('[processLifeContext] error:', err.message);
      return { processed: false };
    }
  }
);

// ════════════════════════════════════════════════════════════════════
// generateDailyTasksOnDemand — On-demand daily task generation
//
// Replaces generateDailyTasks() in rivnitz-app/src/services/aiCoach.js.
// Called from GrowthScreen when no pre-generated tasks exist for today
// (the scheduled generateDailyTasksForAllUsers handles most users at
//  6 AM UTC, but this is the fallback for users who missed it).
//
// Input:  { user: { displayName, personalityType, enneagramType,
//                   mbtiType, tritypeCode, lifeMissionEn, coreFears,
//                   streakCount, membershipTier, lifeContext } }
// Output: { tasks: [...], motivation: string }
// ════════════════════════════════════════════════════════════════════

const DAILY_TASK_SYSTEM_PROMPT = `You are the Rivnitz Daily Growth Guide. Your job is to generate a personalized daily growth plan for a specific person based on their soul profile.

You must return ONLY valid JSON in exactly this format — no preamble, no explanation, nothing else:
{
  "motivation": "A single inspiring sentence (max 30 words) tailored to this person's soul type and today's context. Warm, personal, rooted in Rivnitz/Torah wisdom.",
  "tasks": [
    { "id": "1", "text": "Task description (max 10 words, action-oriented)", "category": "spiritual", "done": false },
    { "id": "2", "text": "Task description", "category": "health", "done": false },
    { "id": "3", "text": "Task description", "category": "mindset", "done": false },
    { "id": "4", "text": "Task description", "category": "relationship", "done": false },
    { "id": "5", "text": "Task description", "category": "spiritual", "done": false }
  ]
}

Categories must be one of: spiritual, health, mindset, relationship.
Always generate exactly 5 tasks.

PERSONALIZATION RULES:
- Each task must feel written specifically for this person — never generic
- Use their life context (things they've shared in coaching) to make tasks real and relevant
- The Enneagram type reveals growth edges: assign tasks that address their specific growth challenge
- Consider the day of week: Friday = Shabbat preparation tasks, Sunday = weekly intention-setting
- If streak is high (10+), give slightly more challenging tasks. If streak is 0-3, give gentle, achievable tasks
- Never repeat tasks that feel identical across different soul types`;

exports.generateDailyTasksOnDemand = onCall(
  { secrets: [OPENAI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { user } = request.data || {};

    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'OpenAI not configured on server');
    }

    const today     = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const streak    = user?.streakCount || 0;

    const lifeCtx = (user?.lifeContext || [])
      .slice(-10)
      .map(f => `- ${f.category}: ${f.fact}`)
      .join('\n') || 'No life context available yet.';

    const tritypeBlock = user?.tritypeCode
      ? `Tri-Type: ${user.tritypeCode} | Life Mission: ${user.lifeMissionEn || ''} | Core Fears: ${user.coreFears || ''}`
      : '';

    const userBlock = `SOUL PROFILE:
- Name: ${user?.displayName || 'Friend'}
- Soul Archetype: ${user?.personalityType || 'Unknown'}
- Enneagram: ${user?.enneagramType || 'Unknown'}
- MBTI: ${user?.mbtiType || 'Unknown'}
${tritypeBlock ? `- ${tritypeBlock}` : ''}
- Current streak: ${streak} days
- Membership: ${user?.membershipTier || 'free'}

TODAY'S CONTEXT:
- Date: ${today} (${dayOfWeek})

WHAT THIS PERSON HAS SHARED IN COACHING SESSIONS:
${lifeCtx}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body:    JSON.stringify({
        model:           'gpt-4o-mini',
        messages: [
          { role: 'system', content: DAILY_TASK_SYSTEM_PROMPT },
          { role: 'user',   content: userBlock },
        ],
        temperature:     0.85,
        max_tokens:      600,
        response_format: { type: 'json_object' },
      }),
    });

    const json = await res.json();
    if (json.error) {
      console.error('[generateDailyTasksOnDemand] OpenAI error:', json.error);
      throw new HttpsError('internal', json.error.message || 'OpenAI error');
    }

    let parsed;
    try {
      parsed = JSON.parse(json.choices?.[0]?.message?.content);
    } catch {
      throw new HttpsError('internal', 'Invalid JSON from OpenAI');
    }

    if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      throw new HttpsError('internal', 'Invalid task structure from AI');
    }

    const tasks = parsed.tasks.map((t, i) => ({
      id:       String(t.id || i + 1),
      text:     t.text,
      category: t.category || 'spiritual',
      done:     false,
    }));

    return { tasks, motivation: parsed.motivation || '' };
  }
);

// ════════════════════════════════════════════════════════════════════
// applyRabbiGuidance — Generate personalised response from Rabbi's input
//
// Replaces applyRabbiGuidance() in rivnitz-app/src/services/aiCoach.js
// and powers the "Send to AI" button in the admin dashboard.
//
// Flow:
//   1. Fetch the escalation doc → get userId + question context
//   2. Fetch the user profile → build personalised prompt
//   3. Mark escalation as answered (adminGuidance + status = 'answered')
//   4. Call OpenAI with Rabbi's guidance injected as a second system message
//   5. Return { response } — the ready-to-deliver personalised message
//
// Input:  { escalationId: string, rabbiGuidance: string }
// Output: { response: string }
// ════════════════════════════════════════════════════════════════════
exports.applyRabbiGuidance = onCall(
  { secrets: [OPENAI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { escalationId, rabbiGuidance } = request.data || {};

    if (!escalationId || !rabbiGuidance?.trim()) {
      throw new HttpsError('invalid-argument', 'escalationId and rabbiGuidance are required');
    }

    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'OpenAI not configured on server');
    }

    const db = getFirestore();

    // ── 1. Fetch the escalation document ────────────────────────
    const escalRef = db.doc(`ai_escalations/${escalationId}`);
    const escalSnap = await escalRef.get();
    if (!escalSnap.exists) {
      throw new HttpsError('not-found', 'Escalation not found');
    }
    const escal = escalSnap.data();

    // ── 2. Fetch the user profile ────────────────────────────────
    let user = {};
    try {
      const userSnap = await db.doc(`users/${escal.userId}`).get();
      if (userSnap.exists) user = userSnap.data();
    } catch { /* proceed with partial user info from escalation */ }

    // Merge escalation-level fields as fallback
    const profile = {
      displayName:     user.displayName     || escal.userName        || 'Friend',
      personalityType: user.personalityType || escal.personalityType || '',
      mbtiType:        user.mbtiType        || escal.mbtiType        || '',
      enneagramType:   user.enneagramType   || escal.enneagramType   || '',
      humanDesignType: user.humanDesignType || '',
      tritypeCode:     user.tritypeCode     || '',
      archetypeEn:     user.archetypeEn     || '',
      lifeMissionEn:   user.lifeMissionEn   || '',
      coreFears:       user.coreFears       || '',
      blindSpot:       user.blindSpot       || '',
      headType:        user.headType,
      heartType:       user.heartType,
      gutType:         user.gutType,
      isCounterphobic: user.isCounterphobic || false,
      lifeContext:     user.lifeContext      || [],
    };

    // ── 3. Mark escalation as answered ───────────────────────────
    await escalRef.update({
      adminGuidance: rabbiGuidance.trim(),
      status:        'answered',
      answeredAt:    FieldValue.serverTimestamp(),
    });

    // ── 4. Build personalised system prompt (reuse _buildPrompt) ─
    const systemPrompt = await _buildPrompt(db, profile, [], []);

    // ── 5. Call OpenAI — inject Rabbi's guidance as second system msg
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body:    JSON.stringify({
        model:       'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role:    'system',
            content: `The Rabbi has reviewed this question and provided the following guidance: "${rabbiGuidance.trim()}"\n\nUse this as the core of your response. Expand and personalise it for this specific person's soul type and situation. Do not quote the Rabbi's guidance verbatim — integrate it naturally as if it came from you. Stay within 200 words.`,
          },
          { role: 'user', content: escal.question || '' },
        ],
        temperature: 0.6,
        max_tokens:  350,
      }),
    });

    const json = await res.json();
    if (json.error) {
      console.error('[applyRabbiGuidance] OpenAI error:', json.error);
      throw new HttpsError('internal', json.error.message || 'OpenAI error');
    }

    const response = json.choices?.[0]?.message?.content?.trim() || '';
    return { response };
  }
);
