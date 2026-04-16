import { Platform, PermissionsAndroid } from 'react-native';
import { agora as agoraConfig } from '../../config';

const ADMIN_PORTAL_URL = agoraConfig.adminPortalUrl;

export const CONSULT_DURATION_S = 5 * 60;

export async function fetchAgoraToken(channel, uid = 0) {
  if (!ADMIN_PORTAL_URL) {
    console.warn('[Agora] ADMIN_PORTAL_URL is empty — joining without token');
    return null;
  }
  const url = `${ADMIN_PORTAL_URL}/api/agora-token?channel=${encodeURIComponent(channel)}&uid=${uid}`;
  console.log('[Agora] Fetching token from:', url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('Failed to fetch Agora token');
    const { token } = await res.json();
    console.log('[Agora] Token received:', token ? 'yes' : 'NO TOKEN');
    return token;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError')
      throw new Error('Token server timed out — check admin portal is reachable');
    throw e;
  }
}

export async function requestMediaPermissions() {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  return (
    granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
    granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
  );
}

export function formatEstWait(pos) {
  const mins = (pos - 1) * 6;
  return mins === 0 ? "You're next!" : `~${mins} min`;
}

export function formatCountdown(secs) {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Firestore Timestamp or plain { seconds } → ms, for elapsed timer. */
export function getStartedAtMs(startedAt) {
  if (!startedAt) return Date.now();
  if (typeof startedAt.toMillis === 'function') return startedAt.toMillis();
  if (startedAt.seconds) return startedAt.seconds * 1000;
  return Date.now();
}
