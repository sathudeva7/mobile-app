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
const { onRequest }                    = require('firebase-functions/v2/https');
const { defineSecret }                 = require('firebase-functions/params');
const { initializeApp }                = require('firebase-admin/app');
const { getFirestore, FieldValue }     = require('firebase-admin/firestore');
const { getAuth }                      = require('firebase-admin/auth');

const { defineString } = require('firebase-functions/params');

const OPENAI_API_KEY    = defineSecret('OPENAI_API_KEY');
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');

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
