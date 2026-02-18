/**
 * Central config — reads from Constants.expoConfig.extra (via app.config.js)
 * or process.env, with safe fallbacks for running without .env.
 */

import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

function get(key, fallback = '') {
  const val = extra[key] ?? process.env?.[key];
  return val != null && val !== '' ? String(val) : fallback;
}

// Firebase — use placeholder values when empty so init doesn't crash
// (actual API calls will fail until real config is provided)
export const firebase = {
  apiKey:            get('FIREBASE_API_KEY', 'AIzaSyDEMO_FOR_DEV_REPLACE_WITH_REAL_KEY'),
  authDomain:        get('FIREBASE_AUTH_DOMAIN', 'demo.firebaseapp.com'),
  projectId:          get('FIREBASE_PROJECT_ID', 'demo-rivnitz'),
  storageBucket:     get('FIREBASE_STORAGE_BUCKET', 'demo-rivnitz.appspot.com'),
  messagingSenderId: get('FIREBASE_MESSAGING_SENDER_ID', '000000000000'),
  appId:             get('FIREBASE_APP_ID', '1:000000000000:web:0000000000000000000000'),
  measurementId:     get('FIREBASE_MEASUREMENT_ID', ''),
};

export const googleSignIn = {
  webClientId:    get('GOOGLE_WEB_CLIENT_ID'),
  iosClientId:   get('GOOGLE_IOS_CLIENT_ID'),
  androidClientId: get('GOOGLE_ANDROID_CLIENT_ID'),
};

export const openai = {
  apiKey: get('OPENAI_API_KEY'),
  model:  get('OPENAI_MODEL', 'gpt-4-turbo-preview'),
};

export const expo = {
  projectId: get('EXPO_PROJECT_ID') || extra.eas?.projectId || '',
};

export const hasFirebaseConfig = () => {
  const key = firebase.apiKey || '';
  return key.length > 20 && !key.includes('DEMO_FOR_DEV');
};

export const hasOpenAIConfig = () => !!openai.apiKey;

export const hasGoogleSignInConfig = () => !!googleSignIn.webClientId;

export default { firebase, googleSignIn, openai, expo };
