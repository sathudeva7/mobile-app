import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';

/**
 * Gradient CTA used on Login (teal) and SignUp (gold).
 * @param {object} props
 * @param {[string, string]} props.colors - LinearGradient colors
 * @param {boolean} props.isLoading
 * @param {string} props.label - button text when not loading
 * @param {() => void} props.onPress
 * @param {boolean} [props.disabled]
 * @param {'md'|'gold'} [props.shadowPreset] - matches previous screen shadows
 */
export default function PrimaryAuthButton({
  colors,
  isLoading,
  label,
  onPress,
  disabled,
  shadowPreset = 'md',
}) {
  const shadowExtra =
    shadowPreset === 'gold' ? Shadows.gold : Shadows.md;

  return (
    <TouchableOpacity
      style={[styles.btn, shadowExtra, (isLoading || disabled) && styles.btnDisabled]}
      onPress={onPress}
      disabled={isLoading || disabled}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.text}>{label}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  btnDisabled: { opacity: 0.6 },
  gradient: {
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.base,
    color: Colors.white,
    letterSpacing: 0.5,
  },
});
