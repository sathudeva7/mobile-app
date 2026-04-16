/**
 * Expo app config — loads .env and exposes to app via extra.
 * Run without .env: all values will be empty, app uses config.js fallbacks.
 */

try {
  require('dotenv').config({ path: '.env' });
} catch (_) {
  // dotenv optional; process.env from shell used if not installed
}

const appJson = require('./app.json');

// ─── Google Sign-In: derive reversed iOS client ID for URL scheme ────
// Input:  "123456789-abc.apps.googleusercontent.com"
// Output: "com.googleusercontent.apps.123456789-abc"
const GOOGLE_IOS_CLIENT_ID = process.env.GOOGLE_IOS_CLIENT_ID || '';
function reverseIosClientId(clientId) {
  if (!clientId) return undefined;
  const match = clientId.match(/^(.+)\.apps\.googleusercontent\.com$/);
  return match ? `com.googleusercontent.apps.${match[1]}` : undefined;
}
const iosUrlScheme = reverseIosClientId(GOOGLE_IOS_CLIENT_ID);

// ─── Plugins: inject iosUrlScheme into Google Sign-In plugin ─────────
const basePlugins = appJson.expo?.plugins || [];
const plugins = basePlugins.map((plugin) => {
  const name = Array.isArray(plugin) ? plugin[0] : plugin;
  if (name === '@react-native-google-signin/google-signin') {
    return iosUrlScheme
      ? [name, { iosUrlScheme }]
      : plugin;
  }
  return plugin;
});

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    plugins,
    extra: {
      ...appJson.expo?.extra,
      // Env vars — empty when no .env, app handles via config.js fallbacks
      FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || '',
      FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || '',
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
      FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || '',
      FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || '',
      FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID || '',
      GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID || '',
      GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID || '',
      GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID || '',
      AGORA_APP_ID:      process.env.AGORA_APP_ID || '',
      ADMIN_PORTAL_URL:  process.env.ADMIN_PORTAL_URL || '',
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
      EXPO_PROJECT_ID: process.env.EXPO_PROJECT_ID || appJson.expo?.extra?.eas?.projectId || '8c3e6264-2b3e-4c7d-9fc6-ee036b3f0beb',
      eas: {
        projectId: process.env.EXPO_PROJECT_ID || appJson.expo?.extra?.eas?.projectId || '8c3e6264-2b3e-4c7d-9fc6-ee036b3f0beb',
      },
    },
  },
};
