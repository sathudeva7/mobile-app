/**
 * LoginScreen — Entry point: Google sign-in or email/password.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import { useAuthStore, isGoogleSignInAvailable } from '../../store/authStore';

const W = Dimensions.get('window').width;

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
export default function LoginScreen({ navigation }) {
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [emailError,    setEmailError]    = useState('');
  const [passwordError, setPasswordError] = useState('');

  const { signInWithGoogle, signInWithEmail, isLoading, error, clearError } = useAuthStore();

  // Entrance animations
  const brandAnim = useRef(new Animated.Value(0)).current;
  const formAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.timing(brandAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(formAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const brandStyle = {
    opacity: brandAnim,
    transform: [{ translateY: brandAnim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
  };
  const formStyle = {
    opacity: formAnim,
    transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  };

  const handleGoogleSignIn = async () => {
    clearError();
    await signInWithGoogle();
  };

  const handleEmailSignIn = async () => {
    let valid = true;
    if (!email.trim()) { setEmailError('Please enter your email address.'); valid = false; }
    else { setEmailError(''); }
    if (!password) { setPasswordError('Please enter your password.'); valid = false; }
    else { setPasswordError(''); }
    if (!valid) return;
    clearError();
    await signInWithEmail(email, password);
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Brand / Hero ────────────────────────────────────── */}
          <Animated.View style={[s.hero, brandStyle]}>
            {/* Concentric halo rings — purely decorative */}
            <View style={s.haloContainer} pointerEvents="none">
              <View style={s.halo1} />
              <View style={s.halo2} />
              <View style={s.halo3} />
            </View>

            {/* Logo with gold aura ring */}
            <View style={s.iconRing}>
              <Image source={require('../../../assets/icon.png')} style={s.icon} />
            </View>

            {/* Brand name */}
            <Text style={s.brandName}>Rivnitz</Text>

            {/* Ornamental divider */}
            <View style={s.ornamentRow}>
              <View style={s.ornamentLine} />
              <Text style={s.ornamentGlyph}>✦</Text>
              <View style={s.ornamentLine} />
            </View>

            <Text style={s.tagline}>MIRACLES THROUGH MISSION</Text>
            <Text style={s.heroSub}>
              A sacred community of guidance,{'\n'}healing & blessing
            </Text>
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
                  onPress={handleGoogleSignIn}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <View style={s.googleLogoRing}>
                    <Text style={s.googleG}>G</Text>
                  </View>
                  <Text style={s.googleBtnText}>Continue with Google</Text>
                </TouchableOpacity>
                <OrnamentalRule label="OR SIGN IN" />
              </>
            )}

            {/* Email */}
            <FormField
              label="Email address"
              error={emailError}
              value={email}
              onChangeText={t => { setEmail(t); if (emailError) setEmailError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Password */}
            <FormField
              label="Password"
              error={passwordError}
              value={password}
              onChangeText={t => { setPassword(t); if (passwordError) setPasswordError(''); }}
              secureTextEntry
            />

            {/* Forgot password */}
            <TouchableOpacity style={s.forgotBtn} activeOpacity={0.6}>
              <Text style={s.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign in CTA */}
            <TouchableOpacity
              style={[s.primaryBtn, isLoading && s.primaryBtnDisabled]}
              onPress={handleEmailSignIn}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[Colors.teal, Colors.tealLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.primaryBtnGradient}
              >
                {isLoading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={s.primaryBtnText}>Sign In  ✦</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            {/* Sign up link */}
            <View style={s.switchRow}>
              <Text style={s.switchText}>Don't have an account?  </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')} activeOpacity={0.7}>
                <Text style={s.switchLink}>Begin Your Journey</Text>
              </TouchableOpacity>
            </View>

            {/* Free membership note */}
            <View style={s.freeCard}>
              <Text style={s.freeCardHeading}>✦  FREE TO JOIN  ✦</Text>
              <Text style={s.freeCardText}>
                Basic membership includes daily videos & community
              </Text>
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

  // ── Hero ───────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 36,
    paddingHorizontal: Spacing['2xl'],
    overflow: 'hidden',
  },

  // Concentric halos
  haloContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo1: {
    position: 'absolute',
    width: W * 0.72, height: W * 0.72, borderRadius: W * 0.36,
    borderWidth: 1, borderColor: Colors.teal, opacity: 0.06,
  },
  halo2: {
    position: 'absolute',
    width: W * 0.50, height: W * 0.50, borderRadius: W * 0.25,
    borderWidth: 1, borderColor: Colors.teal, opacity: 0.09,
  },
  halo3: {
    position: 'absolute',
    width: W * 0.30, height: W * 0.30, borderRadius: W * 0.15,
    borderWidth: 1, borderColor: Colors.gold, opacity: 0.14,
  },

  // Logo
  iconRing: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 1.5,
    borderColor: 'rgba(212,147,58,0.55)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(212,147,58,0.05)',
    marginBottom: Spacing.md,
    ...Shadows.gold,
  },
  icon: { width: 56, height: 56, resizeMode: 'contain' },

  // Brand name
  brandName: {
    fontFamily: Typography.heading,
    fontSize: 54,
    color: Colors.tealDark,
    letterSpacing: 1,
    lineHeight: 58,
  },

  // Ornamental divider
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '68%',
    marginVertical: Spacing.sm,
  },
  ornamentLine:  { flex: 1, height: 1, backgroundColor: 'rgba(212,147,58,0.32)' },
  ornamentGlyph: { fontSize: 9, color: Colors.gold },

  tagline: {
    fontSize: 9,
    letterSpacing: 3,
    color: Colors.gold,
    fontFamily: Typography.bodyMedium,
    marginBottom: Spacing.sm,
  },
  heroSub: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: Typography.body,
  },

  // ── Form ───────────────────────────────────────────────────────
  form: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['2xl'],
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
    ...Shadows.md,
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

  // Forgot
  forgotBtn: { alignItems: 'flex-end', marginTop: -Spacing.sm },
  forgotText: {
    fontSize: Typography.sizes.xs,
    color: Colors.teal,
    fontFamily: Typography.body,
    letterSpacing: 0.3,
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

  // Free membership card
  freeCard: {
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.22)',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
    backgroundColor: Colors.goldPale,
    gap: 4,
  },
  freeCardHeading: {
    fontSize: 9,
    color: Colors.gold,
    fontFamily: Typography.bodyMedium,
    letterSpacing: 2.5,
  },
  freeCardText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    textAlign: 'center',
    lineHeight: 17,
  },
});
