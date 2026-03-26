# Rivnitz App

**Miracles Through Mission**  
Built with React Native + Expo | Rabbi Landau | rivnitz.com

---

## Project Overview

A full-featured spiritual coaching and community app built on the teachings of Rabbi Landau. Features include personalized AI coaching, daily growth tracking, live sessions, community chat, and prayer/blessing requests.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | React Native + Expo |
| Navigation | React Navigation v6 |
| State Management | Zustand |
| Backend / Database | Firebase (Firestore + Auth + Storage) |
| AI Coach | OpenAI GPT-4 API |
| Video Streaming | Mux |
| Live Sessions | Agora RTC |
| Push Notifications | Expo Notifications + Firebase Cloud Messaging |
| Payments / Donations | Stripe |
| Admin Portal | React (web, separate) |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd rivnitz-app

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in your API keys in .env

# Start the app
npx expo start
```

### Environment Variables

Create a `.env` file in the root with the following:

```
# Firebase
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=

# OpenAI (AI Coach)
OPENAI_API_KEY=

# Mux (Video)
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=

# Agora (Live Sessions)
AGORA_APP_ID=

# Stripe (Payments)
STRIPE_PUBLISHABLE_KEY=
```

---

## Project Structure

```
rivnitz-app/
├── src/
│   ├── screens/           # All app screens
│   │   ├── auth/          # Login, signup, onboarding
│   │   ├── home/          # Video feed
│   │   ├── coach/         # AI chat + nature quiz
│   │   ├── community/     # Public community chat
│   │   ├── growth/        # Daily tracker + tasks
│   │   ├── prayers/       # Prayer requests + blessings
│   │   ├── live/          # Rabbi live sessions
│   │   └── profile/       # User profile + settings
│   ├── components/        # Reusable UI components
│   ├── navigation/        # App navigation structure
│   ├── theme/             # Brand colors, fonts, styles
│   ├── store/             # Zustand state management
│   ├── services/          # API calls (Firebase, OpenAI, etc.)
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Helper functions
├── assets/                # Images, fonts, icons
├── admin-portal/          # Separate React web admin dashboard
├── app.json               # Expo config
├── .env.example           # Environment variable template
└── README.md
```

---

## Key Features

- **AI Personal Coach** — Conversational quiz determines MBTI, Enneagram, Human Design type. All responses personalized per user personality.
- **Video Teaching Library** — Instagram-style grid of Rabbi's teachings, filterable by topic.
- **Community Chat** — Public forum for all members.
- **Daily Growth Tracker** — Morning motivation at 9AM, personalized daily tasks, streak tracking.
- **Prayer & Blessings** — Donation-based candle lighting, prayer requests, Yeshua, personal blessings.
- **Rabbi Live Sessions** — Live stream with private waiting room, one-by-one admissions.
- **Admin Portal** — Full backend management: videos, users, AI queue, push notifications, donations.

---

## Developer Notes

- All brand colors and typography are defined in `src/theme/index.js` — never hardcode colors elsewhere.
- Firebase security rules are in `firestore.rules` — review before deploying.
- The AI Coach system prompt is in `src/services/aiCoach.js` — this is the core of the personalization engine.
- Admin portal is a separate React web app in `/admin-portal` — deploy separately.

---

## Contact

Rivnitz.com | Rabbi Landau
