/**
 * Video Service — Mux Integration
 * Handles video playback, view tracking, and search.
 */

import {
  collection, query, orderBy, where, limit,
  getDocs, getDoc, doc, updateDoc, increment,
  startAfter, serverTimestamp,
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase.client';

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
  const now = new Date();
  const videos = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(v => {
      if (v.publishStatus !== 'scheduled') return true;
      return v.scheduledPublishAt && new Date(v.scheduledPublishAt) <= now;
    });
  return {
    videos,
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
// Returns true if the increment succeeded, false otherwise.
export async function trackVideoView(videoId, userId) {
  try {
    await updateDoc(doc(db, COLLECTIONS.VIDEOS, videoId), {
      viewCount: increment(1),
    });
    return true;
  } catch (e) {
    // Non-critical — don't throw
    console.warn('trackVideoView:', e);
    return false;
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

  const now = new Date();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(v => {
      if (v.publishStatus === 'scheduled') {
        if (!v.scheduledPublishAt || new Date(v.scheduledPublishAt) > now) return false;
      }
      return (
        v.title?.toLowerCase().includes(term) ||
        v.description?.toLowerCase().includes(term) ||
        v.topics?.some(t => t.includes(term))
      );
    });
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

// ─── YouTube helpers ──────────────────────────────────────────────
// Extracts the video ID from any standard YouTube URL format.
export function getYoutubeVideoId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function getYoutubeThumbnailUrl(videoId) {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function getYoutubeEmbedUrl(videoId) {
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
}

// ─── Get thumbnail URL for any video type ────────────────────────
export function getVideoThumbnailUrl(video) {
  if (!video) return null;
  if (video.videoType === 'youtube') return getYoutubeThumbnailUrl(video.youtubeVideoId);
  return getMuxThumbnailUrl(video.muxPlaybackId);
}

export default {
  fetchVideos,
  fetchVideo,
  trackVideoView,
  searchVideos,
  getMuxPlaybackUrl,
  getMuxThumbnailUrl,
  getYoutubeVideoId,
  getYoutubeThumbnailUrl,
  getYoutubeEmbedUrl,
  getVideoThumbnailUrl,
};
