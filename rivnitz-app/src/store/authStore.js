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
import { auth, db, COLLECTIONS } from '../services/firebase';
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from '@env';

// Google Sign-In requires a custom dev build (not Expo Go)
// We lazy-load it to avoid crashes in Expo Go
let GoogleSignin = null;
try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });
} catch (e) {
  console.warn('Google Sign-In not available (requires custom dev build)');
}

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
    if (!GoogleSignin) {
      set({ error: 'Google Sign-In not available in Expo Go. Use email login or build a custom dev client.' });
      return;
    }
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
    if (!user) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      set({ user: { ...user, ...updates } });
    } catch (e) {
      console.error('updateProfile error:', e);
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
      triType:           results.triType || null,
      mbtiType:          results.mbtiType,
      enneagramType:     results.enneagramType,
      headType:          results.headType || null,
      heartType:         results.heartType || null,
      gutType:           results.gutType || null,
      headSephira:       results.headSephira || null,
      heartSephira:      results.heartSephira || null,
      gutSephira:        results.gutSephira || null,
      hebrewName:        results.hebrewName || null,
      lifeMission:       results.lifeMission || null,
      humanDesignType:   results.humanDesignType || null,
      faceReadingData:   results.faceReadingData || null,
      handReadingData:   results.handReadingData || null,
    });
    set({ hasCompletedNatureQuiz: true });
  },

  // ─── Sign out ────────────────────────────────────────────────────
  signOut: async () => {
    await firebaseSignOut(auth);
    if (GoogleSignin) await GoogleSignin.signOut();
    set({ user: null, isLoggedIn: false, hasCompletedOnboarding: false });
  },

  clearError: () => set({ error: null }),
}));

export { useAuthStore };
