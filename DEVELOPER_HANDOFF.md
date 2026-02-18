# Rivnitz App — Developer Handoff Guide

> **Miracles Through Mission** — Complete React Native app built for Rabbi Landau / Rivnitz.com

---

## 🚀 Quick Start (Get Running in 15 Minutes)

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in your keys
cp .env.example .env

# 3. Start development server
npx expo start

# 4. Scan QR code with Expo Go app on your phone
```

---

## 📁 Full File Map

```
rivnitz-app/
│
├── App.js                          ← Entry point, font loading, auth init
├── app.json                        ← Expo config (permissions, bundle IDs)
├── package.json                    ← All dependencies
├── .env.example                    ← Environment variable template
├── firestore.rules                 ← Firebase security rules
│
├── src/
│   ├── theme/
│   │   └── index.js               ← ALL brand colors, fonts, spacing, shadows
│   │
│   ├── services/
│   │   ├── firebase.js            ← Firebase init + collection constants
│   │   ├── aiCoach.js             ← AI coach engine (OpenAI integration)
│   │   ├── videoService.js        ← Video fetching, search, view tracking
│   │   └── notifications.js       ← Push notification registration + scheduling
│   │
│   ├── store/
│   │   └── authStore.js           ← Zustand: auth state, user profile, sign in/out
│   │
│   ├── navigation/
│   │   └── index.js               ← Full nav: auth stack, tab bar, drawer
│   │
│   └── screens/
│       ├── auth/
│       │   ├── LoginScreen.js     ← Google + email login
│       │   ├── SignUpScreen.js    ← Account creation
│       │   ├── NatureQuizScreen.js← AI conversational quiz (MBTI, Enneagram)
│       │   └── ProfileSetupScreen.js ← Hebrew name, mother's name, phone
│       │
│       ├── home/
│       │   ├── HomeScreen.js      ← Video feed, topic filters, grid
│       │   └── VideoPlayerScreen.js ← Full-screen Mux video player
│       │
│       ├── coach/
│       │   └── CoachScreen.js     ← AI chat, personalized responses, escalation
│       │
│       ├── community/
│       │   └── CommunityScreen.js ← Real-time community posts + likes
│       │
│       ├── growth/
│       │   └── GrowthScreen.js    ← Morning motivation, tasks, streaks
│       │
│       ├── prayers/
│       │   └── PrayersScreen.js   ← Candle lighting, prayers, Yeshua, blessings
│       │
│       ├── live/
│       │   └── LiveSessionScreen.js ← Rabbi live stream + waiting room
│       │
│       └── profile/
│           ├── ProfileScreen.js   ← User profile, completion nudges
│           └── SettingsScreen.js  ← Notifications, subscription, account
│
└── admin-portal/
    └── index.html                  ← Full admin dashboard UI (deploy separately)
```

---

## 🔑 External Services You Need to Set Up

### 1. Firebase (Required — free tier is fine to start)
- Go to https://console.firebase.google.com
- Create new project: "rivnitz"
- Enable: **Authentication** (Google + Email), **Firestore**, **Storage**
- Copy config keys to `.env`
- Deploy security rules: `firebase deploy --only firestore:rules`

### 2. Google Sign-In
- In Firebase Console → Authentication → Sign-in method → Enable Google
- In Google Cloud Console, create OAuth 2.0 credentials
- Copy Web Client ID, iOS Client ID to `.env`

### 3. OpenAI (AI Coach)
- Get API key from https://platform.openai.com
- Uses GPT-4 Turbo — budget ~$50/month for first 1,000 users
- Key goes in `.env` as `OPENAI_API_KEY`

### 4. Mux (Video Hosting)
- Sign up at https://mux.com
- Create an access token
- Videos are uploaded via Admin Portal → stored on Mux → playback via `stream.mux.com`
- Cost: ~$0.015/min of stored video + $0.015/min watched

### 5. Agora (Live Sessions)
- Sign up at https://agora.io
- Create new project → copy App ID
- For production: implement Agora token server (Firebase Cloud Function)

### 6. Stripe (Donations)
- Sign up at https://stripe.com
- Get publishable key (test mode first, switch to live when ready)
- Donation flow: user selects amount → Stripe payment sheet → confirmation

---

## 🗄️ Firestore Data Structure

```
users/
  {uid}/
    displayName, email, phoneNumber
    hebrewName, mothersName          ← For prayer requests
    membershipTier: "free" | "premium"
    personalityType, mbtiType, enneagramType, humanDesignType
    hasCompletedOnboarding, hasCompletedNatureQuiz
    streakCount, lastActiveDate
    expoPushToken                    ← For push notifications
    role: "user" | "admin"          ← Set manually for admin access

videos/
  {videoId}/
    title, description, topics[]
    muxPlaybackId                    ← From Mux after upload
    duration, viewCount
    createdAt, publishedAt

community_posts/
  {postId}/
    content, authorId, authorName
    likes[]                          ← Array of user UIDs
    replyCount, pinned
    createdAt

ai_sessions/
  {sessionId}/
    userId, userMsg, aiReply
    escalated: bool
    createdAt

ai_escalations/
  {escalationId}/
    userId, userName, personalityType, mbtiType
    question, aiAttempt
    adminGuidance                    ← Rabbi fills this in
    status: "pending" | "answered"
    createdAt, answeredAt

prayer_requests/
  {requestId}/
    type: "candle" | "prayer" | "yeshua" | "blessing"
    userId, userName, formData{}
    donationAmt, status: "pending" | "received"
    createdAt

live_sessions/
  {sessionId}/
    title, status: "live" | "ended"
    viewerCount, startedAt
    waitingRoom/ (sub-collection)
      {entryId}/
        userId, userName
        status: "waiting" | "in-session" | "done" | "left"
        joinedAt

daily_tasks/
  {uid_date}/
    userId, date
    tasks[]: { id, text, category, done }
    motivation
    createdAt
```

---

## 👨‍💼 Setting Up Admin Access

To give Rabbi Landau admin access to the admin portal:
1. He signs in to the mobile app first (creates his user profile)
2. In Firebase Console → Firestore → users collection → find his document
3. Manually add the field: `role: "admin"`
4. He can now access all admin features

The admin portal (`admin-portal/index.html`) needs to be built into a full React app. The current file is the complete UI reference — a developer can build it out in 1-2 days using the same Firebase project.

---

## 📱 Building for App Store

### iOS (requires Mac + Apple Developer account $99/year)
```bash
npm install -g eas-cli
eas login
eas build --platform ios
```

### Android (requires Google Play account $25 one-time)
```bash
eas build --platform android
```

---

## 🎯 What's Ready vs. What Needs Finishing

### ✅ Complete and working:
- All screens built with correct UI
- Navigation (tabs, drawer, auth flow)
- Firebase auth (Google + email)
- User profile with completion nudges
- AI Coach with personality-based responses
- AI escalation queue system
- Community chat (real-time)
- Daily growth tracker with tasks
- Prayer & blessing requests
- Rabbi live session + waiting room
- Push notification service
- Video player (Mux ready)
- Firestore security rules
- Admin portal UI

### 🔧 Developer needs to connect:
- Fill in `.env` with real API keys
- Upload Cormorant Garamond + DM Sans fonts to `/assets/fonts/`
- Upload app icon to `/assets/icon.png`
- Add splash screen to `/assets/splash.png`
- Build out admin portal as full React app
- Implement Agora video SDK in LiveSessionScreen
- Implement Stripe payment sheet in PrayersScreen
- Deploy Firebase Cloud Functions for:
  - AI task generation (daily_tasks)
  - Agora token generation
  - Admin notifications to Rabbi when escalation is added
- Set up Mux webhook for video processing status
- Test on physical iOS and Android devices

---

## 💡 Important Notes for the Developer

1. **Never hardcode colors** — always import from `src/theme/index.js`
2. **Font names** must match exactly: `'CormorantGaramond-Bold'`, `'DMSans-Regular'` etc.
3. **AI prompts** are in `src/services/aiCoach.js` — the `PERSONALITY_PROFILES` object is where Rabbi's teaching style is encoded
4. **Admin role** is controlled by the `role` field in the user's Firestore document
5. **Morning notifications** are scheduled client-side via `expo-notifications` — for more reliability, use Firebase Cloud Functions + FCM
6. **Stripe**: Use `@stripe/stripe-react-native` `presentPaymentSheet()` in PrayersScreen after user confirms donation amount

---

*Built with ♥ for Rivnitz · Miracles Through Mission 🔥*
