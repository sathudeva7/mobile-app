/**
 * SignUpScreen
 * Create new account with email/password or Google.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { googleSignIn } from '../../config';

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen({ navigation }) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const { signUpWithEmail, signInWithGoogle, isLoading, error, clearError, isGoogleSignInAvailable } = useAuthStore();

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

  const handleSignUp = async () => {
    if (!name.trim())     return Alert.alert('Missing', 'Please enter your name.');
    if (!email.trim())    return Alert.alert('Missing', 'Please enter your email.');
    if (password.length < 6) return Alert.alert('Weak password', 'Password must be at least 6 characters.');
    if (password !== confirm) return Alert.alert('Mismatch', 'Passwords do not match.');

    clearError();
    await signUpWithEmail(email, password, name);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerFlame}>🔥</Text>
            <Text style={styles.headerTitle}>Join Rivnitz</Text>
            <Text style={styles.headerSub}>Begin your journey of miracles through mission</Text>
          </View>

          <View style={styles.form}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Google — hidden in Expo Go (requires dev build) */}
            {isGoogleSignInAvailable && (
              <>
                <TouchableOpacity style={styles.googleBtn} onPress={() => { clearError(); promptGoogleAsync(); }} disabled={isLoading}>
                  <View style={styles.googleIcon}><Text style={styles.googleIconText}>G</Text></View>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </TouchableOpacity>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or create account</Text>
                  <View style={styles.dividerLine} />
                </View>
              </>
            )}

            <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} autoCapitalize="words" />
            <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Password (min 6 characters)" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />
            <TextInput style={styles.input} placeholder="Confirm password" placeholderTextColor={Colors.textMuted} value={confirm} onChangeText={setConfirm} secureTextEntry />

            <TouchableOpacity
              style={[styles.signUpBtn, isLoading && styles.btnDisabled]}
              onPress={handleSignUp}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.signUpBtnText}>Create Account →</Text>
              }
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  scroll:    { flexGrow: 1 },

  header: { backgroundColor: Colors.tealDark, padding: Spacing.xl, paddingTop: 50, alignItems: 'center', gap: Spacing.xs },
  backBtn:     { position: 'absolute', top: 50, left: Spacing.base, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: Typography.sizes.xl, color: 'rgba(255,255,255,0.7)' },
  headerFlame: { fontSize: 32 },
  headerTitle: { fontFamily: Typography.heading, fontSize: Typography.sizes['3xl'], color: Colors.white },
  headerSub:   { fontSize: Typography.sizes.xs, color: Colors.goldLight, textAlign: 'center', lineHeight: 18, fontFamily: Typography.body },

  form: { flex: 1, padding: Spacing.xl, gap: Spacing.md },

  errorBox: { backgroundColor: 'rgba(224,92,92,0.1)', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(224,92,92,0.3)' },
  errorText: { fontSize: Typography.sizes.xs, color: Colors.error, fontFamily: Typography.body },

  googleBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm },
  googleIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EA4335', alignItems: 'center', justifyContent: 'center' },
  googleIconText: { color: Colors.white, fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md },
  googleBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.textPrimary },

  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: Typography.sizes.xs, color: Colors.textMuted, fontFamily: Typography.body },

  input: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, fontSize: Typography.sizes.md, color: Colors.textPrimary, fontFamily: Typography.body, borderWidth: 1, borderColor: Colors.border },

  signUpBtn: { backgroundColor: Colors.gold, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', ...Shadows.gold },
  btnDisabled: { opacity: 0.6 },
  signUpBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.white },

  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { fontSize: Typography.sizes.sm, color: Colors.textMuted, fontFamily: Typography.body },
  loginLink: { fontSize: Typography.sizes.sm, color: Colors.teal, fontFamily: Typography.bodySemiBold },
});
