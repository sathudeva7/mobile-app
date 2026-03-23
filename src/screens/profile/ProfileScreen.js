/**
 * ProfileScreen — The Sacred Soul Portrait
 * User profile, completion nudges, soul nature, and growth stats.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, TextInput, Alert, ActivityIndicator,
  Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';

// ─── Helpers ──────────────────────────────────────────────────────
function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

// ─── Ornamental rule ──────────────────────────────────────────────
const OrnamentRule = ({ label, light = false }) => (
  <View style={or.row}>
    <View style={[or.line, light && or.lineLight]} />
    {label
      ? <Text style={[or.label, light && or.labelLight]}>{label}</Text>
      : <Text style={[or.glyph, light && or.glyphLight]}>✦</Text>
    }
    <View style={[or.line, light && or.lineLight]} />
  </View>
);
const or = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  line:       { flex: 1, height: 1, backgroundColor: 'rgba(212,147,58,0.2)' },
  lineLight:  { backgroundColor: 'rgba(255,255,255,0.25)' },
  glyph:      { fontSize: 9, color: Colors.gold },
  glyphLight: { color: 'rgba(212,147,58,0.7)' },
  label:      { fontSize: 8, color: Colors.textMuted, fontFamily: Typography.bodyMedium, letterSpacing: 2 },
  labelLight: { color: 'rgba(255,255,255,0.5)' },
});

// ─── Underline form field ─────────────────────────────────────────
const EditField = ({ label, error, ...inputProps }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={ef.wrapper}>
      <Text style={[ef.label, focused && ef.labelFocused]}>{label}</Text>
      <TextInput
        style={ef.input}
        placeholderTextColor="transparent"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...inputProps}
      />
      <View style={[ef.line, focused && ef.lineFocused, error && ef.lineError]} />
      {error ? <Text style={ef.error}>{error}</Text> : null}
    </View>
  );
};
const ef = StyleSheet.create({
  wrapper: { gap: 2 },
  label: {
    fontSize: 9, letterSpacing: 2,
    color: Colors.teal, fontFamily: Typography.bodyMedium,
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
  error: { fontSize: Typography.sizes.xs, color: Colors.error, fontFamily: Typography.body, marginTop: 4 },
});

// ─── Fade + slide wrapper ─────────────────────────────────────────
const FadeSlide = ({ anim, children, style }) => (
  <Animated.View
    style={[
      style,
      {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      },
    ]}
  >
    {children}
  </Animated.View>
);

// ─── Profile completion ring ──────────────────────────────────────
// Simple arc-like visual using a bordered circle with label
const CompletionRing = ({ pct }) => {
  const color = pct === 100 ? Colors.gold : Colors.teal;
  return (
    <View style={cr.wrap}>
      <View style={[cr.ring, { borderColor: color }]}>
        <Text style={[cr.pct, { color }]}>{pct}</Text>
        <Text style={[cr.unit, { color }]}>%</Text>
      </View>
    </View>
  );
};
const cr = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  pct: {
    fontFamily: Typography.heading,
    fontSize: 22,
    lineHeight: 24,
  },
  unit: {
    fontFamily: Typography.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: -2,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { user, updateProfile, clearError } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [nameError, setNameError] = useState('');
  const [fields, setFields]   = useState({
    displayName: user?.displayName || '',
    phoneNumber: user?.phoneNumber || '',
    hebrewName:  user?.hebrewName  || '',
    mothersName: user?.mothersName || '',
  });

  const completionFields = [
    { key: 'displayName', label: 'Full Name',      sublabel: 'How we address you',      keyboardType: 'default'   },
    { key: 'phoneNumber', label: 'Phone Number',   sublabel: 'For important messages',  keyboardType: 'phone-pad' },
    { key: 'hebrewName',  label: 'Hebrew Name',    sublabel: 'e.g. Moshe ben Sara',     keyboardType: 'default'   },
    { key: 'mothersName', label: "Mother's Name",  sublabel: 'For prayers & blessings', keyboardType: 'default'   },
  ];

  const filledCount   = completionFields.filter(f => user?.[f.key]).length;
  const completionPct = Math.round((filledCount / completionFields.length) * 100);

  // Entrance animations
  const heroAnim    = useRef(new Animated.Value(0)).current;
  const sectionAnims = useRef([0,1,2,3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(heroAnim,       { toValue: 1, duration: 600, useNativeDriver: true }),
      ...sectionAnims.map(a => Animated.timing(a, { toValue: 1, duration: 480, useNativeDriver: true })),
    ]).start();
  }, []);

  const handleSave = async () => {
    if (!fields.displayName.trim()) {
      setNameError('Please enter your name.');
      return;
    }
    setNameError('');
    setSaving(true);
    clearError();
    const result = await updateProfile(fields);
    setSaving(false);
    if (result.ok) {
      setEditing(false);
    } else {
      Alert.alert('Save failed', result.error || 'Unknown error');
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setNameError('');
    setFields({
      displayName: user?.displayName || '',
      phoneNumber: user?.phoneNumber || '',
      hebrewName:  user?.hebrewName  || '',
      mothersName: user?.mothersName || '',
    });
  };

  const initials = getInitials(user?.displayName || '');
  const isPremium = user?.membershipTier === 'premium';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Hero Header ──────────────────────────────────── */}
          <Animated.View
            style={{
              opacity: heroAnim,
              transform: [{ translateY: heroAnim.interpolate({ inputRange: [0,1], outputRange: [-12, 0] }) }],
            }}
          >
            <LinearGradient
              colors={Gradients.teal}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.hero}
            >
              {/* Back button */}
              <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
                <Text style={s.backArrow}>←</Text>
              </TouchableOpacity>

              {/* Avatar ring */}
              <View style={s.avatarRing}>
                <View style={s.avatarInner}>
                  <Text style={s.avatarInitials}>{initials}</Text>
                </View>
              </View>

              {/* Name */}
              <Text style={s.heroName}>{user?.displayName || 'Your Name'}</Text>

              {/* Ornament */}
              <OrnamentRule light />

              {/* Email + tier */}
              <Text style={s.heroEmail}>{user?.email || ''}</Text>

              {/* Membership badge */}
              <View style={[s.tierBadge, isPremium && s.tierBadgePremium]}>
                <Text style={[s.tierBadgeText, isPremium && s.tierBadgeTextPremium]}>
                  {isPremium ? '✦  PREMIUM MEMBER' : '◎  FREE MEMBER'}
                </Text>
              </View>

            </LinearGradient>
          </Animated.View>

          {/* ── Completion banner ─────────────────────────────── */}
          {completionPct < 100 && (
            <FadeSlide anim={sectionAnims[0]} style={s.completionSection}>
              <View style={s.completionCard}>
                <CompletionRing pct={completionPct} />
                <View style={s.completionText}>
                  <Text style={s.completionTitle}>Complete your profile</Text>
                  <Text style={s.completionSub}>
                    {completionFields.length - filledCount} field{completionFields.length - filledCount !== 1 ? 's' : ''} missing — needed for prayers & blessings
                  </Text>
                  <View style={s.completionBarBg}>
                    <LinearGradient
                      colors={[Colors.teal, Colors.gold]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[s.completionBarFill, { width: `${completionPct}%` }]}
                    />
                  </View>
                </View>
              </View>
            </FadeSlide>
          )}

          {/* ── Soul Nature ───────────────────────────────────── */}
          {user?.personalityType && (
            <FadeSlide anim={sectionAnims[1]} style={s.section}>
              <OrnamentRule label="YOUR SOUL NATURE" />
              <View style={s.natureCard}>
                <Text style={s.natureType}>{user.personalityType}</Text>
                <View style={s.naturePillRow}>
                  {user.mbtiType && (
                    <View style={s.naturePill}>
                      <Text style={s.naturePillEyebrow}>MBTI</Text>
                      <Text style={s.naturePillValue}>{user.mbtiType}</Text>
                    </View>
                  )}
                  {user.enneagramType && (
                    <View style={s.naturePill}>
                      <Text style={s.naturePillEyebrow}>ENNEAGRAM</Text>
                      <Text style={s.naturePillValue}>{user.enneagramType}</Text>
                    </View>
                  )}
                  {user.humanDesignType && (
                    <View style={s.naturePill}>
                      <Text style={s.naturePillEyebrow}>HUMAN DESIGN</Text>
                      <Text style={s.naturePillValue}>{user.humanDesignType}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={s.retakeRow}
                  onPress={() => navigation.navigate('NatureQuiz')}
                  activeOpacity={0.7}
                >
                  <View style={s.retakeLine} />
                  <Text style={s.retakeText}>Retake Nature Quiz</Text>
                  <View style={s.retakeLine} />
                </TouchableOpacity>
              </View>
            </FadeSlide>
          )}

          {/* ── Profile Info ──────────────────────────────────── */}
          <FadeSlide anim={sectionAnims[2]} style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionLabel}>PROFILE INFO</Text>
              {!editing ? (
                <TouchableOpacity
                  style={s.editPill}
                  onPress={() => setEditing(true)}
                  activeOpacity={0.8}
                >
                  <Text style={s.editPillText}>Edit</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.editActions}>
                  <TouchableOpacity onPress={handleCancelEdit} style={s.cancelPill} activeOpacity={0.7}>
                    <Text style={s.cancelPillText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[Colors.gold, '#C47A25']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={s.savePill}
                    >
                      {saving
                        ? <ActivityIndicator size="small" color={Colors.white} />
                        : <Text style={s.savePillText}>Save  ✦</Text>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <OrnamentRule />

            <View style={s.fieldsCard}>
              {editing ? (
                /* Edit mode: underline fields */
                <View style={s.editFieldsWrap}>
                  {completionFields.map((f, idx) => (
                    <React.Fragment key={f.key}>
                      <EditField
                        label={f.label}
                        error={f.key === 'displayName' ? nameError : ''}
                        value={fields[f.key]}
                        onChangeText={val => {
                          setFields(prev => ({ ...prev, [f.key]: val }));
                          if (f.key === 'displayName' && nameError) setNameError('');
                        }}
                        placeholder={f.sublabel}
                        keyboardType={f.keyboardType}
                      />
                      {idx < completionFields.length - 1 && <View style={s.fieldDivider} />}
                    </React.Fragment>
                  ))}
                </View>
              ) : (
                /* View mode: clean field rows */
                completionFields.map((f, idx) => {
                  const value   = user?.[f.key];
                  const missing = !value;
                  return (
                    <React.Fragment key={f.key}>
                      <View style={s.fieldRow}>
                        <View style={[s.fieldDot, { backgroundColor: missing ? 'rgba(212,147,58,0.35)' : Colors.teal }]} />
                        <View style={s.fieldRowContent}>
                          <Text style={s.fieldRowLabel}>{f.label}</Text>
                          <Text style={[s.fieldRowValue, missing && s.fieldRowValueMissing]}>
                            {value || `Add ${f.label.toLowerCase()} →`}
                          </Text>
                        </View>
                        {missing && <Text style={s.missingGlyph}>✦</Text>}
                      </View>
                      {idx < completionFields.length - 1 && <View style={s.fieldRowDivider} />}
                    </React.Fragment>
                  );
                })
              )}
            </View>
          </FadeSlide>

          {/* ── Growth Stats ──────────────────────────────────── */}
          <FadeSlide anim={sectionAnims[3]} style={s.section}>
            <OrnamentRule label="GROWTH STATS" />
            <View style={s.statsRow}>

              <View style={s.statMedallion}>
                <LinearGradient
                  colors={[Colors.tealPale, 'rgba(27,107,107,0.04)']}
                  style={s.statMedallionGrad}
                >
                  <Text style={s.statNum}>{user?.streakCount || 0}</Text>
                  <Text style={s.statUnit}>days</Text>
                  <View style={s.statDivider} />
                  <Text style={s.statLabel}>Streak</Text>
                </LinearGradient>
              </View>

              <View style={[s.statMedallion, { borderColor: 'rgba(212,147,58,0.2)' }]}>
                <LinearGradient
                  colors={[Colors.goldPale, 'rgba(212,147,58,0.04)']}
                  style={s.statMedallionGrad}
                >
                  <Text style={[s.statNum, { color: Colors.gold }]}>
                    {isPremium ? '★' : '◎'}
                  </Text>
                  <Text style={[s.statUnit, { color: Colors.gold }]}>
                    {isPremium ? 'premium' : 'free'}
                  </Text>
                  <View style={[s.statDivider, { backgroundColor: 'rgba(212,147,58,0.25)' }]} />
                  <Text style={s.statLabel}>Membership</Text>
                </LinearGradient>
              </View>

              <View style={s.statMedallion}>
                <LinearGradient
                  colors={[Colors.tealPale, 'rgba(27,107,107,0.04)']}
                  style={s.statMedallionGrad}
                >
                  <Text style={s.statNum}>{completionPct}</Text>
                  <Text style={s.statUnit}>%</Text>
                  <View style={s.statDivider} />
                  <Text style={s.statLabel}>Profile</Text>
                </LinearGradient>
              </View>

            </View>
          </FadeSlide>

          <View style={{ height: Spacing['2xl'] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  scroll:    { paddingBottom: Spacing['3xl'] },

  // ── Hero ────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: Spacing.xl + 4,
    paddingHorizontal: Spacing['2xl'],
    gap: 6,
  },
  backBtn: {
    position: 'absolute',
    top: Spacing.md + 4,
    left: Spacing.md,
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: {
    fontSize: Typography.sizes.xl,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 26,
  },

  // Avatar
  avatarRing: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(212,147,58,0.55)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(212,147,58,0.08)',
    ...Shadows.gold,
    marginBottom: 4,
  },
  avatarInner: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(212,147,58,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: Typography.heading,
    fontSize: 32,
    color: Colors.white,
    letterSpacing: 1,
    lineHeight: 36,
  },

  heroName: {
    fontFamily: Typography.heading,
    fontSize: 34,
    color: Colors.white,
    letterSpacing: 0.5,
    lineHeight: 38,
    textAlign: 'center',
  },
  heroEmail: {
    fontSize: Typography.sizes.xs,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: Typography.body,
    letterSpacing: 0.3,
  },
  tierBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginTop: 4,
  },
  tierBadgePremium: {
    backgroundColor: 'rgba(212,147,58,0.2)',
    borderColor: 'rgba(212,147,58,0.45)',
  },
  tierBadgeText: {
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: Typography.bodyMedium,
  },
  tierBadgeTextPremium: { color: Colors.goldLight },

  // ── Completion ─────────────────────────────────────────────────
  completionSection: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  completionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.18)',
    ...Shadows.sm,
  },
  completionText: { flex: 1, gap: 6 },
  completionTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.sm,
    color: Colors.tealDark,
  },
  completionSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    lineHeight: 16,
  },
  completionBarBg: {
    height: 5,
    backgroundColor: 'rgba(27,107,107,0.1)',
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginTop: 2,
  },
  completionBarFill: { height: '100%', borderRadius: Radius.full },

  // ── Sections ───────────────────────────────────────────────────
  section: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 8,
    letterSpacing: 2,
    color: Colors.textMuted,
    fontFamily: Typography.bodyMedium,
    textTransform: 'uppercase',
  },

  // Edit/Save/Cancel pills
  editPill: {
    backgroundColor: Colors.tealPale,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(27,107,107,0.2)',
  },
  editPillText: {
    fontSize: Typography.sizes.xs,
    color: Colors.teal,
    fontFamily: Typography.bodySemiBold,
    letterSpacing: 0.3,
  },
  editActions: { flexDirection: 'row', gap: Spacing.sm },
  cancelPill: {
    backgroundColor: Colors.cream,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelPillText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.bodyMedium,
  },
  savePill: {
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
    ...Shadows.gold,
  },
  savePillText: {
    fontSize: Typography.sizes.xs,
    color: Colors.white,
    fontFamily: Typography.bodySemiBold,
    letterSpacing: 0.3,
  },

  // Fields card
  fieldsCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.1)',
    overflow: 'hidden',
    ...Shadows.sm,
  },

  // View mode field rows
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  fieldDot: {
    width: 6, height: 6, borderRadius: 3,
    flexShrink: 0,
  },
  fieldRowContent: { flex: 1 },
  fieldRowLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: Colors.textMuted,
    fontFamily: Typography.bodyMedium,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  fieldRowValue: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontFamily: Typography.body,
    lineHeight: 20,
  },
  fieldRowValueMissing: {
    color: Colors.gold,
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.sizes.xs,
    letterSpacing: 0.3,
  },
  missingGlyph: { fontSize: 9, color: 'rgba(212,147,58,0.5)' },
  fieldRowDivider: { height: 1, backgroundColor: 'rgba(212,147,58,0.08)', marginLeft: Spacing.base + 22 },

  // Edit mode fields
  editFieldsWrap: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.lg,
  },
  fieldDivider: { height: 1, backgroundColor: 'rgba(27,107,107,0.06)' },

  // ── Nature card ─────────────────────────────────────────────────
  natureCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(27,107,107,0.12)',
    overflow: 'hidden',
    ...Shadows.sm,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  natureType: {
    fontFamily: Typography.heading,
    fontSize: 32,
    color: Colors.tealDark,
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 36,
  },
  naturePillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  naturePill: {
    backgroundColor: Colors.tealPale,
    borderRadius: Radius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(27,107,107,0.12)',
    gap: 2,
  },
  naturePillEyebrow: {
    fontSize: 7,
    letterSpacing: 2,
    color: Colors.teal,
    fontFamily: Typography.bodyMedium,
    textTransform: 'uppercase',
  },
  naturePillValue: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes.lg,
    color: Colors.tealDark,
    letterSpacing: 0.2,
  },
  retakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '70%',
  },
  retakeLine: { flex: 1, height: 1, backgroundColor: 'rgba(27,107,107,0.12)' },
  retakeText: {
    fontSize: Typography.sizes.xs,
    color: Colors.teal,
    fontFamily: Typography.bodyMedium,
    letterSpacing: 0.3,
  },

  // ── Stats ───────────────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statMedallion: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(27,107,107,0.12)',
    ...Shadows.sm,
  },
  statMedallionGrad: {
    alignItems: 'center',
    paddingVertical: Spacing.md + 2,
    gap: 2,
  },
  statNum: {
    fontFamily: Typography.heading,
    fontSize: 30,
    color: Colors.teal,
    lineHeight: 32,
  },
  statUnit: {
    fontSize: 9,
    color: Colors.teal,
    fontFamily: Typography.bodyMedium,
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  statDivider: {
    width: 18, height: 1,
    backgroundColor: 'rgba(27,107,107,0.2)',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 8,
    color: Colors.textMuted,
    fontFamily: Typography.bodyMedium,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
