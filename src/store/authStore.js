/**
 * Auth Store — Zustand
 * Manages authentication state, user profile, and session.
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, COLLECTIONS } from '../services/firebase.client';
import { hasGoogleSignInConfig } from '../config';
import { registerForPushNotifications } from '../services/notifications';

// expo-auth-session works in Expo Go — available whenever client IDs are configured
export const isGoogleSignInAvailable = hasGoogleSignInConfig();

// Map Firebase Auth error codes to friendly messages
function friendlyAuthError(e) {
  switch (e?.code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/user-not-found':        return 'Incorrect email or password.';
    case 'auth/invalid-email':         return 'Please enter a valid email address.';
    case 'auth/email-already-in-use':  return 'An account with this email already exists.';
    case 'auth/weak-password':         return 'Password must be at least 6 characters.';
    case 'auth/user-disabled':         return 'This account has been disabled. Please contact support.';
    case 'auth/too-many-requests':     return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':return 'Network error. Please check your connection.';
    case 'auth/popup-closed-by-user':  return 'Sign-in was cancelled.';
    default:                           return 'Something went wrong. Please try again.';
  }
}

// Module-level singleton — stores the Firebase unsubscribe fn so that calling
// initAuth() more than once (e.g. due to StrictMode double-invoke or hot reload)
// never registers a second listener on the same auth instance.
let _unsubscribeAuth = null;

const useAuthStore = create((set, get) => ({
  // ─── State ──────────────────────────────────────────────────────
  user:                    null,
  isLoggedIn:              false,
  isEmailVerified:         false,
  isProfileLoaded:         false,
  hasCompletedOnboarding:  false,
  hasCompletedNatureQuiz:  false,
  hasCompletedAssessment:  false,
  isLoading:               false,
  error:                   null,

  // ─── Initialize auth listener ────────────────────────────────────
  initAuth: () => {
    if (!auth) return;
    // Guard: if a listener is already registered, don't add another one
    if (_unsubscribeAuth) return;
    _unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Set navigation state IMMEDIATELY using Firebase Auth's own data.
        // Do NOT await Firestore here — a slow/uninitialized Firestore would
        // block this callback and the screen would never navigate.
        set({
          isLoggedIn:      true,
          isEmailVerified: firebaseUser.emailVerified,
        });

        // Load Firestore profile in background to fill in the rest of the state.
        get().fetchUserProfile(firebaseUser.uid).then(profile => {
          const isEmailVerified =
            firebaseUser.emailVerified ||
            (profile !== null && profile?.emailVerified !== false);

          set({
            isEmailVerified,
            isProfileLoaded:        true,
            hasCompletedOnboarding: profile?.hasCompletedOnboarding ?? false,
            hasCompletedNatureQuiz: profile?.hasCompletedNatureQuiz ?? false,
            hasCompletedAssessment: profile?.hasCompletedAssessment ?? false,
          });

          // Sync Firestore if Firebase Auth shows the user just verified
          if (firebaseUser.emailVerified && profile?.emailVerified === false && db) {
            updateDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), {
              emailVerified: true,
            }).catch(e => console.warn('emailVerified sync failed:', e));
          }
        }).catch(() => {
          // Even if profile load fails, unblock navigation
          set({ isProfileLoaded: true });
        });

        if (db) {
          updateDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), {
            lastActiveDate: serverTimestamp(),
          }).catch(e => console.warn('lastActiveDate update failed:', e));
        }

        registerForPushNotifications(firebaseUser.uid).catch(e =>
          console.warn('Push notification registration failed:', e)
        );
      } else {
        set({ user: null, isLoggedIn: false, isEmailVerified: false });
      }
    });
  },

  // ─── Tear down auth listener (used in tests / full sign-out) ────
  destroyAuth: () => {
    if (_unsubscribeAuth) {
      _unsubscribeAuth();
      _unsubscribeAuth = null;
    }
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

  // ─── Sign in with Google (native SDK) ────────────────────────────
  signInWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      // hasPlayServices is Android-only — skip on iOS
      if (Platform.OS !== 'ios') {
        await GoogleSignin.hasPlayServices();
      }
      const userInfo   = await GoogleSignin.signIn();
      const idToken    = userInfo.data?.idToken ?? userInfo.idToken;
      if (!idToken) throw new Error('No ID token received from Google.');
      const credential = GoogleAuthProvider.credential(idToken);
      const result     = await signInWithCredential(auth, credential);
      await get().ensureUserProfile(result.user);
      set({ isLoading: false });
    } catch (e) {
      // User cancelled — don't show an error
      if (e?.code === statusCodes.SIGN_IN_CANCELLED) {
        set({ isLoading: false });
        return;
      }
      set({ isLoading: false, error: friendlyAuthError(e) });
    }
  },

  // ─── Sign in with Apple ───────────────────────────────────────────
  signInWithApple: async () => {
    set({ isLoading: true, error: null });
    try {
      // Generate a random nonce and its SHA256 hash
      const rawNonce = Array.from(
        await Crypto.getRandomBytesAsync(32),
        b => b.toString(16).padStart(2, '0')
      ).join('');
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const provider = new OAuthProvider('apple.com');
      const oauthCredential = provider.credential({
        idToken: credential.identityToken,
        rawNonce,
      });

      const result = await signInWithCredential(auth, oauthCredential);

      // Apple only sends fullName on the very first sign-in — save it immediately
      const fullName = credential.fullName;
      const displayName = fullName
        ? [fullName.givenName, fullName.familyName].filter(Boolean).join(' ')
        : result.user.displayName || '';

      await get().ensureUserProfile({ ...result.user, displayName });
      set({ isLoading: false });
    } catch (e) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        set({ isLoading: false });
        return;
      }
      set({ isLoading: false, error: 'Apple Sign-In failed. Please try again.' });
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
      set({ isLoading: false, error: friendlyAuthError(e) });
    }
  },

  // ─── Create account with email/password ──────────────────────────
  signUpWithEmail: async (email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);

      // Navigate immediately — don't wait for onAuthStateChanged's Firestore read.
      // Set a minimal user object so screens that read user.email / user.uid work.
      set({
        isLoggedIn:      true,
        isEmailVerified: false,
        isProfileLoaded: true,
        isLoading:       false,
        user: { uid: result.user.uid, email: result.user.email, displayName },
      });

      // Create Firestore profile and send verification email — non-fatal.
      // Must not throw here or the catch block below would reset isLoggedIn.
      get().createUserProfile(result.user, { displayName })
        .catch(e => console.warn('createUserProfile error:', e));
      sendEmailVerification(result.user)
        .catch(e => console.warn('sendEmailVerification error:', e));
    } catch (e) {
      // Only createUserWithEmailAndPassword errors reach here.
      set({ isLoading: false, isLoggedIn: false, error: friendlyAuthError(e) });
    }
  },

  // ─── Resend verification email ────────────────────────────────────
  resendVerificationEmail: async () => {
    set({ isLoading: true, error: null });
    try {
      if (!auth?.currentUser) throw new Error('No user signed in.');
      await sendEmailVerification(auth.currentUser);
      set({ isLoading: false });
      return { sent: true };
    } catch (e) {
      const msg = e?.message || 'Failed to resend verification email.';
      set({ isLoading: false, error: msg });
      return { sent: false, error: msg };
    }
  },

  // ─── Check if the user has clicked the verification link ─────────
  // Call this when the user taps "I've verified my email" or on auto-poll.
  checkEmailVerification: async () => {
    try {
      if (!auth?.currentUser) return false;

      // Reload the Firebase Auth user to get the latest emailVerified status
      await auth.currentUser.reload();

      if (auth.currentUser.emailVerified) {
        const uid = auth.currentUser.uid;

        // Update Firestore profile
        if (db) {
          await updateDoc(doc(db, COLLECTIONS.USERS, uid), { emailVerified: true });
        }

        const { user } = get();
        set({
          isEmailVerified: true,
          user: user ? { ...user, emailVerified: true } : user,
        });
        return true;
      }
      return false;
    } catch (e) {
      console.warn('checkEmailVerification error:', e);
      return false;
    }
  },

  // ─── Ensure user profile exists (create if first time) ───────────
  ensureUserProfile: async (firebaseUser) => {
    const ref  = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await get().createUserProfile(firebaseUser, { displayName: firebaseUser.displayName });
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
      hebrewName:             null,
      mothersName:            null,
      membershipTier:          'free',
      emailVerified:           false,         // must verify before accessing app
      hasCompletedOnboarding:  false,
      hasCompletedNatureQuiz:  false,
      hasCompletedAssessment:  false,
      personalityType:         null,
      mbtiType:                null,
      enneagramType:           null,
      enneagramSubtype:        null,          // e.g. "sp/sx" (self-pres/sexual)
      zodiacSign:              null,
      dateOfBirth:             null,
      humanDesignType:         null,
      faceReadingInsights:     null,
      handReadingInsights:     null,
      photoUrls:               null,          // { face, rightHand, leftHand }
      streakCount:             0,
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
  completeOnboarding: () => {
    const state = get();
   
    // Set state immediately so navigation switches without waiting for Firestore
    set({ hasCompletedOnboarding: true });

    get().updateProfile({ hasCompletedOnboarding: true })
      .then(res => console.log('[completeOnboarding] Firestore save result:', JSON.stringify(res)))
      .catch(e => console.warn('[completeOnboarding] Firestore save error:', e));
  },

  // ─── Complete nature quiz (Tri-Type) ────────────────────────────
  completeNatureQuiz: async (results) => {
    await get().updateProfile({
      hasCompletedNatureQuiz: true,
      hasCompletedAssessment: true,
      // Tri-type fields
      tritypeCode:     results.tritypeCode    || null,
      headType:        results.headType       || null,
      heartType:       results.heartType      || null,
      gutType:         results.gutType        || null,
      headSephira:     results.headSephira    || null,
      heartSephira:    results.heartSephira   || null,
      gutSephira:      results.gutSephira     || null,
      archetypeEn:     results.archetypeEn    || null,
      archetypeHe:     results.archetypeHe    || null,
      lifeMissionEn:   results.lifeMissionEn  || null,
      coreFears:       results.coreFears      || null,
      blindSpot:       results.blindSpot      || null,
      isCounterphobic: results.isCounterphobic ?? false,
      personalityType: results.personalityType || results.archetypeEn || null,
      // Enneagram + MBTI + Zodiac (collected at end of quiz)
      enneagramType:   results.enneagramType  || null,
      mbtiType:        results.mbtiType       || null,
      zodiacSign:      results.zodiacSign     || null,
      dateOfBirth:     results.dateOfBirth    || null,
    });
    set({ hasCompletedNatureQuiz: true, hasCompletedAssessment: true });
  },

  // ─── Complete photo reading (face + hand insights + photo URLs) ─
  completePhotoReading: async ({ photoUrls, faceReadingInsights, handReadingInsights }) => {
    await get().updateProfile({ photoUrls, faceReadingInsights, handReadingInsights });
  },

  // ─── Complete AI assessment (Enneagram + MBTI + Zodiac) ─────────
  completeAIAssessment: async (results) => {
    await get().updateProfile({
      hasCompletedAssessment: true,
      enneagramType:  results.enneagramType  || null,
      mbtiType:       results.mbtiType       || null,
      zodiacSign:     results.zodiacSign     || null,
      dateOfBirth:    results.dateOfBirth    || null,
    });
    set({ hasCompletedAssessment: true });
  },

  // ─── Reset quiz (DEV / testing only) ────────────────────────────
  resetQuiz: async () => {
    await get().updateProfile({
      hasCompletedNatureQuiz: false,
      tritypeCode: null, headType: null, heartType: null, gutType: null,
      headSephira: null, heartSephira: null, gutSephira: null,
      archetypeEn: null, archetypeHe: null, lifeMissionEn: null,
      coreFears: null, blindSpot: null, isCounterphobic: false,
      personalityType: null, enneagramType: null, mbtiType: null,
      zodiacSign: null, dateOfBirth: null,
      hasCompletedAssessment: false,
    });
    set({ hasCompletedNatureQuiz: false, hasCompletedAssessment: false });
  },

  // ─── Sign out ────────────────────────────────────────────────────
  signOut: async () => {
    if (auth) await firebaseSignOut(auth);
    set({ user: null, isLoggedIn: false, isEmailVerified: false, isProfileLoaded: false, hasCompletedOnboarding: false });
  },

  clearError: () => set({ error: null }),
}));

export { useAuthStore };
