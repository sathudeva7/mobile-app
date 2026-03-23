/**
 * SignUpScreen — Create new account with email/password or Google.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import { useAuthStore, isGoogleSignInAvailable } from '../../store/authStore';

// ─── Ornamental horizontal rule ───────────────────────────────────
const OrnamentalRule = ({ label }) => (
  <View style={or.row}>
    <View style={or.line} />
    {label
      ? <Text style={or.label}>{label}</Text>
      : <Text style={or.glyph}>✦</Text>
    }
    <View style={or.line} />
  </View>
);

const or = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  line:  { flex: 1, height: 1, backgroundColor: 'rgba(27,107,107,0.15)' },
  glyph: { fontSize: 10, color: Colors.gold },
  label: { fontSize: 9, color: Colors.textMuted, fontFamily: Typography.body, letterSpacing: 1.5 },
});

// ─── Underline form field ─────────────────────────────────────────
const FormField = ({ label, error, ...inputProps }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={ff.wrapper}>
      <Text style={[ff.label, focused && ff.labelFocused]}>{label}</Text>
      <TextInput
        style={ff.input}
        placeholderTextColor="transparent"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...inputProps}
      />
      <View style={[ff.line, focused && ff.lineFocused, error && ff.lineError]} />
      {error ? <Text style={ff.error}>{error}</Text> : null}
    </View>
  );
};

const ff = StyleSheet.create({
  wrapper: { gap: 2 },
  label: {
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.teal,
    fontFamily: Typography.bodyMedium,
    textTransform: 'uppercase',
  },
  labelFocused: { color: Colors.gold },
  input: {
    backgroundColor: 'transparent',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: 0,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontFamily: Typography.body,
  },
  line:        { height: 1,   backgroundColor: 'rgba(27,107,107,0.2)' },
  lineFocused: { height: 1.5, backgroundColor: Colors.gold },
  lineError:   { backgroundColor: Colors.error },
  error: {
    fontSize: Typography.sizes.xs,
    color: Colors.error,
    fontFamily: Typography.body,
    marginTop: 4,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────
export default function SignUpScreen({ navigation }) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');

  const [nameError,     setNameError]     = useState('');
  const [emailError,    setEmailError]    = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError,  setConfirmError]  = useState('');

  const { signUpWithEmail, signInWithGoogle, isLoading, error, clearError } = useAuthStore();

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(180, [
      Animated.timing(headerAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(formAnim,   { toValue: 1, duration: 550, useNativeDriver: true }),
    ]).start();
  }, []);

  const headerStyle = {
    opacity: headerAnim,
    transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  };
  const formStyle = {
    opacity: formAnim,
    transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  };

  const handleSignUp = async () => {
    let valid = true;
    if (!name.trim())       { setNameError('Please enter your name.');                    valid = false; } else { setNameError(''); }
    if (!email.trim())      { setEmailError('Please enter your email.');                  valid = false; } else { setEmailError(''); }
    if (password.length < 6){ setPasswordError('Password must be at least 6 characters.'); valid = false; } else { setPasswordError(''); }
    if (password !== confirm){ setConfirmError('Passwords do not match.');                valid = false; } else { setConfirmError(''); }
    if (!valid) return;
    clearError();
    await signUpWithEmail(email, password, name);
    navigation.navigate('EmailVerification');
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ──────────────────────────────────────────── */}
          <Animated.View style={[s.header, headerStyle]}>

            {/* Back button */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={s.backBtn}
              activeOpacity={0.6}
            >
              <Text style={s.backArrow}>←</Text>
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>

            {/* Logo with gold aura ring */}
            <View style={s.iconRing}>
              <Image source={require('../../../assets/icon.png')} style={s.icon} />
            </View>

            {/* Headline */}
            <Text style={s.headline}>Begin Your{'\n'}Journey</Text>

            {/* Ornamental divider */}
            <View style={s.ornamentRow}>
              <View style={s.ornamentLine} />
              <Text style={s.ornamentGlyph}>✦</Text>
              <View style={s.ornamentLine} />
            </View>

            <Text style={s.subHeadline}>Join the Rivnitz Community</Text>
          </Animated.View>

          {/* ── Form ────────────────────────────────────────────── */}
          <Animated.View style={[s.form, formStyle]}>

            {/* Firebase auth error */}
            {error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>✦  {error}</Text>
              </View>
            )}

            {/* Google */}
            {isGoogleSignInAvailable && (
              <>
                <TouchableOpacity
                  style={s.googleBtn}
                  onPress={() => { clearError(); signInWithGoogle(); }}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <View style={s.googleLogoRing}>
                    <Text style={s.googleG}>G</Text>
                  </View>
                  <Text style={s.googleBtnText}>Continue with Google</Text>
                </TouchableOpacity>
                <OrnamentalRule label="OR CREATE ACCOUNT" />
              </>
            )}

            {/* Full name */}
            <FormField
              label="Full name"
              error={nameError}
              value={name}
              onChangeText={t => { setName(t); if (nameError) setNameError(''); }}
              autoCapitalize="words"
            />

            {/* Email */}
            <FormField
              label="Email address"
              error={emailError}
              value={email}
              onChangeText={t => { setEmail(t); if (emailError) setEmailError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Password */}
            <FormField
              label="Password — min 6 characters"
              error={passwordError}
              value={password}
              onChangeText={t => { setPassword(t); if (passwordError) setPasswordError(''); }}
              secureTextEntry
            />

            {/* Confirm password */}
            <FormField
              label="Confirm password"
              error={confirmError}
              value={confirm}
              onChangeText={t => { setConfirm(t); if (confirmError) setConfirmError(''); }}
              secureTextEntry
            />

            {/* Create account CTA */}
            <TouchableOpacity
              style={[s.primaryBtn, isLoading && s.primaryBtnDisabled]}
              onPress={handleSignUp}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[Colors.gold, Colors.goldLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.primaryBtnGradient}
              >
                {isLoading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={s.primaryBtnText}>Create Account  ✦</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            {/* Sign in link */}
            <View style={s.switchRow}>
              <Text style={s.switchText}>Already a member?  </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
                <Text style={s.switchLink}>Sign In</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  scroll:    { flexGrow: 1 },

  // ── Header ─────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: Spacing['2xl'],
    overflow: 'hidden',
  },

  // Back button
  backBtn: {
    position: 'absolute',
    top: 48, left: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  backArrow: {
    fontSize: Typography.sizes.xl,
    color: Colors.teal,
    lineHeight: 24,
  },
  backText: {
    fontSize: Typography.sizes.sm,
    color: Colors.teal,
    fontFamily: Typography.body,
    letterSpacing: 0.3,
  },

  // Logo
  iconRing: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 1.5,
    borderColor: 'rgba(212,147,58,0.5)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(212,147,58,0.05)',
    marginBottom: Spacing.md,
    ...Shadows.gold,
  },
  icon: { width: 50, height: 50, resizeMode: 'contain' },

  // Headline
  headline: {
    fontFamily: Typography.heading,
    fontSize: 46,
    color: Colors.tealDark,
    letterSpacing: 0.5,
    lineHeight: 52,
    textAlign: 'center',
  },

  // Ornamental divider
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '65%',
    marginVertical: Spacing.sm,
  },
  ornamentLine:  { flex: 1, height: 1, backgroundColor: 'rgba(212,147,58,0.28)' },
  ornamentGlyph: { fontSize: 9, color: Colors.gold },

  subHeadline: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    letterSpacing: 0.3,
  },

  // ── Form ───────────────────────────────────────────────────────
  form: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.lg,
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(224,92,92,0.08)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.25)',
  },
  errorText: {
    fontSize: Typography.sizes.sm,
    color: Colors.error,
    fontFamily: Typography.body,
    letterSpacing: 0.3,
  },

  // Google button
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(27,107,107,0.18)',
    ...Shadows.sm,
  },
  googleLogoRing: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#EA4335',
    alignItems: 'center', justifyContent: 'center',
  },
  googleG: {
    color: Colors.white,
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
  },
  googleBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.md,
    color: Colors.textPrimary,
  },

  // Primary CTA
  primaryBtn: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadows.gold,
    marginTop: Spacing.xs,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnGradient: {
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.base,
    color: Colors.white,
    letterSpacing: 0.5,
  },

  // Switch row
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  switchText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontFamily: Typography.body,
  },
  switchLink: {
    fontSize: Typography.sizes.sm,
    color: Colors.teal,
    fontFamily: Typography.bodySemiBold,
  },
});
