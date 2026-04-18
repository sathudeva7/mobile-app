import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import OrnamentalRule from './OrnamentalRule';

/**
 * Shared Firebase error banner + Google + Apple + divider for Login / SignUp.
 */
export default function AuthOAuthSection({
  error,
  isLoading,
  showGoogle,
  onGooglePress,
  showApple,
  onApplePress,
  appleButtonType,
  dividerLabel,
}) {
  const showDivider = showGoogle || showApple;

  return (
    <>
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>✦  {error}</Text>
        </View>
      )}

      {showGoogle && (
        <TouchableOpacity
          style={styles.googleBtn}
          onPress={onGooglePress}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          <View style={styles.googleLogoRing}>
            <Text style={styles.googleG}>G</Text>
          </View>
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </TouchableOpacity>
      )}

      {showApple && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={appleButtonType}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={Radius.lg}
          style={{ width: '100%', height: 50 }}
          onPress={onApplePress}
        />
      )}

      {showDivider && dividerLabel ? (
        <OrnamentalRule label={dividerLabel} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
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
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EA4335',
    alignItems: 'center',
    justifyContent: 'center',
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
});
