/**
 * AIAssessmentScreen — Post-Tritype Conversational Profiling
 *
 * After the Nature Quiz reveals the user's Tri-Type, this screen runs
 * a warm AI-driven conversation to determine:
 *   1. Enneagram type + wing (e.g. 4w5)
 *   2. MBTI type (e.g. INFJ)
 *   3. Zodiac sign (AI asks for date of birth and calculates)
 *
 * The AI uses the user's already-determined tri-type as context so
 * questions feel personal and targeted, not generic.
 *
 * When the AI has gathered enough information it outputs a RESULT JSON
 * which the screen parses, saves to Firestore, and navigates forward.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { sendAssessmentMessage } from '../../services/aiCoach';

// ─── Stage labels ─────────────────────────────────────────────────
const STAGES = [
  { key: 'enneagram', label: 'Enneagram' },
  { key: 'mbti',      label: 'MBTI'      },
  { key: 'zodiac',    label: 'Zodiac'    },
];

let _msgId = 0;
function nextId() { return String(++_msgId); }

// ─── Sacred colour palette (dark overlay on brand theme) ──────────
const NIGHT = {
  bg:         '#07191A',
  bgMid:      '#0A2020',
  surface:    'rgba(255,255,255,0.04)',
  surfaceFocus: 'rgba(255,255,255,0.07)',
  goldBorder: 'rgba(212,147,58,0.28)',
  goldBorderStrong: 'rgba(212,147,58,0.55)',
  textBody:   'rgba(255,255,255,0.82)',
  textMuted:  'rgba(255,255,255,0.22)',
  divider:    'rgba(212,147,58,0.12)',
};

// ─── Pulsing AI Avatar ────────────────────────────────────────────
const AIAvatar = () => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.75] });
  const ringScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.3]  });

  return (
    <View style={s.avatarWrapper}>
      <Animated.View style={[s.avatarRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
      <LinearGradient colors={['#1C4A4A', '#0D2E2E']} style={s.avatarInner}>
        <Text style={s.avatarGlyph}>✦</Text>
      </LinearGradient>
    </View>
  );
};

// ─── Staggered pulsing dots (typing indicator) ────────────────────
const TypingDots = () => {
  const dot1 = useRef(new Animated.Value(0.2)).current;
  const dot2 = useRef(new Animated.Value(0.2)).current;
  const dot3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    // Each loop is exactly 1200ms; stagger via initial delay
    const pulse = (dot, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1,   duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.2, duration: 300, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ])
    );
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 200);
    const a3 = pulse(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={s.dotsRow}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={[s.dot, { opacity: dot }]} />
      ))}
    </View>
  );
};

// ─── Animated bubble entrance ─────────────────────────────────────
const AnimatedBubble = ({ children, isUser }) => {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const translateX = useRef(new Animated.Value(isUser ? 12 : -12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, tension: 130, friction: 12, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, tension: 130, friction: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { translateX }] }}>
      {children}
    </Animated.View>
  );
};

// ─── Typing indicator row ─────────────────────────────────────────
const TypingIndicator = () => (
  <View style={[s.bubbleRow, s.bubbleRowAI]}>
    <AIAvatar />
    <View style={[s.bubble, s.bubbleAI, s.typingBubble]}>
      <TypingDots />
    </View>
  </View>
);

// ─── Sacred stage-progress track ─────────────────────────────────
const StageProgress = ({ activeStage }) => (
  <View style={s.stageTrack}>
    {STAGES.map((stage, i) => (
      <React.Fragment key={stage.key}>
        <View style={s.stageNode}>
          <View style={[
            s.stageDot,
            i <= activeStage && s.stageDotPast,
            i === activeStage && s.stageDotActive,
          ]} />
          <Text style={[s.stageLabel, i <= activeStage && s.stageLabelActive]}>
            {stage.label.toUpperCase()}
          </Text>
        </View>
        {i < STAGES.length - 1 && (
          <View style={[s.stageLine, i < activeStage && s.stageLineActive]} />
        )}
      </React.Fragment>
    ))}
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────
export default function AIAssessmentScreen({ navigation, route }) {
  const tritype         = route?.params?.tritype        ?? null;
  const isCounterphobic = route?.params?.isCounterphobic ?? false;

  const { completeAIAssessment } = useAuthStore();

  const [messages,     setMessages]     = useState([]);
  const [inputText,    setInputText]    = useState('');
  const [isTyping,     setIsTyping]     = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);
  const [activeStage,  setActiveStage]  = useState(0);
  const [inputFocused, setInputFocused] = useState(false);

  const flatListRef = useRef(null);
  const inputRef    = useRef(null);

  // Boot: get the AI's opening message on mount
  useEffect(() => { fetchAIMessage([], '__INIT__'); }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const fetchAIMessage = useCallback(async (history, userText) => {
    setIsTyping(true);
    try {
      const { reply, completed, result } = await sendAssessmentMessage({
        messages:       history,
        newMessage:     userText,
        tritype,
        isCounterphobic,
      });

      const aiMsg = { id: nextId(), role: 'assistant', content: reply };
      setMessages(prev => [...prev, aiMsg]);

      if (completed && result) {
        handleAssessmentComplete(result, [...history, aiMsg]);
      } else {
        setActiveStage(prev => {
          const total = history.length + 1;
          if (total >= 8 && prev < 2) return 2;
          if (total >= 4 && prev < 1) return 1;
          return prev;
        });
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'assistant',
        content: error,
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [tritype, isCounterphobic]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isTyping) return;
    const userMsg = { id: nextId(), role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInputText('');
    fetchAIMessage(updated, text);
  }, [inputText, isTyping, messages, fetchAIMessage]);

  const handleAssessmentComplete = useCallback(async (result, finalMessages) => {
    await new Promise(r => setTimeout(r, 1200));
    setIsSaving(true);
    try { await completeAIAssessment(result); }
    catch (e) { console.warn('completeAIAssessment error:', e); }
    setIsSaving(false);
    navigation.replace('ProfileSetup');
  }, [completeAIAssessment, navigation]);

  const handleSkip = () => navigation.replace('ProfileSetup');

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <AnimatedBubble isUser={isUser}>
        <View style={[s.bubbleRow, isUser ? s.bubbleRowUser : s.bubbleRowAI]}>
          {!isUser && <AIAvatar />}
          {isUser ? (
            <LinearGradient
              colors={[Colors.gold, Colors.goldLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.bubble, s.bubbleUser]}
            >
              <Text style={[s.bubbleText, s.bubbleTextUser]}>{item.content}</Text>
            </LinearGradient>
          ) : (
            <View style={[s.bubble, s.bubbleAI]}>
              <Text style={[s.bubbleText, s.bubbleTextAI]}>{item.content}</Text>
            </View>
          )}
        </View>
      </AnimatedBubble>
    );
  };

  return (
    <View style={s.outerContainer}>

      {/* Full-screen deep-night gradient */}
      <LinearGradient
        colors={[NIGHT.bg, NIGHT.bgMid, NIGHT.bg]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={s.container} edges={['top']}>

        {/* ── Header ───────────────────────────────────────────── */}
        <View style={s.header}>
          {/* Decorative celestial glyphs */}
          <Text style={[s.star, { top: 10, right: 44, fontSize: 9,  opacity: 0.28 }]}>✦</Text>
          <Text style={[s.star, { top: 28, right: 22, fontSize: 5,  opacity: 0.14 }]}>✦</Text>
          <Text style={[s.star, { top: 14, right: 80, fontSize: 6,  opacity: 0.20 }]}>✦</Text>
          <Text style={[s.star, { top: 38, right: 62, fontSize: 4,  opacity: 0.12 }]}>✦</Text>

          <View style={s.navBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.6}>
              <Text style={s.backBtnText}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSkip} style={s.skipBtn} activeOpacity={0.6}>
              <Text style={s.skipText}>SKIP</Text>
            </TouchableOpacity>
          </View>

          <View style={s.headerRow}>
            <View style={s.headerLeft}>
              <Text style={s.headerEyebrow}>SACRED JOURNEY  ·  STEP 2 OF 4</Text>
              <Text style={s.headerTitle}>Soul{'\n'}Reading</Text>
            </View>
          </View>

          <StageProgress activeStage={activeStage} />
        </View>

        {/* Gold rule */}
        <View style={s.goldRule} />

        {/* ── Tritype context banner ────────────────────────────── */}
        {tritype && (
          <View style={s.contextBanner}>
            <Text style={s.contextText}>
              ✦{'  '}{tritype.englishName}{'  '}·{'  '}Type {tritype.code}{'  '}✦
            </Text>
          </View>
        )}

        {/* ── Chat area ─────────────────────────────────────────── */}
        <KeyboardAvoidingView
          style={s.chatWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={s.messageList}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={isTyping ? <TypingIndicator /> : null}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {/* ── Input bar ──────────────────────────────────────── */}
          <View style={s.inputBar}>
            <View style={[s.inputWrapper, inputFocused && s.inputWrapperFocused]}>
              <TextInput
                ref={inputRef}
                style={s.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Share your thoughts…"
                placeholderTextColor={NIGHT.textMuted}
                multiline
                maxLength={400}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                editable={!isTyping && !isSaving}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
              />
            </View>

            <TouchableOpacity
              style={[s.sendBtn, (!inputText.trim() || isTyping) && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || isTyping || isSaving}
              activeOpacity={0.75}
            >
              <LinearGradient
                colors={(!inputText.trim() || isTyping)
                  ? ['#1A3030', '#122020']
                  : [Colors.gold, Colors.goldLight]
                }
                style={s.sendGradient}
              >
                <Text style={s.sendIcon}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({

  // Layout
  outerContainer: { flex: 1 },
  container:      { flex: 1 },

  // ── Header ────────────────────────────────────────────────────
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop:        Spacing.sm,
    paddingBottom:     Spacing.lg,
    overflow:          'hidden',
  },
  navBar: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   Spacing.sm,
  },
  backBtn: {
    paddingVertical:   Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.1)',
    borderRadius:      Radius.full,
  },
  backBtnText: {
    fontSize:   18,
    color:      'rgba(255,255,255,0.6)',
    lineHeight: 20,
  },
  star: {
    position: 'absolute',
    color: Colors.gold,
  },
  headerRow: {},
  headerLeft:  {},
  headerEyebrow: {
    fontSize:      Typography.sizes.xs,
    color:         'rgba(212,147,58,0.55)',
    fontFamily:    Typography.bodyMedium,
    letterSpacing: Typography.letterSpacing.widest,
    marginBottom:  Spacing.xs,
  },
  headerTitle: {
    fontFamily:    Typography.heading,
    fontSize:      44,
    color:         Colors.white,
    lineHeight:    48,
    letterSpacing: -0.5,
  },
  skipBtn: {
    paddingVertical:   Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.1)',
    borderRadius:      Radius.full,
    marginTop:         4,
  },
  skipText: {
    fontSize:      Typography.sizes.xs,
    color:         'rgba(255,255,255,0.35)',
    fontFamily:    Typography.bodyMedium,
    letterSpacing: 1.5,
  },

  // ── Stage track ───────────────────────────────────────────────
  stageTrack: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    marginTop:     Spacing.md,
  },
  stageNode:  { alignItems: 'center', width: 72 },
  stageDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.12)',
  },
  stageDotPast: {
    backgroundColor: 'rgba(212,147,58,0.35)',
    borderColor:     Colors.gold,
  },
  stageDotActive: {
    backgroundColor: Colors.gold,
    shadowColor:     Colors.gold,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   1,
    shadowRadius:    8,
    elevation:       4,
  },
  stageLabel: {
    fontSize:      8,
    marginTop:     5,
    color:         'rgba(255,255,255,0.22)',
    fontFamily:    Typography.bodyMedium,
    letterSpacing: 1,
    textAlign:     'center',
  },
  stageLabelActive: { color: Colors.goldLight },
  stageLine: {
    flex:            1,
    height:          1,
    marginTop:       4.5,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  stageLineActive: { backgroundColor: 'rgba(212,147,58,0.4)' },

  // ── Divider ───────────────────────────────────────────────────
  goldRule: {
    height:           1,
    backgroundColor:  'rgba(212,147,58,0.18)',
    marginHorizontal: Spacing.lg,
  },

  // ── Context banner ────────────────────────────────────────────
  contextBanner: {
    paddingVertical:    Spacing.sm,
    paddingHorizontal:  Spacing.base,
    alignItems:         'center',
    backgroundColor:    'rgba(212,147,58,0.05)',
    borderBottomWidth:  1,
    borderBottomColor:  NIGHT.divider,
  },
  contextText: {
    fontSize:      Typography.sizes.xs,
    color:         Colors.gold,
    fontFamily:    Typography.bodyMedium,
    letterSpacing: 2,
  },

  // ── Chat wrapper ──────────────────────────────────────────────
  chatWrapper:  { flex: 1 },
  messageList: {
    paddingHorizontal: Spacing.base,
    paddingTop:        Spacing.lg,
    paddingBottom:     Spacing.sm,
    gap:               Spacing.md,
  },

  // ── Bubbles ───────────────────────────────────────────────────
  bubbleRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           Spacing.sm,
    marginBottom:  2,
  },
  bubbleRowUser: { justifyContent: 'flex-end'  },
  bubbleRowAI:   { justifyContent: 'flex-start' },

  bubble: {
    maxWidth:         '78%',
    borderRadius:     Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical:   Spacing.sm + 2,
  },
  bubbleAI: {
    backgroundColor:   NIGHT.surface,
    borderWidth:       1,
    borderColor:       NIGHT.goldBorder,
    borderLeftWidth:   2.5,
    borderLeftColor:   NIGHT.goldBorderStrong,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
    ...Shadows.gold,
  },

  bubbleText: {
    fontSize:   Typography.sizes.md,
    lineHeight: 22,
  },
  bubbleTextAI: {
    color:      NIGHT.textBody,
    fontFamily: Typography.headingRegular,
    fontSize:   Typography.sizes.base,
    lineHeight: 26,
  },
  bubbleTextUser: {
    color:      '#0C2020',
    fontFamily: Typography.bodyMedium,
    fontSize:   Typography.sizes.sm,
  },

  // Typing
  typingBubble: { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md },
  dotsRow: { flexDirection: 'row', gap: 5, paddingVertical: 2 },
  dot: {
    width:           7,
    height:          7,
    borderRadius:    3.5,
    backgroundColor: Colors.gold,
  },

  // ── AI Avatar ─────────────────────────────────────────────────
  avatarWrapper: {
    width:          40,
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  avatarRing: {
    position:     'absolute',
    width:        40,
    height:       40,
    borderRadius: 20,
    borderWidth:  1.5,
    borderColor:  Colors.gold,
  },
  avatarInner: {
    width:          32,
    height:         32,
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1,
    borderColor:    'rgba(212,147,58,0.45)',
  },
  avatarGlyph: {
    fontSize: 13,
    color:    Colors.gold,
  },

  // ── Input bar ─────────────────────────────────────────────────
  inputBar: {
    flexDirection:    'row',
    alignItems:       'flex-end',
    gap:              Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical:  Spacing.sm,
    paddingBottom:    Spacing.md,
    backgroundColor:  'rgba(7,25,26,0.96)',
    borderTopWidth:   1,
    borderTopColor:   NIGHT.divider,
  },
  inputWrapper: {
    flex:            1,
    backgroundColor: NIGHT.surface,
    borderRadius:    Radius.xl,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.09)',
  },
  inputWrapperFocused: {
    borderColor:     NIGHT.goldBorderStrong,
    backgroundColor: NIGHT.surfaceFocus,
  },
  input: {
    minHeight:        42,
    maxHeight:        100,
    paddingHorizontal: Spacing.base,
    paddingVertical:  Spacing.sm + 2,
    fontSize:         Typography.sizes.sm,
    fontFamily:       Typography.body,
    color:            Colors.white,
  },
  sendBtn: {
    width:        42,
    height:       42,
    borderRadius: 21,
    overflow:     'hidden',
    flexShrink:   0,
    ...Shadows.gold,
  },
  sendBtnDisabled: { shadowOpacity: 0 },
  sendGradient: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  sendIcon: {
    fontSize:   18,
    color:      Colors.white,
    fontWeight: '600',
  },
});
