/**
 * NatureQuizScreen
 * Conversational AI quiz to determine user's personality type.
 * Determines: MBTI, Enneagram, Human Design, Rivnitz personality label.
 * After completion, saves results to user profile.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { sendQuizMessage } from '../../services/aiCoach';

const PROGRESS_STEPS = ['Personality', 'Enneagram', 'Human Design', 'Face Reading'];

const INITIAL_MESSAGE = {
  id:        'intro',
  role:      'assistant',
  content:   'Shalom! 🌿\n\nI\'m going to ask you a few questions to understand your unique nature. There are no right or wrong answers — just answer honestly and from the heart.\n\nThis conversation will take about 5 minutes and will shape every coaching response you receive going forward.\n\nReady to begin?',
  timestamp: new Date(),
};

export default function NatureQuizScreen({ navigation }) {
  const { user, completeNatureQuiz }    = useAuthStore();
  const [messages, setMessages]         = useState([INITIAL_MESSAGE]);
  const [inputText, setInputText]       = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const [currentStep, setCurrentStep]   = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [results, setResults]           = useState(null);
  const flatListRef                     = useRef(null);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isTyping) return;

    const userMsg = {
      id:        Date.now().toString(),
      role:      'user',
      content:   text,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    setIsTyping(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { reply, completed, result } = await sendQuizMessage({
        messages: updatedMessages.filter(m => m.id !== 'intro'),
        newMessage: text,
      });

      // Update progress step heuristically
      if (updatedMessages.length > 4)  setCurrentStep(1);
      if (updatedMessages.length > 8)  setCurrentStep(2);
      if (updatedMessages.length > 12) setCurrentStep(3);

      const aiMsg = {
        id:        (Date.now() + 1).toString(),
        role:      'assistant',
        content:   reply,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMsg]);

      if (completed && result) {
        setResults(result);
        setQuizComplete(true);
      }
    } catch (e) {
      const errMsg = {
        id:        (Date.now() + 1).toString(),
        role:      'assistant',
        content:   'Something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleComplete = async () => {
    if (!results) return;
    await completeNatureQuiz(results);
    navigation.replace('ProfileSetup');
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>🌿</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  // Results screen
  if (quizComplete && results) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LinearGradient colors={Gradients.teal} style={styles.resultsContainer}>
          <Text style={styles.resultsEmoji}>✦</Text>
          <Text style={styles.resultsTitle}>Your Nature Revealed</Text>
          <Text style={styles.resultsType}>{results.personalityType}</Text>
          <Text style={styles.resultsSummary}>{results.summary}</Text>

          <View style={styles.resultsCards}>
            {results.mbtiType && (
              <View style={styles.resultCard}>
                <Text style={styles.resultCardLabel}>MBTI</Text>
                <Text style={styles.resultCardValue}>{results.mbtiType}</Text>
              </View>
            )}
            {results.enneagramType && (
              <View style={styles.resultCard}>
                <Text style={styles.resultCardLabel}>Enneagram</Text>
                <Text style={styles.resultCardValue}>{results.enneagramType}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.continueBtn} onPress={handleComplete}>
            <Text style={styles.continueBtnText}>Begin My Journey →</Text>
          </TouchableOpacity>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={Gradients.teal} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerAvatarWrap}>
            <Text style={styles.headerAvatarText}>🔥</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Discover Your Nature</Text>
            <Text style={styles.headerSub}>Powered by Rivnitz AI · ~5 min</Text>
          </View>
        </View>
        {/* Progress chips */}
        <View style={styles.progressChips}>
          {PROGRESS_STEPS.map((step, i) => (
            <View
              key={step}
              style={[styles.chip, i <= currentStep ? styles.chipActive : styles.chipInactive]}
            >
              <Text style={[styles.chipText, i <= currentStep ? styles.chipTextActive : styles.chipTextInactive]}>
                {i < currentStep ? `${step} ✓` : step}
              </Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Chat */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {isTyping && (
          <View style={styles.typingRow}>
            <View style={styles.aiAvatar}>
              <Text style={styles.aiAvatarText}>🌿</Text>
            </View>
            <View style={styles.typingBubble}>
              <View style={styles.typingDots}>
                <View style={[styles.dot]} />
                <View style={[styles.dot]} />
                <View style={[styles.dot]} />
              </View>
            </View>
          </View>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type your answer..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isTyping}
          >
            {isTyping
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.sendBtnText}>➤</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },

  header: { padding: Spacing.base, paddingBottom: Spacing.md },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  headerAvatarWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarText: { fontSize: 18 },
  headerTitle: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.white },
  headerSub:   { fontSize: Typography.sizes.xs, color: Colors.goldLight },

  progressChips: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  chip: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  chipActive:   { backgroundColor: Colors.gold },
  chipInactive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  chipText: { fontSize: Typography.sizes.xs, fontFamily: Typography.bodyMedium },
  chipTextActive:   { color: Colors.white },
  chipTextInactive: { color: 'rgba(255,255,255,0.6)' },

  chatContainer: { flex: 1 },
  messagesList: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.sm },

  msgRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  msgRowAI:   { alignItems: 'flex-end' },
  msgRowUser: { justifyContent: 'flex-end' },

  aiAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.teal,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, alignSelf: 'flex-end',
  },
  aiAvatarText: { fontSize: 13 },

  bubble: { maxWidth: '82%', borderRadius: Radius.lg, padding: Spacing.md },
  bubbleAI: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  bubbleUser: { backgroundColor: Colors.teal, borderBottomRightRadius: Radius.sm },
  bubbleText: { fontSize: Typography.sizes.sm, lineHeight: 18, fontFamily: Typography.body },
  bubbleTextAI:   { color: Colors.textPrimary },
  bubbleTextUser: { color: Colors.white },

  typingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  typingBubble: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    borderBottomLeftRadius: Radius.sm, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  typingDots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    padding: Spacing.md, backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  input: {
    flex: 1, backgroundColor: Colors.cream,
    borderRadius: Radius.xl, paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm, fontSize: Typography.sizes.sm,
    color: Colors.textPrimary, fontFamily: Typography.body,
    borderWidth: 1, borderColor: Colors.border, maxHeight: 100,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center', ...Shadows.gold,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontSize: 16, color: Colors.white },

  // Results
  resultsContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  resultsEmoji: { fontSize: 48, marginBottom: Spacing.md },
  resultsTitle: {
    fontFamily: Typography.body, fontSize: Typography.sizes.sm,
    color: Colors.goldLight, letterSpacing: 2, textTransform: 'uppercase', marginBottom: Spacing.sm,
  },
  resultsType: {
    fontFamily: Typography.heading, fontSize: Typography.sizes['4xl'],
    color: Colors.white, marginBottom: Spacing.base, textAlign: 'center',
  },
  resultsSummary: {
    fontSize: Typography.sizes.md, color: 'rgba(255,255,255,0.8)',
    textAlign: 'center', lineHeight: 22, fontFamily: Typography.body,
    marginBottom: Spacing.xl,
  },
  resultsCards: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  resultCard: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.lg,
    padding: Spacing.base, alignItems: 'center', minWidth: 100,
  },
  resultCardLabel: { fontSize: Typography.sizes.xs, color: Colors.goldLight, letterSpacing: 1, marginBottom: 4 },
  resultCardValue: { fontFamily: Typography.heading, fontSize: Typography.sizes.xl, color: Colors.white },
  continueBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.xl,
    paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.base, ...Shadows.gold,
  },
  continueBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.white },
});
