/**
 * EmailVerificationScreen
 * Shows after sign-up. Prompts the user to click the verification
 * link Firebase sent to their email. Auto-polls every 4 seconds.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import { useAuthStore } from '../../store/authStore';

export default function EmailVerificationScreen() {
  // Start at 0 so timer does NOT run on app reopen — only starts after
  // the user taps "Resend email" in the current session.
  const [countdown,  setCountdown]  = useState(0);
  const [checking,   setChecking]   = useState(false);
  const [resendMsg,  setResendMsg]  = useState('');

  const {
    user,
    checkEmailVerification,
    resendVerificationEmail,
    signOut,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  // ─── Auto-poll every 4 seconds ────────────────────────────────────
  // When the user clicks the link in their email, Firebase marks them
  // verified. The next poll picks it up and navigation switches automatically.
  useEffect(() => {
    const poll = setInterval(async () => {
      await checkEmailVerification();
    }, 4000);
    return () => clearInterval(poll);
  }, []);

  // ─── Countdown timer — only active when countdown > 0 ────────────
  // Only runs after the user explicitly taps "Resend email", not on mount.
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const handleCheckNow = useCallback(async () => {
    setChecking(true);
    const verified = await checkEmailVerification();
    setChecking(false);
    if (!verified) {
      Alert.alert(
        'Not verified yet',
        'We couldn\'t detect a verification yet. Please check your email and tap the link, then try again.',
        [{ text: 'OK' }]
      );
    }
  }, [checkEmailVerification]);

  const handleResend = async () => {
    if (countdown > 0) return;
    clearError();
    setResendMsg('');
    const result = await resendVerificationEmail();
    if (result.sent) {
      setResendMsg('Verification email resent. Check your inbox.');
      setCountdown(60); // start 60s cooldown only after a resend
    }
  };

  // ─── Back / wrong email ───────────────────────────────────────────
  // Signs the user out, which causes RootNavigator to switch back to
  // AuthStack automatically so they can sign up with the correct email.
  const handleBack = () => {
    Alert.alert(
      'Use a different email?',
      'This will sign you out and take you back to the sign-up screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Go Back',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header ───────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* Back button — top left */}
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>

          <Image source={require('../../../assets/icon.png')} style={styles.headerLogo} />
          <Text style={styles.headerTitle}>Verify Your Email</Text>
          <Text style={styles.headerSub}>One last step before your journey begins</Text>
        </View>

        {/* ─── Body ─────────────────────────────────────────────── */}
        <View style={styles.body}>

          {/* Envelope illustration */}
          <View style={styles.envelope}>
            <Text style={styles.envelopeIcon}>✉️</Text>
          </View>

          <Text style={styles.instruction}>
            We sent a verification link to
          </Text>
          <Text style={styles.email}>
            {user?.email || 'your email address'}
          </Text>
          <Text style={styles.sub}>
            Open the email and tap the link to verify your account.
            This page will update automatically once you're verified.
          </Text>

          {/* Wrong email hint */}
          <TouchableOpacity onPress={handleBack} style={styles.wrongEmailBtn}>
            <Text style={styles.wrongEmailText}>Wrong email address? Go back →</Text>
          </TouchableOpacity>

          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Resend confirmation */}
          {!!resendMsg && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{resendMsg}</Text>
            </View>
          )}

          {/* Auto-poll indicator — only shows while polling is active */}
          <View style={styles.pollingRow}>
            <ActivityIndicator size="small" color={Colors.teal} />
            <Text style={styles.pollingText}>Checking automatically every few seconds…</Text>
          </View>

          {/* Manual check button */}
          <TouchableOpacity
            style={[styles.checkBtn, (checking || isLoading) && styles.btnDisabled]}
            onPress={handleCheckNow}
            disabled={checking || isLoading}
          >
            {checking
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.checkBtnText}>I've Verified My Email →</Text>
            }
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn't get the email? </Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={countdown > 0 || isLoading}
            >
              <Text style={[
                styles.resendLink,
                countdown > 0 && styles.resendLinkDisabled,
              ]}>
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend email'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            Check your spam folder if you don't see it in your inbox.{'\n'}
            The link expires in 24 hours.
          </Text>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  scroll:    { flexGrow: 1 },

  // Header
  header: {
    backgroundColor: Colors.tealDark,
    padding:         Spacing.xl,
    paddingTop:      50,
    alignItems:      'center',
    gap:             Spacing.xs,
  },
  backBtn: {
    position:  'absolute',
    top:       50,
    left:      Spacing.base,
    width:     36,
    height:    36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize:  Typography.sizes.xl,
    color:     'rgba(255,255,255,0.8)',
  },
  headerLogo: {
    width:       52,
    height:      52,
    resizeMode:  'contain',
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize:   Typography.sizes['3xl'],
    color:      Colors.white,
  },
  headerSub: {
    fontSize:   Typography.sizes.xs,
    color:      Colors.goldLight,
    fontFamily: Typography.body,
    textAlign:  'center',
  },

  // Body
  body: {
    flex:       1,
    padding:    Spacing.xl,
    alignItems: 'center',
    gap:        Spacing.md,
  },

  envelope: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: Colors.white,
    alignItems:      'center',
    justifyContent:  'center',
    marginVertical:  Spacing.md,
    ...Shadows.sm,
  },
  envelopeIcon: { fontSize: 36 },

  instruction: {
    fontSize:   Typography.sizes.md,
    color:      Colors.textMuted,
    fontFamily: Typography.body,
    textAlign:  'center',
  },
  email: {
    fontSize:   Typography.sizes.lg,
    color:      Colors.tealDark,
    fontFamily: Typography.bodySemiBold,
    textAlign:  'center',
  },
  sub: {
    fontSize:   Typography.sizes.sm,
    color:      Colors.textMuted,
    fontFamily: Typography.body,
    textAlign:  'center',
    lineHeight: 20,
    marginTop:  Spacing.xs,
  },

  wrongEmailBtn: {
    marginTop: Spacing.xs,
  },
  wrongEmailText: {
    fontSize:   Typography.sizes.sm,
    color:      Colors.gold,
    fontFamily: Typography.bodySemiBold,
    textAlign:  'center',
  },

  errorBox: {
    backgroundColor: 'rgba(224,92,92,0.1)',
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    borderWidth:     1,
    borderColor:     'rgba(224,92,92,0.3)',
    width:           '100%',
  },
  errorText: {
    fontSize:   Typography.sizes.sm,
    color:      Colors.error,
    fontFamily: Typography.body,
    textAlign:  'center',
  },

  successBox: {
    backgroundColor: 'rgba(26,92,82,0.08)',
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    borderWidth:     1,
    borderColor:     'rgba(26,92,82,0.2)',
    width:           '100%',
  },
  successText: {
    fontSize:   Typography.sizes.sm,
    color:      Colors.teal,
    fontFamily: Typography.body,
    textAlign:  'center',
  },

  pollingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
    marginTop:     Spacing.xs,
  },
  pollingText: {
    fontSize:   Typography.sizes.xs,
    color:      Colors.textMuted,
    fontFamily: Typography.body,
    flexShrink: 1,
  },

  // Check button
  checkBtn: {
    backgroundColor: Colors.gold,
    borderRadius:    Radius.lg,
    padding:         Spacing.md,
    alignItems:      'center',
    width:           '100%',
    ...Shadows.gold,
  },
  btnDisabled: { opacity: 0.5 },
  checkBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize:   Typography.sizes.md,
    color:      Colors.white,
  },

  // Resend
  resendRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  resendText: {
    fontSize:   Typography.sizes.sm,
    color:      Colors.textMuted,
    fontFamily: Typography.body,
  },
  resendLink: {
    fontSize:   Typography.sizes.sm,
    color:      Colors.teal,
    fontFamily: Typography.bodySemiBold,
  },
  resendLinkDisabled: {
    color: Colors.textMuted,
  },

  hint: {
    fontSize:   Typography.sizes.xs,
    color:      Colors.textMuted,
    fontFamily: Typography.body,
    textAlign:  'center',
    lineHeight: 18,
  },
});
