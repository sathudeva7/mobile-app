/**
 * PhotoReadingScreen — 3-step spiritual photo collection
 * Step 1: Face  → GPT-4o vision → face reading insight
 * Step 2: Right hand → palm reading insight
 * Step 3: Left hand  → palm reading insight
 * On complete: saves insights to Firestore, navigates to ProfileReveal
 * Note: photos are used for AI analysis only — not stored (no Firebase Storage needed)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { analyzePhoto } from '../../services/aiCoach';
import { useAuthStore } from '../../store/authStore';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';

// ─── Step config ──────────────────────────────────────────────────
const STEPS = [
  {
    key: 'face',
    stepNumber: 1,
    title: 'Face Reading',
    subtitle: 'Step 1 of 3',
    instruction: 'Take a clear front-facing selfie in good lighting.',
    spiritual: 'Your face is a sacred map — the Zohar teaches that the Sephirot are reflected in every feature.',
    aspect: [1, 1],
  },
  {
    key: 'rightHand',
    stepNumber: 2,
    title: 'Right Hand Reading',
    subtitle: 'Step 2 of 3',
    instruction: 'Photograph your right palm flat, fingers together, in clear light.',
    spiritual: 'Your right hand is the vessel of Chesed — the hand you extend to the world.',
    aspect: [3, 4],
  },
  {
    key: 'leftHand',
    stepNumber: 3,
    title: 'Left Hand Reading',
    subtitle: 'Step 3 of 3',
    instruction: 'Photograph your left palm flat, fingers together, in clear light.',
    spiritual: 'Your left hand is the vessel of Gevurah — the seat of your inner world and hidden strengths.',
    aspect: [3, 4],
  },
];

export default function PhotoReadingScreen({ navigation, route }) {
  const { tritype, isCounterphobic } = route.params || {};
  const { user, completePhotoReading } = useAuthStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [photoData, setPhotoData] = useState({
    face:      { uri: null, base64: null, insight: null },
    rightHand: { uri: null, base64: null, insight: null },
    leftHand:  { uri: null, base64: null, insight: null },
  });
  const [isAnalyzing, setIsAnalyzing]   = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [isUploading, setIsUploading]   = useState(false);

  const step = STEPS[currentStep];
  const current = photoData[step.key];

  // ── Photo handling ────────────────────────────────────────────
  async function handlePhotoSelected(asset) {
    setAnalyzeError(null);
    setPhotoData(prev => ({
      ...prev,
      [step.key]: { uri: asset.uri, base64: asset.base64, insight: null },
    }));

    setIsAnalyzing(true);
    try {
      const insight = await analyzePhoto({
        type: step.key,
        base64: asset.base64,
        tritype,
        isCounterphobic,
      });
      setPhotoData(prev => ({
        ...prev,
        [step.key]: { ...prev[step.key], insight },
      }));
    } catch (err) {
      console.error('analyzePhoto error:', err);
      setAnalyzeError('Unable to read your photo. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      aspect: step.aspect,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      handlePhotoSelected(result.assets[0]);
    }
  }

  async function handleChooseFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      handlePhotoSelected(result.assets[0]);
    }
  }

  async function handleRetry() {
    if (!current.base64) return;
    setAnalyzeError(null);
    setIsAnalyzing(true);
    try {
      const insight = await analyzePhoto({
        type: step.key,
        base64: current.base64,
        tritype,
        isCounterphobic,
      });
      setPhotoData(prev => ({
        ...prev,
        [step.key]: { ...prev[step.key], insight },
      }));
    } catch (err) {
      setAnalyzeError('Unable to read your photo. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleContinue() {
    if (currentStep < STEPS.length - 1) {
      setAnalyzeError(null);
      setCurrentStep(currentStep + 1);
    } else {
      handleCompleteAllSteps();
    }
  }

  async function handleCompleteAllSteps() {
    setIsUploading(true);
    try {
      const faceInsights = photoData.face.insight || '';
      const handInsights = `Right Hand: ${photoData.rightHand.insight || ''}\n\nLeft Hand: ${photoData.leftHand.insight || ''}`;

      await completePhotoReading({
        photoUrls: null,
        faceReadingInsights: faceInsights,
        handReadingInsights: handInsights,
      });

      navigation.replace('ProfileReveal', {
        tritype,
        isCounterphobic,
        faceInsights,
        handInsights,
      });
    } catch (err) {
      console.error('Save error:', err);
      setIsUploading(false);
      Alert.alert('Error', 'Could not save your reading. Please try again.');
    }
  }

  // ── Step indicator ────────────────────────────────────────────
  function StepDots() {
    return (
      <View style={styles.stepDots}>
        {STEPS.map((s, i) => (
          <View
            key={s.key}
            style={[
              styles.dot,
              i < currentStep  && styles.dotDone,
              i === currentStep && styles.dotCurrent,
              i > currentStep  && styles.dotFuture,
            ]}
          />
        ))}
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <LinearGradient colors={Gradients.teal} style={styles.header}>
        <StepDots />
        <Text style={styles.headerTitle}>{step.title}</Text>
        <Text style={styles.headerSubtitle}>{step.subtitle}</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* No photo yet */}
        {!current.uri && (
          <>
            <View style={styles.spiritualCard}>
              <Text style={styles.spiritualStar}>✦</Text>
              <Text style={styles.spiritualText}>{step.spiritual}</Text>
            </View>
            <Text style={styles.instruction}>{step.instruction}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleTakePhoto}>
              <Text style={styles.primaryBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleChooseFromLibrary}>
              <Text style={styles.secondaryBtnText}>Choose from Library</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Photo selected — analyzing */}
        {current.uri && isAnalyzing && (
          <>
            <Image source={{ uri: current.uri }} style={styles.photoPreview} resizeMode="cover" />
            <View style={styles.analyzingCard}>
              <ActivityIndicator size="large" color={Colors.gold} />
              <Text style={styles.analyzingText}>Reading your soul...</Text>
              <Text style={styles.analyzingSubText}>The ancient wisdom is speaking</Text>
            </View>
          </>
        )}

        {/* Insight ready */}
        {current.uri && !isAnalyzing && current.insight && !analyzeError && (
          <>
            <Image source={{ uri: current.uri }} style={styles.photoPreview} resizeMode="cover" />
            <View style={styles.insightCard}>
              <Text style={styles.insightStar}>✦</Text>
              <Text style={styles.insightText}>{current.insight}</Text>
            </View>
            <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
              <LinearGradient colors={Gradients.gold} style={styles.continueBtnInner}>
                <Text style={styles.continueBtnText}>
                  {currentStep < STEPS.length - 1 ? 'Continue →' : 'Complete Reading →'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.retakeBtn} onPress={handleTakePhoto}>
              <Text style={styles.retakeBtnText}>Retake Photo</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Error state */}
        {analyzeError && (
          <>
            {current.uri && (
              <Image source={{ uri: current.uri }} style={styles.photoPreview} resizeMode="cover" />
            )}
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{analyzeError}</Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleRetry}>
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleTakePhoto}>
              <Text style={styles.secondaryBtnText}>Take New Photo</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Upload overlay */}
      {isUploading && (
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadCard}>
            <ActivityIndicator size="large" color={Colors.teal} />
            <Text style={styles.uploadText}>Saving your reading...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
  },
  stepDots: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
  },
  dotDone: {
    backgroundColor: Colors.gold,
  },
  dotCurrent: {
    backgroundColor: Colors.gold,
    width: 24,
  },
  dotFuture: {
    backgroundColor: 'rgba(212,147,58,0.3)',
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes['3xl'],
    color: Colors.white,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.sm,
    color: Colors.goldLight,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: Typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing['4xl'],
    gap: Spacing.base,
  },
  spiritualCard: {
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.gold,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  spiritualStar: {
    fontSize: 20,
    color: Colors.gold,
  },
  spiritualText: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.md,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: Typography.sizes.md * Typography.lineHeights.relaxed,
  },
  instruction: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
  },
  primaryBtn: {
    backgroundColor: Colors.teal,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    ...Shadows.md,
  },
  primaryBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.base,
    color: Colors.white,
  },
  secondaryBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.base,
    color: Colors.teal,
  },
  photoPreview: {
    width: '100%',
    height: 280,
    borderRadius: Radius.lg,
    ...Shadows.md,
  },
  analyzingCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.md,
  },
  analyzingText: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes['2xl'],
    color: Colors.teal,
    textAlign: 'center',
  },
  analyzingSubText: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.md,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  insightCard: {
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.gold,
    padding: Spacing.xl,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  insightStar: {
    fontSize: 18,
    color: Colors.gold,
    textAlign: 'center',
  },
  insightText: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
    textAlign: 'center',
  },
  continueBtn: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.gold,
  },
  continueBtnInner: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  continueBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.base,
    color: Colors.white,
  },
  retakeBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  retakeBtnText: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  errorCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: Radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
    padding: Spacing.lg,
  },
  errorText: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.md,
    color: Colors.error,
    textAlign: 'center',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlayDark,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.lg,
    minWidth: 200,
  },
  uploadText: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.base,
    color: Colors.teal,
    textAlign: 'center',
  },
});
