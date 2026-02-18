/**
 * LoginScreen
 * Entry point — Google sign-in or email/password.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Colors, Typography, Spacing, Radius, Gradients, Shadows } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { googleSignIn } from '../../config';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const { signInWithGoogle, signInWithEmail, isLoading, error, clearError, isGoogleSignInAvailable } = useAuthStore();

  const [, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    webClientId:     googleSignIn.webClientId,
    iosClientId:     googleSignIn.iosClientId,
    androidClientId: googleSignIn.androidClientId,
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.authentication?.idToken;
      if (idToken) signInWithGoogle(idToken);
    }
  }, [googleResponse]);

  const handleGoogleSignIn = async () => {
    clearError();
    await promptGoogleAsync();
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing Info', 'Please enter your email and password.');
      return;
    }
    clearError();
    await signInWithEmail(email, password);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <LinearGradient
            colors={Gradients.teal}
            style={styles.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.heroFlame}>🔥</Text>
            <Text style={styles.heroTitle}>Rivnitz</Text>
            <Text style={styles.heroTagline}>Miracles Through Mission</Text>
            <Text style={styles.heroSub}>
              Join a sacred community of{'\n'}guidance, healing & blessing
            </Text>
          </LinearGradient>

          {/* Login form */}
          <View style={styles.form}>
            {/* Error */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Google — hidden in Expo Go (requires dev build) */}
            {isGoogleSignInAvailable && (
              <>
                <TouchableOpacity
                  style={styles.googleBtn}
                  onPress={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <View style={styles.googleIcon}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </TouchableOpacity>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
              </>
            )}

            {/* Email */}
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Password */}
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {/* Sign in button */}
            <TouchableOpacity
              style={[styles.signInBtn, isLoading && styles.signInBtnDisabled]}
              onPress={handleEmailSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.signInBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Forgot password */}
            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign up link */}
            <View style={styles.signUpRow}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Free membership note */}
            <View style={styles.freeNote}>
              <Text style={styles.freeNoteIcon}>♥</Text>
              <View>
                <Text style={styles.freeNoteTitle}>Free to join</Text>
                <Text style={styles.freeNoteSub}>
                  Basic membership includes daily videos & community
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  scroll: {
    flexGrow: 1,
  },

  // Hero
  hero: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center',
  },
  heroFlame: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes['4xl'],
    color: Colors.white,
    letterSpacing: 1,
  },
  heroTagline: {
    fontSize: Typography.sizes.sm,
    color: Colors.goldLight,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  heroSub: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.md,
  },

  // Form
  form: {
    flex: 1,
    backgroundColor: Colors.cream,
    padding: Spacing.xl,
    gap: Spacing.md,
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(224,92,92,0.1)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.3)',
  },
  errorText: {
    fontSize: Typography.sizes.sm,
    color: Colors.error,
    fontFamily: Typography.body,
  },

  // Google button
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  googleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EA4335',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    color: Colors.white,
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.md,
  },
  googleBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.md,
    color: Colors.textPrimary,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
  },

  // Inputs
  input: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: Typography.sizes.md,
    color: Colors.textPrimary,
    fontFamily: Typography.body,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Sign in button
  signInBtn: {
    backgroundColor: Colors.teal,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.md,
  },
  signInBtnDisabled: {
    opacity: 0.6,
  },
  signInBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.md,
    color: Colors.white,
  },

  // Forgot
  forgotBtn: {
    alignItems: 'center',
  },
  forgotText: {
    fontSize: Typography.sizes.sm,
    color: Colors.teal,
    fontFamily: Typography.body,
  },

  // Sign up
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontFamily: Typography.body,
  },
  signUpLink: {
    fontSize: Typography.sizes.sm,
    color: Colors.teal,
    fontFamily: Typography.bodySemiBold,
  },

  // Free note
  freeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.2)',
    marginTop: Spacing.xs,
  },
  freeNoteIcon: {
    fontSize: 18,
    color: Colors.gold,
  },
  freeNoteTitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.gold,
    fontFamily: Typography.bodySemiBold,
  },
  freeNoteSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    marginTop: 2,
  },
});
