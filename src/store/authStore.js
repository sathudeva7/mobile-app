/**
 * Auth Store — Zustand
 * Manages authentication state, user profile, and session.
 */

import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, COLLECTIONS } from '../services/firebase.client';
import { hasGoogleSignInConfig } from '../config';

// expo-auth-session works in Expo Go — available whenever client IDs are configured
export const isGoogleSignInAvailable = hasGoogleSignInConfig();

const useAuthStore = create((set, get) => ({
  // ─── State ──────────────────────────────────────────────────────
  user:                    null,
  isLoggedIn:              false,
  hasCompletedOnboarding:  false,
  hasCompletedNatureQuiz:  false,
  isLoading:               false,
  error:                   null,

  // ─── Initialize auth listener ────────────────────────────────────
  initAuth: () => {
    if (!auth) return; // Firebase not configured (no .env or init failed)
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await get().fetchUserProfile(firebaseUser.uid);
        set({
          isLoggedIn:             true,
          hasCompletedOnboarding: profile?.hasCompletedOnboarding ?? false,
          hasCompletedNatureQuiz: profile?.hasCompletedNatureQuiz ?? false,
        });
      } else {
        set({ user: null, isLoggedIn: false });
      }
    });
  },

  // ─── Fetch user profile from Firestore ──────────────────────────
  fetchUserProfile: async (uid) => {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
      if (snap.exists()) {
        const profile = { uid, ...snap.data() };
        set({ user: profile });
        return profile;
      }
    } catch (e) {
      console.error('fetchUserProfile error:', e);
    }
    return null;
  },

  // ─── Sign in with Google ─────────────────────────────────────────
  signInWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      await GoogleSignin.hasPlayServices();
      const { idToken } = await GoogleSignin.signIn();
      const credential  = GoogleAuthProvider.credential(idToken);
      const result      = await signInWithCredential(auth, credential);
      await get().ensureUserProfile(result.user);
      set({ isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e.message });
    }
  },

  // ─── Sign in with email/password ─────────────────────────────────
  signInWithEmail: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await get().ensureUserProfile(result.user);
      set({ isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e.message });
    }
  },

  // ─── Create account with email/password ──────────────────────────
  signUpWithEmail: async (email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await get().createUserProfile(result.user, { displayName });
      set({ isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e.message });
    }
  },

  // ─── Ensure user profile exists (create if first time) ───────────
  ensureUserProfile: async (firebaseUser) => {
    const ref  = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await get().createUserProfile(firebaseUser, {});
    } else {
      set({ user: { uid: firebaseUser.uid, ...snap.data() } });
    }
  },

  // ─── Create new user profile in Firestore ────────────────────────
  createUserProfile: async (firebaseUser, extra = {}) => {
    if (!db) return;
    const profile = {
      uid:                    firebaseUser.uid,
      email:                  firebaseUser.email,
      displayName:            extra.displayName || firebaseUser.displayName || '',
      photoURL:               firebaseUser.photoURL || null,
      phoneNumber:            null,
      hebrewName:             null,         // "Moshe ben Avraham"
      mothersName:            null,         // For prayer requests
      membershipTier:         'free',       // free | premium
      hasCompletedOnboarding: false,
      hasCompletedNatureQuiz: false,
      personalityType:        null,         // e.g. "The Seeker"
      mbtiType:               null,         // e.g. "INFJ"
      enneagramType:          null,         // e.g. "Type 4"
      humanDesignType:        null,
      faceReadingData:        null,
      handReadingData:        null,
      streakCount:            0,
      lastActiveDate:         null,
      createdAt:              serverTimestamp(),
      updatedAt:              serverTimestamp(),
    };
    await setDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), profile);
    set({ user: profile });
  },

  // ─── Update user profile ─────────────────────────────────────────
  updateProfile: async (updates) => {
    const { user } = get();
    const uid = user?.uid || auth?.currentUser?.uid;
    if (!uid) return { ok: false, error: 'You are not logged in.' };
    if (!db)  return { ok: false, error: 'Database not connected. Check your Firebase config.' };
    try {
      await setDoc(doc(db, COLLECTIONS.USERS, uid), {
        ...updates,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      set({ user: { ...(user || {}), uid, ...updates } });
      return { ok: true };
    } catch (e) {
      console.error('updateProfile error:', e.code, e.message);
      return { ok: false, error: `${e.code ?? ''}: ${e.message}` };
    }
  },

  // ─── Complete onboarding ─────────────────────────────────────────
  completeOnboarding: async () => {
    await get().updateProfile({ hasCompletedOnboarding: true });
    set({ hasCompletedOnboarding: true });
  },

  // ─── Complete nature quiz ────────────────────────────────────────
  completeNatureQuiz: async (results) => {
    await get().updateProfile({
      hasCompletedNatureQuiz: true,
      personalityType:   results.personalityType,
      mbtiType:          results.mbtiType,
      enneagramType:     results.enneagramType,
      humanDesignType:   results.humanDesignType,
      faceReadingData:   results.faceReadingData || null,
      handReadingData:   results.handReadingData || null,
    });
    set({ hasCompletedNatureQuiz: true });
  },

  // ─── Sign out ────────────────────────────────────────────────────
  signOut: async () => {
    if (auth) await firebaseSignOut(auth);
    set({ user: null, isLoggedIn: false, hasCompletedOnboarding: false });
  },

  clearError: () => set({ error: null }),
}));

export { useAuthStore };
