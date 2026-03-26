/**
 * Rivnitz App — Brand Theme
 * All colors, typography, spacing, and shadows.
 * NEVER hardcode colors in components — always import from here.
 */

export const Colors = {
  // ─── Primary Brand Colors ───────────────────────────────────────
  teal:        '#1B6B6B',   // Primary brand — headers, nav, buttons
  tealDark:    '#144F4F',   // Dark teal — gradients, overlays
  tealLight:   '#2A8A8A',   // Light teal — hover states, accents
  tealPale:    '#E8F4F4',   // Very light teal — backgrounds, badges

  // ─── Gold / Accent Colors ────────────────────────────────────────
  gold:        '#D4933A',   // Primary accent — CTAs, highlights
  goldLight:   '#E8A94A',   // Light gold — secondary accents
  goldPale:    '#FDF3E3',   // Very light gold — card backgrounds

  // ─── Neutral / Background Colors ────────────────────────────────
  cream:       '#F5EFE6',   // Main background
  creamDark:   '#EDE5D8',   // Slightly darker cream — dividers
  white:       '#FFFFFF',   // Cards, modals
  black:       '#000000',

  // ─── Text Colors ─────────────────────────────────────────────────
  textPrimary: '#1A2A2A',   // Main body text
  textMuted:   '#8A9A9A',   // Secondary / placeholder text
  textLight:   'rgba(255,255,255,0.85)', // Text on dark backgrounds

  // ─── Status / Feedback Colors ────────────────────────────────────
  success:     '#4CAF82',   // Green — completed, online, positive
  error:       '#E05C5C',   // Red — errors, delete, live indicator
  warning:     '#F0A500',   // Amber — warnings, alerts

  // ─── Border / Divider ────────────────────────────────────────────
  border:      'rgba(27,107,107,0.15)',
  borderLight: 'rgba(27,107,107,0.08)',

  // ─── Overlay ─────────────────────────────────────────────────────
  overlay:     'rgba(20,79,79,0.5)',
  overlayDark: 'rgba(0,0,0,0.6)',
};

export const Typography = {
  // Font families
  // Install these via expo-font:
  // - Cormorant Garamond (headings) — elegant serif
  // - DM Sans (body) — clean, readable sans-serif
  heading:  'CormorantGaramond-Bold',
  headingRegular: 'CormorantGaramond-Regular',
  body:     'DMSans-Regular',
  bodyMedium: 'DMSans-Medium',
  bodySemiBold: 'DMSans-SemiBold',

  // Font sizes
  sizes: {
    xs:   9,
    sm:   11,
    md:   13,
    base: 15,
    lg:   17,
    xl:   20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 34,
    '5xl': 42,
  },

  // Line heights
  lineHeights: {
    tight:  1.2,
    normal: 1.5,
    relaxed: 1.7,
  },

  // Letter spacing
  letterSpacing: {
    tight:  -0.5,
    normal: 0,
    wide:   0.5,
    wider:  1,
    widest: 2,
  },
};

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
};

export const Radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  '2xl': 28,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#1B6B6B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1B6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1B6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  gold: {
    shadowColor: '#D4933A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
};

// ─── Gradient Presets ───────────────────────────────────────────────
// Use with expo-linear-gradient
export const Gradients = {
  teal:    ['#144F4F', '#1B6B6B'],
  tealLight: ['#1B6B6B', '#2A8A8A'],
  gold:    ['#D4933A', '#E8A94A'],
  dark:    ['#0A2A2A', '#1B4A4A'],
  cream:   ['#F5EFE6', '#EDE5D8'],
};

export default {
  Colors,
  Typography,
  Spacing,
  Radius,
  Shadows,
  Gradients,
};
