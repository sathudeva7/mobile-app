/**
 * Firebase Service
 * Initializes Firebase app, Auth, Firestore, and Storage.
 * Import from here throughout the app — never re-initialize.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { firebase as firebaseEnv } from '../config';

const firebaseConfig = {
  apiKey:            firebaseEnv.apiKey,
  authDomain:        firebaseEnv.authDomain,
  projectId:         firebaseEnv.projectId,
  storageBucket:     firebaseEnv.storageBucket,
  messagingSenderId: firebaseEnv.messagingSenderId,
  appId:             firebaseEnv.appId,
  measurementId:     firebaseEnv.measurementId,
};

// Prevent re-initialization on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth — initializeAuth with AsyncStorage persistence, fall back to getAuth if already initialized
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (e) {
  // Already initialized (hot reload) — get the existing instance
  auth = getAuth(app);
}

// Firestore and Storage are always initialized regardless of auth status
export const db      = getFirestore(app);
export const storage = getStorage(app);
export { auth };

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
