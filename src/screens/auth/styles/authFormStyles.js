import { StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme';

/** Shared OAuth + form chrome used by Login and SignUp. */
export const authFormStyles = StyleSheet.create({
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
  form: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
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
  primaryBtnDisabled: { opacity: 0.6 },
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
