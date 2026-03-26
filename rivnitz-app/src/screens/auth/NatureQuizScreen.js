/**
 * NatureQuizScreen — Full Personality Assessment
 *
 * Flow:
 *   1. Welcome → Enneagram MCQ (Head → Heart → Gut)
 *   2. MBTI MCQ
 *   3. Image Upload (Face, Right Thumb, Left Thumb)
 *   4. AI Analysis → Results
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { ENNEAGRAM_QUESTIONS, scoreEnneagram } from '../../data/enneagramQuestions';
import { MBTI_QUESTIONS, scoreMBTI } from '../../data/mbtiQuestions';
import { findTriType } from '../../data/triTypes';

const PHASES = ['Enneagram', 'MBTI', 'Images', 'Results'];

export default function NatureQuizScreen({ navigation }) {
  const { user, completeNatureQuiz } = useAuthStore();

  // Phase tracking
  const [phase, setPhase] = useState('welcome'); // welcome, enneagram, mbti, images, analyzing, results
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Enneagram state
  const [enneagramCenter, setEnneagramCenter] = useState('head'); // head, heart, gut
  const [enneagramAnswers, setEnneagramAnswers] = useState({ head: [], heart: [], gut: [] });

  // MBTI state
  const [mbtiAnswers, setMbtiAnswers] = useState([]);

  // Image state
  const [faceImage, setFaceImage] = useState(null);
  const [rightThumbImage, setRightThumbImage] = useState(null);
  const [leftThumbImage, setLeftThumbImage] = useState(null);

  // Results
  const [results, setResults] = useState(null);

  // Get current questions based on phase
  const getEnneagramQuestions = () => ENNEAGRAM_QUESTIONS[enneagramCenter] || [];
  const currentEnneagramQuestion = getEnneagramQuestions()[currentQuestionIndex];
  const currentMBTIQuestion = MBTI_QUESTIONS[currentQuestionIndex];

  // Progress calculation
  const getProgress = () => {
    if (phase === 'enneagram') {
      const centersCompleted = { head: 0, heart: 1, gut: 2 }[enneagramCenter] || 0;
      const totalEnneagram = 18; // 6 per center
      const done = centersCompleted * 6 + currentQuestionIndex;
      return done / (totalEnneagram + 16 + 1); // +16 MBTI +1 images
    }
    if (phase === 'mbti') {
      return (18 + currentQuestionIndex) / 35;
    }
    if (phase === 'images') return 34 / 35;
    return 1;
  };

  // Handle enneagram answer
  const handleEnneagramAnswer = (selectedType) => {
    const newAnswers = { ...enneagramAnswers };
    newAnswers[enneagramCenter] = [
      ...newAnswers[enneagramCenter],
      { questionId: currentEnneagramQuestion.id, selectedType },
    ];
    setEnneagramAnswers(newAnswers);

    const questions = getEnneagramQuestions();
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Move to next center or MBTI
      if (enneagramCenter === 'head') {
        setEnneagramCenter('heart');
        setCurrentQuestionIndex(0);
      } else if (enneagramCenter === 'heart') {
        setEnneagramCenter('gut');
        setCurrentQuestionIndex(0);
      } else {
        // Enneagram complete, move to MBTI
        setPhase('mbti');
        setCurrentQuestionIndex(0);
      }
    }
  };

  // Handle MBTI answer
  const handleMBTIAnswer = (selectedPole, dimension) => {
    const newAnswers = [...mbtiAnswers, { questionId: currentMBTIQuestion.id, selectedPole, dimension }];
    setMbtiAnswers(newAnswers);

    if (currentQuestionIndex < MBTI_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setPhase('images');
    }
  };

  // Pick image
  const pickImage = async (setter) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      // Fallback to library
      const libStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libStatus.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your camera or photos.');
        return;
      }
    }

    Alert.alert('Upload Image', 'Choose how to upload', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true, aspect: [1, 1], quality: 0.7,
          });
          if (!result.canceled) setter(result.assets[0].uri);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true, aspect: [1, 1], quality: 0.7,
          });
          if (!result.canceled) setter(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Analyze and compute results
  const analyzeResults = async () => {
    setPhase('analyzing');

    try {
      // Score enneagram
      const enneagram = scoreEnneagram(enneagramAnswers);

      // Score MBTI
      const mbtiType = scoreMBTI(mbtiAnswers);

      // Find matching tri-type
      const triType = findTriType(enneagram.headType, enneagram.heartType, enneagram.gutType);

      const finalResults = {
        personalityType: triType?.name || 'Seeker',
        triType: triType?.triType || 'unknown',
        mbtiType,
        enneagramType: `${enneagram.headType}-${enneagram.heartType}-${enneagram.gutType}`,
        headType: enneagram.headType,
        heartType: enneagram.heartType,
        gutType: enneagram.gutType,
        headSephira: triType?.headSephira || '',
        heartSephira: triType?.heartSephira || '',
        gutSephira: triType?.gutSephira || '',
        hebrewName: triType?.hebrewName || '',
        lifeMission: triType?.lifeMission || '',
        archetype: triType?.archetype || '',
        coreFears: triType?.coreFears || '',
        blindSpot: triType?.blindSpot || '',
        humanDesignType: null,
        faceReadingData: faceImage ? { imageUri: faceImage } : null,
        handReadingData: {
          rightThumb: rightThumbImage ? { imageUri: rightThumbImage } : null,
          leftThumb: leftThumbImage ? { imageUri: leftThumbImage } : null,
        },
      };

      setResults(finalResults);
      setPhase('results');
    } catch (e) {
      console.error('Analysis error:', e);
      Alert.alert('Error', 'Something went wrong during analysis. Please try again.');
      setPhase('images');
    }
  };

  // Complete and save
  const handleComplete = async () => {
    if (!results) return;
    await completeNatureQuiz(results);
    navigation.replace('Drawer');
  };

  // Get phase label for progress
  const getPhaseIndex = () => {
    if (phase === 'enneagram') return 0;
    if (phase === 'mbti') return 1;
    if (phase === 'images') return 2;
    return 3;
  };

  // ─── Welcome Screen ───────────────────────────────────────────
  if (phase === 'welcome') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LinearGradient colors={Gradients.teal} style={styles.welcomeContainer}>
          <Text style={styles.welcomeEmoji}>🌿</Text>
          <Text style={styles.welcomeTitle}>Discover Your Nature</Text>
          <Text style={styles.welcomeSubtitle}>
            We are going to guide you through a series of questions to understand your unique personality.
            {'\n\n'}This will take about 5-8 minutes and includes:
          </Text>
          <View style={styles.welcomeSteps}>
            <Text style={styles.welcomeStep}>✦  Enneagram Tri-Type Assessment</Text>
            <Text style={styles.welcomeStep}>✦  MBTI Personality Assessment</Text>
            <Text style={styles.welcomeStep}>✦  Face & Hand Image Upload</Text>
          </View>
          <Text style={styles.welcomeNote}>
            Your answers will shape every coaching response you receive.
            {'\n'}There are no right or wrong answers — just be yourself.
          </Text>
          <TouchableOpacity
            style={styles.welcomeBtn}
            onPress={() => setPhase('enneagram')}
          >
            <Text style={styles.welcomeBtnText}>Begin Assessment →</Text>
          </TouchableOpacity>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ─── Analyzing Screen ──────────────────────────────────────────
  if (phase === 'analyzing') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LinearGradient colors={Gradients.teal} style={styles.analyzingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.analyzingTitle}>Analyzing Your Nature...</Text>
          <Text style={styles.analyzingText}>
            Combining your Enneagram, MBTI, and imagery data to reveal your unique spiritual profile.
          </Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ─── Results Screen ────────────────────────────────────────────
  if (phase === 'results' && results) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LinearGradient colors={Gradients.teal} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.resultsContainer}>
            <Text style={styles.resultsEmoji}>✦</Text>
            <Text style={styles.resultsLabel}>YOUR NATURE REVEALED</Text>
            <Text style={styles.resultsType}>{results.personalityType}</Text>
            {results.hebrewName ? (
              <Text style={styles.resultsHebrew}>{results.hebrewName}</Text>
            ) : null}

            <View style={styles.resultsCards}>
              <View style={styles.resultCard}>
                <Text style={styles.resultCardLabel}>TRI-TYPE</Text>
                <Text style={styles.resultCardValue}>{results.triType}</Text>
              </View>
              <View style={styles.resultCard}>
                <Text style={styles.resultCardLabel}>MBTI</Text>
                <Text style={styles.resultCardValue}>{results.mbtiType}</Text>
              </View>
            </View>

            <View style={styles.resultsSephiraRow}>
              <View style={styles.sephiraChip}>
                <Text style={styles.sephiraLabel}>Head</Text>
                <Text style={styles.sephiraValue}>{results.headSephira}</Text>
              </View>
              <View style={styles.sephiraChip}>
                <Text style={styles.sephiraLabel}>Heart</Text>
                <Text style={styles.sephiraValue}>{results.heartSephira}</Text>
              </View>
              <View style={styles.sephiraChip}>
                <Text style={styles.sephiraLabel}>Gut</Text>
                <Text style={styles.sephiraValue}>{results.gutSephira}</Text>
              </View>
            </View>

            {results.lifeMission ? (
              <View style={styles.missionCard}>
                <Text style={styles.missionLabel}>YOUR LIFE MISSION</Text>
                <Text style={styles.missionText}>{results.lifeMission}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.continueBtn} onPress={handleComplete}>
              <Text style={styles.continueBtnText}>Begin My Journey →</Text>
            </TouchableOpacity>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ─── Image Upload Screen ───────────────────────────────────────
  if (phase === 'images') {
    const allImages = faceImage && rightThumbImage && leftThumbImage;
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={Gradients.teal} style={styles.header}>
          <Text style={styles.headerTitle}>Upload Your Images</Text>
          <Text style={styles.headerSub}>Step 3 of 3 — Face & Hand Reading</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '90%' }]} />
          </View>
        </LinearGradient>

        <ScrollView style={styles.imagesContent} contentContainerStyle={styles.imagesInner}>
          <Text style={styles.imagesDescription}>
            Upload a clear photo of your face and both thumbs. These will be used alongside your assessment to build a complete behavioral profile.
          </Text>

          {/* Face */}
          <TouchableOpacity style={styles.imageUploadCard} onPress={() => pickImage(setFaceImage)}>
            {faceImage ? (
              <Image source={{ uri: faceImage }} style={styles.uploadedImage} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Text style={styles.uploadIcon}>📸</Text>
                <Text style={styles.uploadLabel}>Face Photo</Text>
                <Text style={styles.uploadHint}>Clear, front-facing photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.thumbRow}>
            {/* Right Thumb */}
            <TouchableOpacity style={styles.thumbUploadCard} onPress={() => pickImage(setRightThumbImage)}>
              {rightThumbImage ? (
                <Image source={{ uri: rightThumbImage }} style={styles.uploadedThumb} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Text style={styles.uploadIcon}>👍</Text>
                  <Text style={styles.uploadLabel}>Right Thumb</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Left Thumb */}
            <TouchableOpacity style={styles.thumbUploadCard} onPress={() => pickImage(setLeftThumbImage)}>
              {leftThumbImage ? (
                <Image source={{ uri: leftThumbImage }} style={styles.uploadedThumb} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Text style={styles.uploadIcon}>👍</Text>
                  <Text style={styles.uploadLabel}>Left Thumb</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.analyzeBtn, !allImages && styles.analyzeBtnDisabled]}
            onPress={allImages ? analyzeResults : () => {
              Alert.alert('Upload All Images', 'Please upload your face photo and both thumb images to continue.');
            }}
          >
            <Text style={styles.analyzeBtnText}>
              {allImages ? 'Analyze My Nature →' : 'Upload All 3 Images'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={analyzeResults}>
            <Text style={styles.skipBtnText}>Skip images for now →</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── MCQ Screen (Enneagram & MBTI) ────────────────────────────
  const isEnneagram = phase === 'enneagram';
  const question = isEnneagram ? currentEnneagramQuestion : currentMBTIQuestion;

  if (!question) return null;

  const centerLabel = isEnneagram
    ? { head: 'How You Think', heart: 'How You Feel', gut: 'How You Act' }[enneagramCenter]
    : 'Personality Style';

  const phaseLabel = isEnneagram ? 'Enneagram' : 'MBTI';
  const totalInPhase = isEnneagram ? getEnneagramQuestions().length : MBTI_QUESTIONS.length;
  const progress = getProgress();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={Gradients.teal} style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>{phaseLabel} Assessment</Text>
            <Text style={styles.headerSub}>{centerLabel}</Text>
          </View>
          <View style={styles.questionCounter}>
            <Text style={styles.questionCounterText}>
              {currentQuestionIndex + 1}/{totalInPhase}
            </Text>
          </View>
        </View>
        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        {/* Phase chips */}
        <View style={styles.phaseChips}>
          {PHASES.map((p, i) => (
            <View
              key={p}
              style={[styles.phaseChip, i <= getPhaseIndex() ? styles.phaseChipActive : styles.phaseChipInactive]}
            >
              <Text style={[styles.phaseChipText, i <= getPhaseIndex() ? styles.phaseChipTextActive : styles.phaseChipTextInactive]}>
                {i < getPhaseIndex() ? `${p} ✓` : p}
              </Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Question */}
      <ScrollView style={styles.questionArea} contentContainerStyle={styles.questionAreaInner}>
        <Text style={styles.questionText}>{question.question}</Text>

        {question.options.map((option, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.optionCard}
            onPress={() => {
              if (isEnneagram) {
                handleEnneagramAnswer(option.type);
              } else {
                handleMBTIAnswer(option.pole, question.dimension);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.optionLetter}>
              <Text style={styles.optionLetterText}>
                {String.fromCharCode(65 + idx)}
              </Text>
            </View>
            <Text style={styles.optionText}>{option.text}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },

  // Welcome
  welcomeContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  welcomeEmoji: { fontSize: 56, marginBottom: Spacing.md },
  welcomeTitle: { fontFamily: Typography.heading, fontSize: Typography.sizes['4xl'], color: Colors.white, textAlign: 'center', marginBottom: Spacing.md },
  welcomeSubtitle: { fontSize: Typography.sizes.md, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 22, fontFamily: Typography.body },
  welcomeSteps: { marginVertical: Spacing.lg, alignSelf: 'stretch', paddingHorizontal: Spacing.lg },
  welcomeStep: { fontSize: Typography.sizes.md, color: Colors.goldLight, fontFamily: Typography.bodyMedium, marginBottom: Spacing.sm },
  welcomeNote: { fontSize: Typography.sizes.sm, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20, fontFamily: Typography.body, marginTop: Spacing.md },
  welcomeBtn: { backgroundColor: Colors.gold, borderRadius: Radius.xl, paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.base, marginTop: Spacing.xl, ...Shadows.gold },
  welcomeBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.lg, color: Colors.white },

  // Header
  header: { padding: Spacing.base, paddingBottom: Spacing.md },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  headerTitle: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.lg, color: Colors.white },
  headerSub: { fontSize: Typography.sizes.sm, color: Colors.goldLight, marginTop: 2 },
  questionCounter: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  questionCounterText: { fontSize: Typography.sizes.sm, color: Colors.white, fontFamily: Typography.bodySemiBold },

  // Progress bar
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginVertical: Spacing.sm },
  progressFill: { height: 4, backgroundColor: Colors.gold, borderRadius: 2 },

  // Phase chips
  phaseChips: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', marginTop: Spacing.xs },
  phaseChip: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  phaseChipActive: { backgroundColor: Colors.gold },
  phaseChipInactive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  phaseChipText: { fontSize: Typography.sizes.xs, fontFamily: Typography.bodyMedium },
  phaseChipTextActive: { color: Colors.white },
  phaseChipTextInactive: { color: 'rgba(255,255,255,0.6)' },

  // Question area
  questionArea: { flex: 1 },
  questionAreaInner: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
  questionText: { fontFamily: Typography.heading, fontSize: Typography.sizes['2xl'], color: Colors.tealDark, marginBottom: Spacing.xl, lineHeight: 32 },

  // Option cards
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.base,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  optionLetter: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.tealPale, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  optionLetterText: { fontSize: Typography.sizes.sm, fontFamily: Typography.bodySemiBold, color: Colors.teal },
  optionText: { flex: 1, fontSize: Typography.sizes.md, color: Colors.textPrimary, fontFamily: Typography.body, lineHeight: 21 },

  // Images phase
  imagesContent: { flex: 1 },
  imagesInner: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
  imagesDescription: { fontSize: Typography.sizes.md, color: Colors.textMuted, fontFamily: Typography.body, lineHeight: 22, marginBottom: Spacing.xl, textAlign: 'center' },
  imageUploadCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 2, borderStyle: 'dashed',
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    height: 200, marginBottom: Spacing.lg, overflow: 'hidden',
  },
  thumbRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  thumbUploadCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 2, borderStyle: 'dashed',
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    height: 150, overflow: 'hidden',
  },
  uploadPlaceholder: { alignItems: 'center', gap: Spacing.xs },
  uploadIcon: { fontSize: 32 },
  uploadLabel: { fontSize: Typography.sizes.md, fontFamily: Typography.bodySemiBold, color: Colors.tealDark },
  uploadHint: { fontSize: Typography.sizes.xs, color: Colors.textMuted },
  uploadedImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  uploadedThumb: { width: '100%', height: '100%', resizeMode: 'cover' },
  analyzeBtn: { backgroundColor: Colors.gold, borderRadius: Radius.xl, paddingVertical: Spacing.base, alignItems: 'center', ...Shadows.gold },
  analyzeBtnDisabled: { opacity: 0.6 },
  analyzeBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.lg, color: Colors.white },
  skipBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  skipBtnText: { fontSize: Typography.sizes.sm, color: Colors.textMuted, fontFamily: Typography.body },

  // Analyzing
  analyzingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'], gap: Spacing.lg },
  analyzingTitle: { fontFamily: Typography.heading, fontSize: Typography.sizes['2xl'], color: Colors.white },
  analyzingText: { fontSize: Typography.sizes.md, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22, fontFamily: Typography.body },

  // Results
  resultsContainer: { alignItems: 'center', padding: Spacing['2xl'], paddingBottom: Spacing['3xl'] },
  resultsEmoji: { fontSize: 48, marginBottom: Spacing.md, marginTop: Spacing['2xl'] },
  resultsLabel: { fontFamily: Typography.body, fontSize: Typography.sizes.sm, color: Colors.goldLight, letterSpacing: 2, textTransform: 'uppercase', marginBottom: Spacing.sm },
  resultsType: { fontFamily: Typography.heading, fontSize: Typography.sizes['4xl'], color: Colors.white, marginBottom: Spacing.xs, textAlign: 'center' },
  resultsHebrew: { fontFamily: Typography.body, fontSize: Typography.sizes.xl, color: 'rgba(255,255,255,0.7)', marginBottom: Spacing.lg },
  resultsCards: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  resultCard: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'center', minWidth: 100 },
  resultCardLabel: { fontSize: Typography.sizes.xs, color: Colors.goldLight, letterSpacing: 1, marginBottom: 4 },
  resultCardValue: { fontFamily: Typography.heading, fontSize: Typography.sizes.xl, color: Colors.white },
  resultsSephiraRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  sephiraChip: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  sephiraLabel: { fontSize: Typography.sizes.xs, color: Colors.goldLight, marginBottom: 2 },
  sephiraValue: { fontSize: Typography.sizes.sm, color: Colors.white, fontFamily: Typography.bodyMedium },
  missionCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.xl, alignSelf: 'stretch' },
  missionLabel: { fontSize: Typography.sizes.xs, color: Colors.goldLight, letterSpacing: 1, marginBottom: Spacing.sm },
  missionText: { fontSize: Typography.sizes.md, color: 'rgba(255,255,255,0.9)', lineHeight: 22, fontFamily: Typography.body },
  continueBtn: { backgroundColor: Colors.gold, borderRadius: Radius.xl, paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.base, ...Shadows.gold },
  continueBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.lg, color: Colors.white },
});
