/**
 * SettingsScreen — The Sacred Sanctum
 * Notifications, subscription, account management.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Modal, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { scheduleMorningMotivation, cancelMorningNotifications } from '../../services/notifications';

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

// ─── Confirm Modal ────────────────────────────────────────────────
function ConfirmModal({ visible, glyph, title, message, confirmLabel, confirmDestructive, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={ms.overlay}>
        <View style={ms.card}>
          <View style={[ms.glyphRing, confirmDestructive && ms.glyphRingDestructive]}>
            <Text style={[ms.glyphText, confirmDestructive && ms.glyphTextDestructive]}>
              {glyph || '✦'}
            </Text>
          </View>
          <Text style={ms.title}>{title}</Text>
          <Text style={ms.message}>{message}</Text>
          <View style={ms.actions}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={ms.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ms.confirmBtn, confirmDestructive && ms.confirmBtnDestructive]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={[ms.confirmText, confirmDestructive && ms.confirmTextDestructive]}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Coming Soon Toast ────────────────────────────────────────────
function ComingSoonToast({ visible }) {
  if (!visible) return null;
  return (
    <View style={ts.wrap}>
      <View style={ts.container}>
        <Text style={ts.glyph}>✦</Text>
        <View>
          <Text style={ts.title}>Coming Soon</Text>
          <Text style={ts.sub}>Subscription management is on its way</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Section group ────────────────────────────────────────────────
function SettingGroup({ label, children }) {
  return (
    <View style={s.group}>
      <OrnamentRule label={label} />
      <View style={s.groupCard}>
        {children}
      </View>
    </View>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────
function ToggleRow({ label, sub, value, onChange, isLast }) {
  return (
    <>
      <View style={s.row}>
        <View style={[s.rowDot, { backgroundColor: value ? Colors.teal : 'rgba(27,107,107,0.2)' }]} />
        <View style={s.rowContent}>
          <Text style={s.rowLabel}>{label}</Text>
          {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: 'rgba(27,107,107,0.12)', true: Colors.teal }}
          thumbColor={Colors.white}
          ios_backgroundColor="rgba(27,107,107,0.12)"
        />
      </View>
      {!isLast && <View style={s.rowDivider} />}
    </>
  );
}

// ─── Action row ───────────────────────────────────────────────────
function ActionRow({ glyph, label, sub, onPress, destructive, isLast }) {
  return (
    <>
      <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
        <View style={[s.rowGlyphWrap, destructive && s.rowGlyphWrapDestructive]}>
          <Text style={[s.rowGlyph, destructive && s.rowGlyphDestructive]}>{glyph}</Text>
        </View>
        <View style={s.rowContent}>
          <Text style={[s.rowLabel, destructive && s.rowLabelDestructive]}>{label}</Text>
          {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
        </View>
        <Text style={[s.chevron, destructive && s.chevronDestructive]}>›</Text>
      </TouchableOpacity>
      {!isLast && <View style={s.rowDivider} />}
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────
export default function SettingsScreen({ navigation }) {
  const { user, signOut, resetQuiz } = useAuthStore();

  const [notifNewVideo,  setNotifNewVideo]  = useState(true);
  const [notifLive,      setNotifLive]      = useState(true);
  const [notifMorning,   setNotifMorning]   = useState(true);
  const [notifCommunity, setNotifCommunity] = useState(false);

  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showResetModal,   setShowResetModal]   = useState(false);
  const [showComingSoon,   setShowComingSoon]   = useState(false);

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const anims      = useRef([0,1,2,3,4].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(headerAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
      ...anims.map(a => Animated.timing(a, { toValue: 1, duration: 480, useNativeDriver: true })),
    ]).start();
  }, []);

  const handleMorningToggle = async (val) => {
    setNotifMorning(val);
    if (val) {
      await scheduleMorningMotivation(9, 0);
    } else {
      await cancelMorningNotifications();
    }
  };

  const handleComingSoon = () => {
    setShowComingSoon(true);
    setTimeout(() => setShowComingSoon(false), 2500);
  };

  const isPremium  = user?.membershipTier === 'premium';
  const initials   = getInitials(user?.displayName || '');

  return (
    <SafeAreaView style={s.container} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────── */}
      <Animated.View
        style={{
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0,1], outputRange: [-10, 0] }) }],
        }}
      >
        <LinearGradient
          colors={Gradients.teal}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.header}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Settings</Text>
            <OrnamentRule light />
            <Text style={s.headerSub}>SACRED SANCTUM</Text>
          </View>
          <View style={{ width: 34 }} />
        </LinearGradient>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >

        {/* ── User identity card ───────────────────────────── */}
        <FadeSlide anim={anims[0]}>
          <View style={s.identityCard}>
            <View style={s.identityAccent} />
            <View style={s.identityBody}>
              <View style={s.identityAvatarRing}>
                <Text style={s.identityInitials}>{initials}</Text>
              </View>
              <View style={s.identityText}>
                <Text style={s.identityName}>{user?.displayName || 'Your Name'}</Text>
                <Text style={s.identityEmail}>{user?.email}</Text>
                <View style={[s.identityTierBadge, isPremium && s.identityTierBadgePremium]}>
                  <Text style={[s.identityTierText, isPremium && s.identityTierTextPremium]}>
                    {isPremium ? '✦  PREMIUM MEMBER' : '◎  FREE MEMBER'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </FadeSlide>

        {/* ── Notifications ────────────────────────────────── */}
        <FadeSlide anim={anims[1]}>
          <SettingGroup label="NOTIFICATIONS">
            <ToggleRow
              label="New Teaching Posted"
              sub="When Rabbi uploads a new video"
              value={notifNewVideo}
              onChange={setNotifNewVideo}
            />
            <ToggleRow
              label="Rabbi Goes Live"
              sub="Instant alert when session starts"
              value={notifLive}
              onChange={setNotifLive}
            />
            <ToggleRow
              label="Morning Intention"
              sub="Daily guidance delivered at 9:00 AM"
              value={notifMorning}
              onChange={handleMorningToggle}
            />
            <ToggleRow
              label="Community Activity"
              sub="Replies and mentions in your posts"
              value={notifCommunity}
              onChange={setNotifCommunity}
              isLast
            />
          </SettingGroup>
        </FadeSlide>

        {/* ── Account ──────────────────────────────────────── */}
        <FadeSlide anim={anims[2]}>
          <SettingGroup label="ACCOUNT">
            <ActionRow
              glyph="◎"
              label="Edit Profile"
              sub="Name, Hebrew name, mother's name"
              onPress={() => navigation.navigate('Profile')}
            />
            <ActionRow
              glyph="✦"
              label="Subscription"
              sub="Manage your membership tier"
              onPress={handleComingSoon}
            />
            <ActionRow
              glyph="☉"
              label="Privacy Policy"
              onPress={() => {}}
            />
            <ActionRow
              glyph="◈"
              label="Terms of Service"
              onPress={() => {}}
            />
            <ActionRow
              glyph="◇"
              label="Contact Support"
              sub="We're here to help"
              onPress={() => {}}
              isLast
            />
          </SettingGroup>
        </FadeSlide>

        {/* ── Developer ────────────────────────────────────── */}
        <FadeSlide anim={anims[3]}>
          <SettingGroup label="DEVELOPER">
            <ActionRow
              glyph="↺"
              label="Redo Soul Assessment"
              sub="Clears your soul profile and restarts the quiz"
              onPress={() => setShowResetModal(true)}
              isLast
            />
          </SettingGroup>
        </FadeSlide>

        {/* ── Sign Out ──────────────────────────────────────── */}
        <FadeSlide anim={anims[4]}>
          <TouchableOpacity
            style={s.signOutBtn}
            onPress={() => setShowSignOutModal(true)}
            activeOpacity={0.8}
          >
            <View style={s.signOutInner}>
              <Text style={s.signOutGlyph}>→</Text>
              <Text style={s.signOutText}>Sign Out</Text>
            </View>
          </TouchableOpacity>

          {/* Version */}
          <View style={s.versionRow}>
            <View style={s.versionLine} />
            <Text style={s.versionText}>Rivnitz v1.0.0</Text>
            <Text style={s.versionDot}>✦</Text>
            <Text style={s.versionText}>Miracles Through Mission</Text>
            <View style={s.versionLine} />
          </View>
        </FadeSlide>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      {/* ── Sign Out Modal ───────────────────────────────────── */}
      <ConfirmModal
        visible={showSignOutModal}
        glyph="→"
        title="Sign Out"
        message="Are you sure you want to sign out of your account?"
        confirmLabel="Sign Out"
        confirmDestructive
        onConfirm={() => { setShowSignOutModal(false); signOut(); }}
        onCancel={() => setShowSignOutModal(false)}
      />

      {/* ── Reset Modal ──────────────────────────────────────── */}
      <ConfirmModal
        visible={showResetModal}
        glyph="↺"
        title="Redo Soul Assessment"
        message="This will clear your soul profile and restart the quiz. This cannot be undone."
        confirmLabel="Reset & Restart"
        confirmDestructive
        onConfirm={async () => { setShowResetModal(false); await resetQuiz(); }}
        onCancel={() => setShowResetModal(false)}
      />

      {/* ── Coming Soon Toast ─────────────────────────────────── */}
      <ComingSoonToast visible={showComingSoon} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md + 4,
  },
  backBtn: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: {
    fontSize: Typography.sizes.xl,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 26,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize: 30,
    color: Colors.white,
    letterSpacing: 0.5,
    lineHeight: 34,
  },
  headerSub: {
    fontSize: 8, letterSpacing: 3,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: Typography.bodyMedium,
  },

  // ── Scroll ───────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    gap: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },

  // ── Identity card ─────────────────────────────────────────────────
  identityCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(27,107,107,0.12)',
    ...Shadows.sm,
  },
  identityAccent: { width: 3.5, backgroundColor: Colors.teal },
  identityBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  identityAvatarRing: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(212,147,58,0.45)',
    backgroundColor: 'rgba(212,147,58,0.1)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  identityInitials: {
    fontFamily: Typography.heading,
    fontSize: 20,
    color: Colors.tealDark,
    letterSpacing: 0.5,
  },
  identityText: { flex: 1, gap: 3 },
  identityName: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes.xl,
    color: Colors.tealDark,
    letterSpacing: 0.2,
    lineHeight: 24,
  },
  identityEmail: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
  },
  identityTierBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.tealPale,
    borderRadius: Radius.full,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: 'rgba(27,107,107,0.15)',
    marginTop: 2,
  },
  identityTierBadgePremium: {
    backgroundColor: Colors.goldPale,
    borderColor: 'rgba(212,147,58,0.3)',
  },
  identityTierText: {
    fontSize: 8, letterSpacing: 1.5,
    color: Colors.teal,
    fontFamily: Typography.bodyMedium,
  },
  identityTierTextPremium: { color: Colors.gold },

  // ── Section group ─────────────────────────────────────────────────
  group: { gap: Spacing.sm },
  groupCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.1)',
    ...Shadows.sm,
  },

  // ── Rows ─────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(212,147,58,0.07)',
    marginLeft: Spacing.base + 22,
  },

  // Toggle row dot indicator
  rowDot: {
    width: 7, height: 7, borderRadius: 4,
    flexShrink: 0,
  },

  // Action row glyph
  rowGlyphWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.tealPale,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(27,107,107,0.12)',
  },
  rowGlyphWrapDestructive: {
    backgroundColor: 'rgba(224,92,92,0.07)',
    borderColor: 'rgba(224,92,92,0.18)',
  },
  rowGlyph: {
    fontSize: 13,
    color: Colors.teal,
    fontFamily: Typography.bodySemiBold,
  },
  rowGlyphDestructive: { color: Colors.error },

  rowContent: { flex: 1 },
  rowLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontFamily: Typography.body,
    lineHeight: 20,
  },
  rowLabelDestructive: { color: Colors.error },
  rowSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    marginTop: 1,
    lineHeight: 16,
  },
  chevron: {
    fontSize: Typography.sizes.xl,
    color: 'rgba(27,107,107,0.3)',
    lineHeight: 24,
  },
  chevronDestructive: { color: 'rgba(224,92,92,0.4)' },

  // ── Sign Out ──────────────────────────────────────────────────────
  signOutBtn: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.2)',
    overflow: 'hidden',
    ...Shadows.sm,
  },
  signOutInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
  },
  signOutGlyph: {
    fontSize: Typography.sizes.base,
    color: Colors.error,
    fontFamily: Typography.bodySemiBold,
    transform: [{ rotate: '180deg' }],
  },
  signOutText: {
    fontSize: Typography.sizes.base,
    color: Colors.error,
    fontFamily: Typography.bodyMedium,
    letterSpacing: 0.3,
  },

  // ── Version ───────────────────────────────────────────────────────
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  versionLine: { flex: 1, height: 1, backgroundColor: 'rgba(212,147,58,0.15)' },
  versionDot:  { fontSize: 7, color: 'rgba(212,147,58,0.4)' },
  versionText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    opacity: 0.7,
  },
});

// ─── Modal Styles ─────────────────────────────────────────────────
const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4,20,20,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    ...Shadows.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.15)',
  },
  glyphRing: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.tealPale,
    borderWidth: 1.5, borderColor: 'rgba(27,107,107,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  glyphRingDestructive: {
    backgroundColor: 'rgba(224,92,92,0.07)',
    borderColor: 'rgba(224,92,92,0.2)',
  },
  glyphText: {
    fontSize: 20,
    color: Colors.teal,
    fontFamily: Typography.bodySemiBold,
  },
  glyphTextDestructive: { color: Colors.error },
  title: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes['2xl'],
    color: Colors.tealDark,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: 0.3,
  },
  message: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
    fontStyle: 'italic',
  },
  actions: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.creamDark,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cancelText: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: Colors.teal,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  confirmBtnDestructive: {
    backgroundColor: 'rgba(224,92,92,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.3)',
  },
  confirmText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.sm,
    color: Colors.white,
  },
  confirmTextDestructive: { color: Colors.error },
});

// ─── Toast Styles ─────────────────────────────────────────────────
const ts = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 40,
    left: Spacing.xl,
    right: Spacing.xl,
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.tealDark,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.3)',
    ...Shadows.lg,
  },
  glyph: {
    fontSize: 14,
    color: Colors.goldLight,
    fontFamily: Typography.bodySemiBold,
  },
  title: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.sm,
    color: Colors.white,
  },
  sub: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.xs,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
});
