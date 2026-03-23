/**
 * OnboardingScreen
 * Welcome screen after signup — introduces the Nature Discovery quiz
 * and guides users to begin their personalized journey.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Gradients } from '../../theme';

export default function OnboardingScreen({ navigation }) {
  return (
    <LinearGradient colors={Gradients.teal} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Image source={require('../../../assets/icon.png')} style={styles.logo} />
          <Text style={styles.emoji}>🌿</Text>
          <Text style={styles.title}>Discover Your Nature</Text>
          <Text style={styles.subtitle}>
            A brief, thoughtful conversation will help us understand who you are —
            so every piece of guidance can be tailored to you.
          </Text>
          <Text style={styles.duration}>Takes about 5 minutes</Text>

          <TouchableOpacity
            style={styles.cta}
            onPress={() => navigation.navigate('NatureQuiz')}
            activeOpacity={0.9}
          >
            <Text style={styles.ctaText}>Begin Nature Discovery →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skip}
            onPress={() => navigation.navigate('ProfileSetup')}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, justifyContent: 'center' },
  content: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  logo: {
    width:        56,
    height:       56,
    resizeMode:   'contain',
    marginBottom: Spacing.md,
  },
  emoji: { fontSize: 64, marginBottom: Spacing.lg },
  title: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes['3xl'],
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.md,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  duration: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.sizes.sm,
    color: Colors.goldLight,
    marginBottom: Spacing.xl,
  },
  cta: {
    backgroundColor: Colors.gold,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    minWidth: 260,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  ctaText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.md,
    color: Colors.white,
  },
  skip: { paddingVertical: Spacing.sm },
  skipText: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.7)',
  },
});
