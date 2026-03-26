/**
 * Video Service — Mux Integration
 * Handles video playback, view tracking, and search.
 */

import {
  collection, query, orderBy, where, limit,
  getDocs, getDoc, doc, updateDoc, increment,
  startAfter, serverTimestamp,
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';

// ─── Fetch videos with optional filters ──────────────────────────
export async function fetchVideos({ topic = null, pageSize = 20, lastDoc = null } = {}) {
  let q = query(
    collection(db, COLLECTIONS.VIDEOS),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  if (topic && topic !== 'all') {
    q = query(
      collection(db, COLLECTIONS.VIDEOS),
      where('topics', 'array-contains', topic),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
  }

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snap = await getDocs(q);
  return {
    videos:  snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

// ─── Fetch single video ───────────────────────────────────────────
export async function fetchVideo(videoId) {
  const snap = await getDoc(doc(db, COLLECTIONS.VIDEOS, videoId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ─── Track video view ─────────────────────────────────────────────
export async function trackVideoView(videoId, userId) {
  try {
    await updateDoc(doc(db, COLLECTIONS.VIDEOS, videoId), {
      viewCount: increment(1),
    });
  } catch (e) {
    // Non-critical — don't throw
    console.warn('trackVideoView:', e);
  }
}

// ─── Search videos ────────────────────────────────────────────────
// Note: For full-text search, integrate Algolia or Firebase Extensions.
// This is a basic title-based search using Firestore.
export async function searchVideos(searchTerm) {
  if (!searchTerm?.trim()) return [];

  const term = searchTerm.toLowerCase().trim();
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.VIDEOS), orderBy('createdAt', 'desc'), limit(100))
  );

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(v =>
      v.title?.toLowerCase().includes(term) ||
      v.description?.toLowerCase().includes(term) ||
      v.topics?.some(t => t.includes(term))
    );
}

// ─── Get Mux playback URL ─────────────────────────────────────────
// Mux playback IDs are stored on each video document.
export function getMuxPlaybackUrl(playbackId, quality = 'high') {
  if (!playbackId) return null;
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

export function getMuxThumbnailUrl(playbackId, time = 0) {
  if (!playbackId) return null;
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`;
}

export default {
  fetchVideos,
  fetchVideo,
  trackVideoView,
  searchVideos,
  getMuxPlaybackUrl,
  getMuxThumbnailUrl,
};
