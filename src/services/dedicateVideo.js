/**
 * Dedicate Video Service
 * Handles getting a Mux direct-upload URL, uploading the video file,
 * and saving the dedication record to Firestore.
 */

import * as FileSystem from 'expo-file-system';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.client';
import { agora } from '../config';

const ADMIN_URL = agora.adminPortalUrl;
const MAX_DURATION_MS = 120_000; // 2 minutes

// ─── Get a Mux direct-upload URL from the admin portal ────────────
export async function getMuxUploadUrl() {
  const res = await fetch(`${ADMIN_URL}/api/mux-upload`, { method: 'POST' });
  if (!res.ok) throw new Error('Could not connect to upload service. Try again.');
  const data = await res.json();
  if (!data.uploadUrl) throw new Error('Invalid response from upload service.');
  return data; // { uploadId, uploadUrl }
}

// ─── Upload video file directly to Mux via PUT ────────────────────
// onProgress(0–1) is called as the upload progresses.
export async function uploadVideoToMux(uploadUrl, fileUri, onProgress) {
  const callback = onProgress
    ? (event) => {
        if (event.totalBytesExpectedToSend > 0) {
          onProgress(event.totalBytesSent / event.totalBytesExpectedToSend);
        }
      }
    : undefined;

  const result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': 'video/mp4' },
    sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
    ...(callback ? { uploadProgressCallback: callback } : {}),
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed with status ${result.status}`);
  }
}

// ─── Save dedication record to Firestore ─────────────────────────
export async function saveDedication({ uploadId, dedicatedTo, message, userId, displayName, userEmail }) {
  await addDoc(collection(db, 'dedicated_videos'), {
    uploadId,
    dedicatedTo,
    message:       message || '',
    userId,
    displayName,
    userEmail,
    muxPlaybackId: null,
    status:        'processing',
    createdAt:     serverTimestamp(),
  });
}

// ─── Validate video duration (checked after picker returns) ───────
export function validateDuration(durationMs) {
  if (!durationMs) return true; // unknown — allow through
  return durationMs <= MAX_DURATION_MS;
}
