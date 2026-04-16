/**
 * LoginScreen — Entry point: Google sign-in or email/password.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import { useAuthStore, isGoogleSignInAvailable } from '../../store/authStore';
import UnderlineTextField from '../../components/forms/UnderlineTextField';
import AuthOAuthSection from '../../components/auth/AuthOAuthSection';
import PrimaryAuthButton from '../../components/auth/PrimaryAuthButton';
import useAuthEntranceAnimation from './hooks/useAuthEntranceAnimation';
import { validateLogin } from './validation';

const W = Dimensions.get('window').width;

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const { signInWithGoogle, signInWithApple, signInWithEmail, isLoading, error, clearError } =
    useAuthStore();

  const { headerStyle: brandStyle, formStyle } = useAuthEntranceAnimation({
    staggerMs: 200,
    headerDuration: 700,
    formDuration: 600,
    headerTranslateY: 28,
    formTranslateY: 24,
  });

  const handleGoogleSignIn = async () => {
    clearError();
    await signInWithGoogle();
  };

  const handleEmailSignIn = async () => {
    const { valid, errors } = validateLogin({ email, password });
    setEmailError(errors.email);
    setPasswordError(errors.password);
    if (!valid) return;
    clearError();
    await signInWithEmail(email, password);
  };

  const showGoogle = isGoogleSignInAvailable;
  const showApple = Platform.OS === 'ios';

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
            <View style={s.haloContainer} pointerEvents="none">
              <View style={s.halo1} />
              <View style={s.halo2} />
              <View style={s.halo3} />
            </View>

            <View style={s.iconRing}>
              <Image source={require('../../../assets/icon.png')} style={s.icon} />
            </View>

            <Text style={s.brandName}>Rivnitz</Text>

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
            <AuthOAuthSection
              error={error}
              isLoading={isLoading}
              showGoogle={showGoogle}
              onGooglePress={handleGoogleSignIn}
              showApple={showApple}
              onApplePress={signInWithApple}
              appleButtonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              dividerLabel={showGoogle || showApple ? 'OR SIGN IN' : undefined}
            />

            <UnderlineTextField
              label="Email address"
              error={emailError}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (emailError) setEmailError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <UnderlineTextField
              label="Password"
              error={passwordError}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (passwordError) setPasswordError('');
              }}
              secureTextEntry
            />

            <TouchableOpacity style={s.forgotBtn} activeOpacity={0.6}>
              <Text style={s.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <PrimaryAuthButton
              colors={[Colors.teal, Colors.tealLight]}
              isLoading={isLoading}
              label="Sign In  ✦"
              onPress={handleEmailSignIn}
              shadowPreset="md"
            />

            <View style={s.switchRow}>
              <Text style={s.switchText}>Don't have an account?  </Text>
              <TouchableOpacity
                onPress={() => {
                  clearError();
                  navigation.navigate('SignUp');
                }}
                activeOpacity={0.7}
              >
                <Text style={s.switchLink}>Begin Your Journey</Text>
              </TouchableOpacity>
            </View>

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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  scroll: { flexGrow: 1 },

  hero: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 36,
    paddingHorizontal: Spacing['2xl'],
    overflow: 'hidden',
  },

  haloContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo1: {
    position: 'absolute',
    width: W * 0.72,
    height: W * 0.72,
    borderRadius: W * 0.36,
    borderWidth: 1,
    borderColor: Colors.teal,
    opacity: 0.06,
  },
  halo2: {
    position: 'absolute',
    width: W * 0.5,
    height: W * 0.5,
    borderRadius: W * 0.25,
    borderWidth: 1,
    borderColor: Colors.teal,
    opacity: 0.09,
  },
  halo3: {
    position: 'absolute',
    width: W * 0.3,
    height: W * 0.3,
    borderRadius: W * 0.15,
    borderWidth: 1,
    borderColor: Colors.gold,
    opacity: 0.14,
  },

  iconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    borderColor: 'rgba(212,147,58,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,147,58,0.05)',
    marginBottom: Spacing.md,
    ...Shadows.gold,
  },
  icon: { width: 56, height: 56, resizeMode: 'contain' },

  brandName: {
    fontFamily: Typography.heading,
    fontSize: 54,
    color: Colors.tealDark,
    letterSpacing: 1,
    lineHeight: 58,
  },

  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '68%',
    marginVertical: Spacing.sm,
  },
  ornamentLine: { flex: 1, height: 1, backgroundColor: 'rgba(212,147,58,0.32)' },
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

  form: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['2xl'],
    gap: Spacing.lg,
  },

  forgotBtn: { alignItems: 'flex-end', marginTop: -Spacing.sm },
  forgotText: {
    fontSize: Typography.sizes.xs,
    color: Colors.teal,
    fontFamily: Typography.body,
    letterSpacing: 0.3,
  },

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
