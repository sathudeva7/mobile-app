/**
 * NatureQuizScreen — AI-Driven Tri-Type Soul Assessment
 * Stage 1: AI conversation → determines Head (5/6/7), Heart (2/3/4), Gut (1/8/9) types
 * Stage 2: Wing + MBTI (predefined binary choices)
 * Stage 3: Date of birth → Zodiac
 * Stage 4: Type Reveal with Hebrew name, archetype, life mission, Sephirot
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { getTriType, sephiraEnglish } from '../../data/triTypeData';
import { sendTriTypeMessage } from '../../services/aiCoach';

// ─── Wing options (adjacent types on the enneagram circle) ────────
const WING_OPTIONS = {
  1: [{ wing: '1w9', desc: 'More reflective and peace-seeking' },    { wing: '1w2', desc: 'More nurturing and people-oriented' }],
  2: [{ wing: '2w1', desc: 'More principled and idealistic' },       { wing: '2w3', desc: 'More ambitious and achievement-focused' }],
  3: [{ wing: '3w2', desc: 'More warm and relationship-focused' },   { wing: '3w4', desc: 'More introspective and creative' }],
  4: [{ wing: '4w3', desc: 'More expressive and driven by image' },  { wing: '4w5', desc: 'More intellectual and withdrawn' }],
  5: [{ wing: '5w4', desc: 'More creative and emotionally sensitive' }, { wing: '5w6', desc: 'More loyal and team-oriented' }],
  6: [{ wing: '6w5', desc: 'More introverted and analytical' },      { wing: '6w7', desc: 'More playful and optimistic' }],
  7: [{ wing: '7w6', desc: 'More responsible and relationship-focused' }, { wing: '7w8', desc: 'More assertive and bold' }],
  8: [{ wing: '8w7', desc: 'More adventurous and expressive' },      { wing: '8w9', desc: 'More calm and receptive' }],
  9: [{ wing: '9w8', desc: 'More assertive and direct' },            { wing: '9w1', desc: 'More principled and orderly' }],
};

// ─── MBTI questions (4 dichotomies) ───────────────────────────────
const MBTI_QUESTIONS = [
  {
    key: 'ie',
    text: 'When you need to recharge after a long or draining week, you most naturally...',
    options: [
      { label: 'Seek out people — connection and conversation restore me', value: 'E' },
      { label: 'Need time alone — solitude and quiet restore me',           value: 'I' },
    ],
  },
  {
    key: 'sn',
    text: 'When approaching a new problem or decision, you tend to focus on...',
    options: [
      { label: 'Concrete facts, practical details, and proven methods',          value: 'S' },
      { label: 'Patterns, possibilities, and the deeper meaning behind things',  value: 'N' },
    ],
  },
  {
    key: 'tf',
    text: 'When you have to make a difficult decision, you lean more toward...',
    options: [
      { label: "What makes logical sense, even if it's hard for some",  value: 'T' },
      { label: "What feels right and honours the people involved",       value: 'F' },
    ],
  },
  {
    key: 'jp',
    text: 'Your natural approach to daily life and plans is more...',
    options: [
      { label: 'Structured and decided — I like plans and clear expectations', value: 'J' },
      { label: 'Open and flexible — I prefer to adapt as things unfold',       value: 'P' },
    ],
  },
];

// ─── Zodiac from month + day ───────────────────────────────────────
function getZodiacSign(month, day) {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19))  return 'Aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20))  return 'Taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20))  return 'Gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22))  return 'Cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22))  return 'Leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22))  return 'Virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
  if ((month === 12 && day >= 22) || (month === 1  && day <= 19)) return 'Capricorn';
  if ((month === 1  && day >= 20) || (month === 2  && day <= 18)) return 'Aquarius';
  return 'Pisces';
}

// Accepts DD/MM/YYYY — returns { day, month, year, iso } or null
function parseDOB(text) {
  const parts = text.replace(/\s/g, '').split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  if (y < 1920 || y > 2015) return null;
  return {
    day: d, month: m, year: y,
    iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  };
}

// ─── Main component ───────────────────────────────────────────────

export default function NatureQuizScreen({ navigation, route }) {
  const { user, completeNatureQuiz } = useAuthStore();
  const skipProfileSetup = route?.params?.skipProfileSetup ?? false;
  const STORAGE_KEY = `quiz_progress_${user?.uid || 'guest'}`;

  // ── Quiz stage (AI MCQ) ──────────────────────────────────────────
  const [quizState,       setQuizState]       = useState('loading'); // 'loading'|'question'|'selected'
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentOptions,  setCurrentOptions]  = useState([]);
  const [selectedIndex,   setSelectedIndex]   = useState(null);
  const [history,         setHistory]         = useState([]);
  const [questionCount,   setQuestionCount]   = useState(0);

  // ── Shared state ─────────────────────────────────────────────────
  const [isCounterphobic, setIsCounterphobic] = useState(false);
  const [stage, setStage]   = useState('quiz'); // 'quiz' | 'mbti' | 'dob' | 'reveal'
  const [tritype, setTritype] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Wing + MBTI + DOB state ──────────────────────────────────────
  const [mbtiStep, setMbtiStep]       = useState(0); // 0 = wing, 1–4 = MBTI
  const [mbtiAnswers, setMbtiAnswers] = useState({ ie: null, sn: null, tf: null, jp: null });
  const [wingAnswer, setWingAnswer]   = useState(null);
  const [dobText, setDobText]         = useState('');
  const [dobError, setDobError]       = useState('');

  // ── Reveal animation ─────────────────────────────────────────────
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  // ── Save progress to AsyncStorage ────────────────────────────────
  const saveProgress = async (overrides = {}) => {
    try {
      const data = {
        stage, history, questionCount, tritype,
        isCounterphobic, mbtiStep, mbtiAnswers, wingAnswer, dobText,
        currentQuestion, currentOptions,
        ...overrides,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // Non-fatal — quiz still works without persistence
    }
  };

  // ── Clear saved progress ──────────────────────────────────────────
  const clearProgress = async () => {
    try { await AsyncStorage.removeItem(STORAGE_KEY); } catch (e) {}
  };

  // ── Boot: restore saved progress or start fresh ──────────────────
  useEffect(() => {
    const restore = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          // Restore all persisted state
          if (saved.stage)          setStage(saved.stage);
          if (saved.history)        setHistory(saved.history);
          if (saved.questionCount)  setQuestionCount(saved.questionCount);
          if (saved.tritype)        setTritype(saved.tritype);
          if (saved.mbtiStep != null) setMbtiStep(saved.mbtiStep);
          if (saved.mbtiAnswers)    setMbtiAnswers(saved.mbtiAnswers);
          if (saved.wingAnswer)     setWingAnswer(saved.wingAnswer);
          if (saved.dobText)        setDobText(saved.dobText);
          setIsCounterphobic(saved.isCounterphobic ?? false);

          // Restore question UI if mid-quiz
          if (saved.stage === 'quiz' && saved.currentQuestion) {
            setCurrentQuestion(saved.currentQuestion);
            setCurrentOptions(saved.currentOptions || []);
            setQuizState('question');
          }
          return; // Skip fresh start
        }
      } catch (e) {}
      // No saved progress — start fresh
      fetchNextQuestion([]);
    };
    restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save progress whenever meaningful state changes
  useEffect(() => {
    if (stage !== 'quiz' || questionCount > 0) {
      saveProgress();
    }
  }, [stage, history, tritype, isCounterphobic, mbtiStep, mbtiAnswers, wingAnswer, dobText]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reveal animation trigger
  useEffect(() => {
    if (stage === 'reveal') {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [stage]);

  // ── Fetch next AI question ────────────────────────────────────────
  const fetchNextQuestion = async (msgs) => {
    setQuizState('loading');
    setSelectedIndex(null);
    try {
      const { question, options, completed, result } = await sendTriTypeMessage({ messages: msgs });

      if (completed && result) {
        const { headType, heartType, gutType, isCounterphobic: cp } = result;
        setIsCounterphobic(!!cp);
        const found = getTriType(headType, heartType, gutType);
        setTritype(found || {
          code: [headType, heartType, gutType].sort((a, b) => a - b).join(''),
          englishName: 'Unique Soul',
          hebrewName: 'נְשָׁמָה יְחִידָה',
          headType, heartType, gutType,
          headSephira: '', heartSephira: '', gutSephira: '',
          lifeMissionEn: 'Your unique combination is rare and will be revealed through your journey.',
          coreFears: '', blindSpot: '',
        });
        setTimeout(() => setStage('mbti'), 600);
        return;
      }

      setCurrentQuestion(question);
      setCurrentOptions(options);
      setQuestionCount(prev => prev + 1);
      setQuizState('question');
      saveProgress({ currentQuestion: question, currentOptions: options });
    } catch (err) {
      // On error, show a retry state by going back to question with previous data
      setQuizState('question');
    }
  };

  // ── User selects an MCQ option ────────────────────────────────────
  const handleOptionSelect = (idx) => {
    if (quizState !== 'question') return;
    setSelectedIndex(idx);
    setQuizState('selected');

    const letter = ['A', 'B', 'C'][idx];
    const opts   = currentOptions;

    // Build history entry: assistant's question + user's choice
    const assistantEntry = {
      role: 'assistant',
      content: `QUESTION: ${currentQuestion}\nA) ${opts[0]}\nB) ${opts[1]}\nC) ${opts[2]}`,
    };
    const userEntry = {
      role: 'user',
      content: `${letter}) ${opts[idx]}`,
    };

    const newHistory = [...history, assistantEntry, userEntry];
    setHistory(newHistory);

    // Brief visual feedback before loading next question
    setTimeout(() => fetchNextQuestion(newHistory), 500);
  };

  // ── Save + navigate ───────────────────────────────────────────────
  const handleComplete = async () => {
    if (!tritype) return;
    setIsSaving(true);

    const primaryType   = parseInt(String(tritype.code)[0]);
    const enneagramType = wingAnswer || String(primaryType);
    const mbtiType      = [mbtiAnswers.ie, mbtiAnswers.sn, mbtiAnswers.tf, mbtiAnswers.jp]
                            .filter(Boolean).join('') || null;
    const parsed        = parseDOB(dobText);
    const zodiacSign    = parsed ? getZodiacSign(parsed.month, parsed.day) : null;
    const dateOfBirth   = parsed?.iso || null;

    await completeNatureQuiz({
      tritypeCode:     tritype.code,
      headType:        tritype.headType,
      heartType:       tritype.heartType,
      gutType:         tritype.gutType,
      headSephira:     tritype.headSephira,
      heartSephira:    tritype.heartSephira,
      gutSephira:      tritype.gutSephira,
      archetypeEn:     tritype.englishName,
      archetypeHe:     tritype.hebrewName,
      lifeMissionEn:   tritype.lifeMissionEn,
      coreFears:       tritype.coreFears,
      blindSpot:       tritype.blindSpot,
      isCounterphobic,
      personalityType: tritype.englishName,
      enneagramType,
      mbtiType,
      zodiacSign,
      dateOfBirth,
    });
    setIsSaving(false);
    await clearProgress();
    if (skipProfileSetup) {
      navigation.replace('AppDrawer');
    } else {
      navigation.replace('PhotoReading', { tritype, isCounterphobic });
    }
  };

  // ── MBTI + Wing stage ──────────────────────────────────────────
  if (stage === 'mbti' && tritype) {
    const primaryType  = parseInt(String(tritype.code)[0]);
    const wings        = WING_OPTIONS[primaryType] || [];
    const isWingStep   = mbtiStep === 0;
    const mbtiQ        = isWingStep ? null : MBTI_QUESTIONS[mbtiStep - 1];
    const stepTotal    = 5; // 1 wing + 4 MBTI
    const progress     = mbtiStep / stepTotal;

    const currentOptions = isWingStep
      ? wings.map(w => ({ label: `${w.wing} — ${w.desc}`, value: w.wing }))
      : (mbtiQ?.options || []);

    const currentText = isWingStep
      ? `You're primarily a Type ${primaryType}. Which of these resonates more with you?`
      : mbtiQ?.text;

    const handleMbtiSelect = (value) => {
      if (isWingStep) {
        setWingAnswer(value);
        setTimeout(() => setMbtiStep(1), 400);
      } else {
        setMbtiAnswers(prev => ({ ...prev, [mbtiQ.key]: value }));
        setTimeout(() => {
          if (mbtiStep >= 4) {
            setStage('dob');
          } else {
            setMbtiStep(prev => prev + 1);
          }
        }, 400);
      }
    };

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={Gradients.teal} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerAvatarWrap}>
              <Text style={styles.headerAvatarText}>✦</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Soul Profile</Text>
              <Text style={styles.headerSub}>
                {isWingStep ? 'Enneagram Wing' : `MBTI — Question ${mbtiStep} of 4`}
              </Text>
            </View>
            <Text style={styles.headerCount}>{mbtiStep + 1}/{stepTotal}</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.questionContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.tiebreakerTag}>
            <Text style={styles.tiebreakerTagText}>
              {isWingStep ? 'Enneagram Wing' : 'Personality Type'}
            </Text>
          </View>
          <Text style={styles.questionText}>{currentText}</Text>
          <View style={styles.optionsContainer}>
            {currentOptions.map((opt, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.optionCard}
                onPress={() => handleMbtiSelect(opt.value)}
                activeOpacity={0.75}
              >
                <View style={styles.optionDot} />
                <Text style={styles.optionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Date of birth stage ────────────────────────────────────────
  if (stage === 'dob') {
    const handleDobSubmit = () => {
      const parsed = parseDOB(dobText);
      if (!parsed) {
        setDobError('Please enter a valid date as DD/MM/YYYY — e.g. 15/11/1990');
        return;
      }
      setDobError('');
      setStage('reveal');
    };

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LinearGradient colors={Gradients.teal} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerAvatarWrap}>
              <Text style={styles.headerAvatarText}>✦</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Soul Profile</Text>
              <Text style={styles.headerSub}>Almost there...</Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '96%' }]} />
          </View>
        </LinearGradient>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.questionContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.tiebreakerTag}>
              <Text style={styles.tiebreakerTagText}>Zodiac Sign</Text>
            </View>
            <Text style={styles.questionText}>What is your date of birth?</Text>
            <Text style={styles.dobHelper}>
              Your Zodiac sign is a meaningful layer of your soul profile.
            </Text>
            <TextInput
              style={[styles.dobInput, dobError ? styles.dobInputError : null]}
              placeholder="DD / MM / YYYY"
              placeholderTextColor={Colors.textMuted}
              value={dobText}
              onChangeText={text => { setDobText(text); setDobError(''); }}
              keyboardType="numbers-and-punctuation"
              maxLength={12}
              autoFocus
            />
            {dobError ? <Text style={styles.dobErrorText}>{dobError}</Text> : null}
            <TouchableOpacity style={styles.continueBtn} onPress={handleDobSubmit}>
              <Text style={styles.continueBtnText}>Continue →</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Reveal screen ──────────────────────────────────────────────
  if (stage === 'reveal' && tritype) {
    const headEn  = tritype.headSephira  ? sephiraEnglish(tritype.headSephira)  : '';
    const heartEn = tritype.heartSephira ? sephiraEnglish(tritype.heartSephira) : '';
    const gutEn   = tritype.gutSephira   ? sephiraEnglish(tritype.gutSephira)   : '';
    const sephirot = [headEn, heartEn, gutEn].filter(Boolean).join(' · ');

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LinearGradient colors={Gradients.teal} style={styles.revealContainer}>
          <ScrollView contentContainerStyle={styles.revealScroll} showsVerticalScrollIndicator={false}>
            <Animated.View style={[styles.revealInner, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>

              <Text style={styles.revealStar}>✦</Text>
              <Text style={styles.revealLabel}>Your Soul Type Has Been Revealed</Text>

              <Text style={styles.revealHebrew}>{tritype.hebrewName}</Text>
              <Text style={styles.revealEnglish}>{tritype.englishName}</Text>
              <View style={styles.revealCodeBadge}>
                <Text style={styles.revealCode}>Type {tritype.code}</Text>
              </View>

              {sephirot ? (
                <View style={styles.sephirotRow}>
                  <Text style={styles.sephirotText}>{sephirot}</Text>
                </View>
              ) : null}

              <View style={styles.revealDivider} />

              <Text style={styles.missionLabel}>Your Life Mission</Text>
              <Text style={styles.missionText}>{tritype.lifeMissionEn}</Text>

              <TouchableOpacity
                style={[styles.continueBtn, isSaving && styles.continueBtnDisabled]}
                onPress={handleComplete}
                disabled={isSaving}
              >
                {isSaving
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.continueBtnText}>Begin My Journey →</Text>
                }
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ── Quiz stage — AI MCQ ───────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={Gradients.teal} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerAvatarWrap}>
            <Text style={styles.headerAvatarText}>✦</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Soul Assessment</Text>
            <Text style={styles.headerSub}>Rivnitz AI · Discovering your nature</Text>
          </View>
          {questionCount > 0 && (
            <Text style={styles.headerCount}>Q{questionCount}</Text>
          )}
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min((questionCount / 12) * 100, 92)}%` }]} />
        </View>
      </LinearGradient>

      {quizState === 'loading' ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.teal} />
          <Text style={styles.loadingText}>
            {questionCount === 0 ? 'Preparing your soul assessment…' : 'Reflecting on your answer…'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.questionContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.tiebreakerTag}>
            <Text style={styles.tiebreakerTagText}>Soul Assessment</Text>
          </View>

          <Text style={styles.questionText}>{currentQuestion}</Text>

          <View style={styles.optionsContainer}>
            {currentOptions.map((opt, idx) => {
              const letter     = ['A', 'B', 'C'][idx];
              const isSelected = selectedIndex === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.mcqCard, isSelected && styles.mcqCardSelected]}
                  onPress={() => handleOptionSelect(idx)}
                  disabled={quizState === 'selected'}
                  activeOpacity={0.75}
                >
                  <View style={[styles.mcqLetterBadge, isSelected && styles.mcqLetterBadgeSelected]}>
                    <Text style={[styles.mcqLetter, isSelected && styles.mcqLetterSelected]}>
                      {letter}
                    </Text>
                  </View>
                  <Text style={[styles.mcqOptionText, isSelected && styles.mcqOptionTextSelected]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },

  // Header
  header:           { padding: Spacing.base, paddingBottom: Spacing.md },
  headerTop:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  headerAvatarWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarText: { fontSize: 18, color: Colors.white },
  headerTitle:      { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.white },
  headerSub:        { fontSize: Typography.sizes.xs, color: 'rgba(255,255,255,0.7)' },
  headerCount:      { fontSize: Typography.sizes.sm, color: Colors.goldLight, fontFamily: Typography.bodySemiBold },

  progressBar: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: Colors.gold, borderRadius: 2,
  },

  // ── MCQ quiz stage ────────────────────────────────────────────
  loadingContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
  },
  loadingText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    textAlign: 'center',
  },
  mcqCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  mcqCardSelected: {
    borderColor: Colors.teal,
    backgroundColor: Colors.tealPale,
  },
  mcqLetterBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  mcqLetterBadgeSelected: {
    backgroundColor: Colors.teal,
  },
  mcqLetter: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.bodySemiBold,
    color: Colors.textMuted,
  },
  mcqLetterSelected: { color: Colors.white },
  mcqOptionText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontFamily: Typography.body,
    lineHeight: 20,
  },
  mcqOptionTextSelected: {
    color: Colors.tealDark,
    fontFamily: Typography.bodyMedium,
  },

  // ── MBTI / Wing stage ─────────────────────────────────────────
  questionContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  tiebreakerTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.tealPale,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.teal,
  },
  tiebreakerTagText: {
    fontSize: Typography.sizes.xs,
    color: Colors.teal,
    fontFamily: Typography.bodyMedium,
  },
  questionText: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes.xl,
    color: Colors.tealDark,
    lineHeight: 30,
    marginBottom: Spacing.xl,
  },
  optionsContainer: { gap: Spacing.md },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  optionDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    marginTop: 1, flexShrink: 0,
  },
  optionText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontFamily: Typography.body,
    lineHeight: 20,
  },

  // ── Reveal stage ──────────────────────────────────────────────
  revealContainer:   { flex: 1 },
  revealScroll:      { flexGrow: 1, justifyContent: 'center' },
  revealInner:       { alignItems: 'center', padding: Spacing['2xl'] },
  revealStar:        { fontSize: 42, color: Colors.gold, marginBottom: Spacing.md },
  revealLabel: {
    fontSize: Typography.sizes.xs,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: Typography.body,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  revealHebrew: {
    fontFamily: Typography.heading,
    fontSize: 42,
    color: Colors.gold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  revealEnglish: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes['2xl'],
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  revealCodeBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: 4,
    marginBottom: Spacing.lg,
  },
  revealCode: {
    fontSize: Typography.sizes.sm,
    color: Colors.goldLight,
    fontFamily: Typography.bodyMedium,
  },
  sephirotRow: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sephirotText: {
    fontSize: Typography.sizes.sm,
    color: Colors.goldLight,
    fontFamily: Typography.bodyMedium,
    letterSpacing: 1,
    textAlign: 'center',
  },
  revealDivider: {
    width: 60, height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: Spacing.lg,
  },
  missionLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.goldLight,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    fontFamily: Typography.bodySemiBold,
  },
  missionText: {
    fontSize: Typography.sizes.md,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Typography.body,
    marginBottom: Spacing['2xl'],
  },
  continueBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.base,
    ...Shadows.gold,
    minWidth: 200,
    alignItems: 'center',
  },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.md,
    color: Colors.white,
  },

  // ── DOB stage ─────────────────────────────────────────────────
  dobHelper: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  dobInput: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    fontSize: Typography.sizes['2xl'],
    fontFamily: Typography.heading,
    color: Colors.tealDark,
    borderWidth: 1.5,
    borderColor: Colors.border,
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  dobInputError: { borderColor: Colors.error },
  dobErrorText: {
    fontSize: Typography.sizes.xs,
    color: Colors.error,
    fontFamily: Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
});
