/**
 * Firebase Service
 * Initializes Firebase app, Auth, Firestore, and Storage.
 * Import from here throughout the app — never re-initialize.
 */

import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID,
} from '@env';

const firebaseConfig = {
  apiKey:            FIREBASE_API_KEY,
  authDomain:        FIREBASE_AUTH_DOMAIN,
  projectId:         FIREBASE_PROJECT_ID,
  storageBucket:     FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId:             FIREBASE_APP_ID,
  measurementId:     FIREBASE_MEASUREMENT_ID,
};

const app  = initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (e) {
  auth = getAuth(app);
}
export { auth };
export const db        = getFirestore(app);
export const storage   = getStorage(app);

export default app;

// ─── Firestore Collection References ──────────────────────────────
// Use these constants everywhere instead of hardcoding strings.
export const COLLECTIONS = {
  USERS:          'users',
  VIDEOS:         'videos',
  COMMUNITY:      'community_posts',
  AI_SESSIONS:    'ai_sessions',
  AI_ESCALATIONS: 'ai_escalations',
  PRAYER_REQUESTS:'prayer_requests',
  LIVE_SESSIONS:  'live_sessions',
  NOTIFICATIONS:  'notifications',
  DONATIONS:      'donations',
  DAILY_TASKS:    'daily_tasks',

  // ─── Knowledge Base (admin-controlled AI brain) ───────────────
  AI_KNOWLEDGE:   'ai_knowledge',   // individual teaching entries
  AI_CONFIG:      'ai_config',      // system_prompt doc + behavior doc
};
