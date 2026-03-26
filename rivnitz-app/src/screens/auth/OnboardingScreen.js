/**
 * OnboardingScreen
 * Welcome screens that introduce the app before the nature quiz.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Gradients } from '../../theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '🔥',
    title: 'Welcome to Rivnitz',
    subtitle: 'Miracles Through Mission',
    body: 'Join a community dedicated to spiritual growth, guided by Rabbi Landau\'s teachings.',
  },
  {
    icon: '🤖',
    title: 'Your Personal AI Coach',
    subtitle: 'Tailored to Your Nature',
    body: 'Discover your unique spiritual personality and receive guidance crafted just for you.',
  },
  {
    icon: '📈',
    title: 'Grow Every Day',
    subtitle: 'Daily Tasks & Streaks',
    body: 'Morning motivation, personalized tasks, and streak tracking to keep you on your path.',
  },
];

export default function OnboardingScreen({ navigation }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigation.replace('NatureQuiz');
    }
  };

  const handleSkip = () => {
    navigation.replace('NatureQuiz');
  };

  const slide = SLIDES[currentSlide];

  return (
    <LinearGradient colors={Gradients.teal} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        {/* Skip button */}
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Slide content */}
        <View style={styles.content}>
          <Text style={styles.icon}>{slide.icon}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
          <Text style={styles.body}>{slide.body}</Text>
        </View>

        {/* Dots + Next button */}
        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentSlide && styles.dotActive]}
              />
            ))}
          </View>
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextText}>
              {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  skipBtn: {
    alignSelf: 'flex-end',
    padding: Spacing.base,
  },
  skipText: {
    color: Colors.textLight,
    fontFamily: Typography.body,
    fontSize: Typography.sizes.base,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  icon: {
    fontSize: 64,
    marginBottom: Spacing.xl,
  },
  title: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes['4xl'],
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.sizes.lg,
    color: Colors.goldLight,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  body: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.base,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
  },
  footer: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: Colors.gold,
    width: 24,
  },
  nextBtn: {
    backgroundColor: Colors.gold,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  nextText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.lg,
    color: Colors.white,
  },
});
