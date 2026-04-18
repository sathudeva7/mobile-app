/**
 * SignUpScreen — Create new account with email/password or Google.
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
import { validateSignUp } from './validation';

export default function SignUpScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const { signUpWithEmail, signInWithGoogle, signInWithApple, isLoading, error, clearError } =
    useAuthStore();

  const { headerStyle, formStyle } = useAuthEntranceAnimation({
    staggerMs: 180,
    headerDuration: 650,
    formDuration: 550,
    headerTranslateY: 24,
    formTranslateY: 24,
  });

  const handleSignUp = async () => {
    const { valid, errors } = validateSignUp({ name, email, password, confirm });
    setNameError(errors.name);
    setEmailError(errors.email);
    setPasswordError(errors.password);
    setConfirmError(errors.confirm);
    if (!valid) return;
    clearError();
    await signUpWithEmail(email, password, name);
    navigation.navigate('EmailVerification');
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
          <Animated.View style={[s.header, headerStyle]}>
            <TouchableOpacity
              onPress={() => {
                clearError();
                navigation.goBack();
              }}
              style={s.backBtn}
              activeOpacity={0.6}
            >
              <Text style={s.backArrow}>←</Text>
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>

            <View style={s.iconRing}>
              <Image source={require('../../../assets/icon.png')} style={s.icon} />
            </View>

            <Text style={s.headline}>Begin Your{'\n'}Journey</Text>

            <View style={s.ornamentRow}>
              <View style={s.ornamentLine} />
              <Text style={s.ornamentGlyph}>✦</Text>
              <View style={s.ornamentLine} />
            </View>

            <Text style={s.subHeadline}>Join the Rivnitz Community</Text>
          </Animated.View>

          <Animated.View style={[s.form, formStyle]}>
            <AuthOAuthSection
              error={error}
              isLoading={isLoading}
              showGoogle={showGoogle}
              onGooglePress={() => {
                clearError();
                signInWithGoogle();
              }}
              showApple={showApple}
              onApplePress={() => {
                clearError();
                signInWithApple();
              }}
              appleButtonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              dividerLabel={showGoogle || showApple ? 'OR CREATE ACCOUNT' : undefined}
            />

            <UnderlineTextField
              label="Full name"
              error={nameError}
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (nameError) setNameError('');
              }}
              autoCapitalize="words"
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
            />

            <UnderlineTextField
              label="Password — min 6 characters"
              error={passwordError}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (passwordError) setPasswordError('');
              }}
              secureTextEntry
            />

            <UnderlineTextField
              label="Confirm password"
              error={confirmError}
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                if (confirmError) setConfirmError('');
              }}
              secureTextEntry
            />

            <PrimaryAuthButton
              colors={[Colors.gold, Colors.goldLight]}
              isLoading={isLoading}
              label="Create Account  ✦"
              onPress={handleSignUp}
              shadowPreset="gold"
            />

            <View style={s.switchRow}>
              <Text style={s.switchText}>Already a member?  </Text>
              <TouchableOpacity
                onPress={() => {
                  clearError();
                  navigation.navigate('Login');
                }}
                activeOpacity={0.7}
              >
                <Text style={s.switchLink}>Sign In</Text>
              </TouchableOpacity>
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

  header: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: Spacing['2xl'],
    overflow: 'hidden',
  },

  backBtn: {
    position: 'absolute',
    top: 48,
    left: Spacing.lg,
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

  iconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: 'rgba(212,147,58,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,147,58,0.05)',
    marginBottom: Spacing.md,
    ...Shadows.gold,
  },
  icon: { width: 50, height: 50, resizeMode: 'contain' },

  headline: {
    fontFamily: Typography.heading,
    fontSize: 46,
    color: Colors.tealDark,
    letterSpacing: 0.5,
    lineHeight: 52,
    textAlign: 'center',
  },

  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '65%',
    marginVertical: Spacing.sm,
  },
  ornamentLine: { flex: 1, height: 1, backgroundColor: 'rgba(212,147,58,0.28)' },
  ornamentGlyph: { fontSize: 9, color: Colors.gold },

  subHeadline: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    letterSpacing: 0.3,
  },

  form: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.lg,
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
});
