/**
 * ProfileRevealScreen — Full soul profile display
 * Shows: Tri-Type identity, life mission, face reading, hand reading, core nature.
 * Navigates to ProfileSetup on "Begin My Journey".
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { getActiveTriTypeData, sephiraEnglish } from '../../data/triTypeData';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';

export default function ProfileRevealScreen({ navigation, route }) {
  const { tritype, isCounterphobic, faceInsights, handInsights } = route.params || {};

  // Get cp-aware tritype data
  const data = getActiveTriTypeData(tritype?.code, isCounterphobic);

  // Entrance animation
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  // Sephirot display
  const headEn  = data?.headSephira  ? sephiraEnglish(data.headSephira)  : '';
  const heartEn = data?.heartSephira ? sephiraEnglish(data.heartSephira) : '';
  const gutEn   = data?.gutSephira   ? sephiraEnglish(data.gutSephira)   : '';
  const sephirot = [headEn, heartEn, gutEn].filter(Boolean).join(' · ');

  // First sentence of coreFears for display
  const coreFearsFirst = data?.coreFears
    ? data.coreFears.split('.')[0] + '.'
    : '';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={Gradients.teal} style={styles.gradient}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* ── Section 1: Identity Header ── */}
            <View style={styles.identitySection}>
              <Text style={styles.starIcon}>✦</Text>
              <Text style={styles.soulProfileLabel}>YOUR SOUL PROFILE</Text>

              {data?.hebrewName ? (
                <Text style={styles.hebrewName}>{data.hebrewName}</Text>
              ) : null}

              {data?.englishName ? (
                <Text style={styles.englishName}>{data.englishName}</Text>
              ) : null}

              {data?.code ? (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>Type {data.code}</Text>
                </View>
              ) : null}

              {sephirot ? (
                <Text style={styles.sephirot}>{sephirot}</Text>
              ) : null}
            </View>

            {/* ── Section 2: Life Mission ── */}
            {data?.lifeMissionEn ? (
              <View style={styles.missionCard}>
                <Text style={styles.cardLabel}>YOUR LIFE MISSION</Text>
                <Text style={styles.missionText}>{data.lifeMissionEn}</Text>
              </View>
            ) : null}

            {/* ── Section 3: Face Reading ── */}
            {faceInsights ? (
              <View style={styles.whiteCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconCircle}>
                    <Text style={styles.iconCircleText}>✦</Text>
                  </View>
                  <Text style={styles.whiteCardLabel}>FACE READING</Text>
                </View>
                <Text style={styles.cardBodyText}>{faceInsights}</Text>
              </View>
            ) : null}

            {/* ── Section 4: Hand Reading ── */}
            {handInsights ? (
              <View style={styles.whiteCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconCircle}>
                    <Text style={styles.iconCircleText}>✦</Text>
                  </View>
                  <Text style={styles.whiteCardLabel}>HAND READING</Text>
                </View>
                <Text style={styles.cardBodyText}>{handInsights}</Text>
              </View>
            ) : null}

            {/* ── Section 5: Core Nature ── */}
            {(data?.blindSpot || coreFearsFirst) ? (
              <View style={styles.whiteCard}>
                <Text style={styles.whiteCardLabel}>YOUR CORE NATURE</Text>
                {data?.blindSpot ? (
                  <View style={styles.natureLine}>
                    <Text style={styles.natureKey}>Blind Spot: </Text>
                    <Text style={styles.natureValue}>{data.blindSpot}</Text>
                  </View>
                ) : null}
                {coreFearsFirst ? (
                  <View style={styles.natureLine}>
                    <Text style={styles.natureKey}>Core Fear: </Text>
                    <Text style={styles.natureValue}>{coreFearsFirst}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* ── CTA ── */}
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => navigation.replace('ProfileSetup')}
              activeOpacity={0.85}
            >
              <LinearGradient colors={Gradients.gold} style={styles.ctaBtnInner}>
                <Text style={styles.ctaBtnText}>Begin My Journey →</Text>
              </LinearGradient>
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing['5xl'],
  },

  // Identity section
  identitySection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  starIcon: {
    fontSize: 36,
    color: Colors.gold,
    marginBottom: Spacing.sm,
  },
  soulProfileLabel: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.xs,
    color: Colors.gold,
    letterSpacing: Typography.letterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
  },
  hebrewName: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes['5xl'],
    color: Colors.gold,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  englishName: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes['2xl'],
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  typeBadgeText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.sm,
    color: Colors.goldLight,
    letterSpacing: Typography.letterSpacing.wide,
  },
  sephirot: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.sizes.xs,
    color: Colors.goldLight,
    letterSpacing: Typography.letterSpacing.wide,
    textAlign: 'center',
  },

  // Mission card (gold-tinted)
  missionCard: {
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.gold,
    padding: Spacing.xl,
    marginBottom: Spacing.base,
  },
  cardLabel: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.xs,
    color: Colors.gold,
    letterSpacing: Typography.letterSpacing.wider,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  missionText: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
  },

  // White cards
  whiteCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.base,
    ...Shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.goldPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleText: {
    fontSize: 14,
    color: Colors.gold,
  },
  whiteCardLabel: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.xs,
    color: Colors.teal,
    letterSpacing: Typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  cardBodyText: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
  },

  // Core nature lines
  natureLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
  },
  natureKey: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.md,
    color: Colors.teal,
  },
  natureValue: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.md,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: Typography.sizes.md * Typography.lineHeights.relaxed,
  },

  // CTA
  ctaBtn: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginTop: Spacing.lg,
    ...Shadows.gold,
  },
  ctaBtnInner: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  ctaBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.base,
    color: Colors.white,
  },
});
