/**
 * CoachScreen — AI Personal Coach
 * Personalized spiritual coaching chat.
 * Responses are tailored to the user's personality type.
 *
 * Features:
 * - Long-press AI bubble  → Report
 * - Long-press user bubble → (future: copy)
 * - ⋯ header button       → Clear chat
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase.client';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { sendCoachMessage, processLifeMemory } from '../../services/aiCoach';

const WELCOME_MESSAGE = (user) => ({
  id: 'welcome',
  role: 'assistant',
  content: `Shalom${user?.displayName ? `, ${user.displayName}` : ''}!\n\nI'm your personal Rivnitz coach. Based on your unique nature, I'm here to guide you with wisdom tailored specifically for you.\n\nWhat's on your heart today?`,
  timestamp: new Date(),
});

// ─── Animated typing dots ─────────────────────────────────────────
const TypingDots = () => {
  const dot1 = useRef(new Animated.Value(0.25)).current;
  const dot2 = useRef(new Animated.Value(0.25)).current;
  const dot3 = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const pulse = (dot, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1,    duration: 320, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.25, duration: 320, useNativeDriver: true }),
        Animated.delay(640 - delay),
      ])
    );
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 213);
    const a3 = pulse(dot3, 426);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 3 }}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={[s.typingDot, { opacity: dot }]} />
      ))}
    </View>
  );
};

// ─── Coach avatar with gold ring ──────────────────────────────────
const CoachAvatar = () => (
  <View style={s.avatarWrap}>
    <View style={s.avatarRing}>
      <Image source={require('../../../assets/icon.png')} style={s.avatarImg} />
    </View>
  </View>
);

// ─── Vertical 3-dot menu icon ─────────────────────────────────────
const VerticalDots = () => (
  <View style={{ gap: 3.5, alignItems: 'center' }}>
    {[1, 2, 3].map(i => (
      <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.8)' }} />
    ))}
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────
export default function CoachScreen({ navigation }) {
  const { user, fetchUserProfile, hasCompletedNatureQuiz } = useAuthStore();

  const [messages,         setMessages]         = useState([]);
  const [inputText,        setInputText]        = useState('');
  const [isTyping,         setIsTyping]         = useState(false);
  const [inputFocused,     setInputFocused]     = useState(false);
  const [selectedMsg,      setSelectedMsg]      = useState(null);
  const [showActionMenu,   setShowActionMenu]   = useState(false);
  const [showHeaderMenu,   setShowHeaderMenu]   = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [reportFeedback,   setReportFeedback]   = useState(false);

  const flatListRef    = useRef(null);
  const typewriterRef  = useRef(null);

  // Init welcome message
  useEffect(() => {
    if (user) setMessages([WELCOME_MESSAGE(user)]);
  }, [user?.uid]);

  // Redirect if quiz not done
  const needsQuiz = !hasCompletedNatureQuiz;
  useEffect(() => {
    if (needsQuiz) navigation.navigate('NatureQuiz');
  }, [needsQuiz]);

  if (needsQuiz) return <View style={{ flex: 1, backgroundColor: Colors.cream }} />;

  // ── Long-press ──────────────────────────────────────────────────
  const handleLongPress = (msg) => {
    setSelectedMsg(msg);
    setShowActionMenu(true);
  };
  const closeActionMenu = () => {
    setShowActionMenu(false);
    setSelectedMsg(null);
  };

  // ── Report ──────────────────────────────────────────────────────
  const handleReport = async () => {
    if (!selectedMsg) return;
    closeActionMenu();
    try {
      await addDoc(collection(db, 'reported_messages'), {
        messageContent: selectedMsg.content,
        messageRole:    selectedMsg.role,
        reportedBy:     user?.uid ?? null,
        reporterName:   user?.displayName ?? null,
        reporterEmail:  user?.email ?? null,
        createdAt:      serverTimestamp(),
        status:         'pending',
      });
      setReportFeedback(true);
      setTimeout(() => setReportFeedback(false), 2500);
    } catch {
      // Silent fail
    }
  };

  // ── Clear chat ──────────────────────────────────────────────────
  const handleClearChat = () => {
    setShowHeaderMenu(false);
    setShowClearConfirm(true);
  };
  const confirmClear = () => {
    setShowClearConfirm(false);
    setMessages([WELCOME_MESSAGE(user)]);
  };

  // ── Typewriter effect ───────────────────────────────────────────
  const runTypewriter = (msgId, fullText, escalated) => {
    const words     = fullText.split(' ');
    let   wordIndex = 0;
    typewriterRef.current = setInterval(() => {
      wordIndex += 1;
      const partial = words.slice(0, wordIndex).join(' ');
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: partial } : m));
      flatListRef.current?.scrollToEnd({ animated: false });
      if (wordIndex >= words.length) {
        clearInterval(typewriterRef.current);
        if (escalated) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, escalated: true } : m));
        }
      }
    }, 25);
  };

  // ── Send message ────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isTyping) return;

    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
      typewriterRef.current = null;
    }

    const userMessage = {
      id: Date.now().toString(), role: 'user', content: text, timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    const aiMsgId = (Date.now() + 1).toString();

    try {
      const { reply, escalated } = await sendCoachMessage({
        user,
        messages:   messages.filter(m => m.id !== 'welcome'),
        newMessage: text,
      });

      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: aiMsgId, role: 'assistant', content: '', timestamp: new Date(),
      }]);
      runTypewriter(aiMsgId, reply, escalated);

      const updatedMessages = [
        ...messages,
        { role: 'user', content: text },
        { role: 'assistant', content: reply },
      ];
      processLifeMemory(user.uid, text, reply, updatedMessages)
        .then(() => fetchUserProfile(user.uid))
        .catch(() => {});
    } catch (error) {
      const content = error?.message?.includes('not configured')
        ? error.message
        : 'I\'m having trouble connecting right now. Please try again in a moment.';
      setMessages(prev => [...prev, {
        id: aiMsgId, role: 'assistant', content, timestamp: new Date(), isError: true,
      }]);
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // ── Render bubble ───────────────────────────────────────────────
  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[s.msgRow, isUser ? s.msgRowUser : s.msgRowAI]}>
        {!isUser && <CoachAvatar />}
        <TouchableOpacity
          activeOpacity={0.88}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={400}
        >
          {isUser ? (
            <LinearGradient
              colors={[Colors.gold, '#C47A25']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.bubble, s.bubbleUser, item.isError && s.bubbleError]}
            >
              <Text style={[s.bubbleText, s.bubbleTextUser]}>{item.content}</Text>
            </LinearGradient>
          ) : (
            <View style={[s.bubble, s.bubbleAI, item.isError && s.bubbleError]}>
              <Text style={[s.bubbleText, s.bubbleTextAI]}>{item.content}</Text>
              {item.escalated && (
                <View style={s.escalatedBadge}>
                  <Text style={s.escalatedText}>
                    ✦  Sent to Rabbi Landau for personal guidance
                  </Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <LinearGradient
        colors={Gradients.teal}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <View style={s.headerLeft}>
          {/* Avatar with online pulse */}
          <View style={s.headerAvatarWrap}>
            <View style={s.headerAvatarRing}>
              <Image source={require('../../../assets/icon.png')} style={s.headerAvatarImg} />
            </View>
            <View style={s.onlineDot} />
          </View>
          <View>
            <Text style={s.headerTitle}>Rivnitz Coach</Text>
            <Text style={s.headerSub}>✦  Your Sacred Guide</Text>
          </View>
        </View>
        <TouchableOpacity style={s.menuBtn} onPress={() => setShowHeaderMenu(true)} activeOpacity={0.7}>
          <VerticalDots />
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Personality banner ───────────────────────────────────── */}
      {(user?.tritypeCode || user?.personalityType) && (
        <View style={s.personalityBanner}>
          <Text style={s.personalityText}>
            {user.tritypeCode
              ? `✦  ${user.archetypeEn || user.personalityType}  ·  Type ${user.tritypeCode}  ✦`
              : `✦  ${user.personalityType}  ✦`}
          </Text>
        </View>
      )}

      {/* ── Chat + Input wrapped in KAV for iOS keyboard ────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 82 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={s.messagesList}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Typing indicator */}
        {isTyping && (
          <View style={s.typingRow}>
            <CoachAvatar />
            <View style={s.typingBubble}>
              <TypingDots />
            </View>
          </View>
        )}

        {/* Report feedback toast */}
        {reportFeedback && (
          <View style={s.toast}>
            <Text style={s.toastText}>✦  Message reported</Text>
          </View>
        )}

        {/* Input bar */}
        <View style={s.inputBar}>
          <View style={[s.inputWrapper, inputFocused && s.inputWrapperFocused]}>
            <TextInput
              style={s.input}
              placeholder="Share what's on your heart…"
              placeholderTextColor={Colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              editable={!isTyping}
            />
          </View>
          <TouchableOpacity
            style={[s.sendBtn, (!inputText.trim() || isTyping) && s.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isTyping}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={(!inputText.trim() || isTyping) ? [Colors.creamDark, Colors.creamDark] : [Colors.gold, Colors.goldLight]}
              style={s.sendGradient}
            >
              {isTyping
                ? <ActivityIndicator size="small" color={Colors.textMuted} />
                : <Text style={s.sendBtnText}>➤</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Action menu (long-press on bubble) ────────────────────── */}
      <Modal visible={showActionMenu} transparent animationType="fade" onRequestClose={closeActionMenu}>
        <Pressable style={s.overlay} onPress={closeActionMenu}>
          <View style={s.actionSheet}>
            <View style={s.sheetHandle} />
            {selectedMsg && (
              <Text style={s.actionPreview} numberOfLines={2}>
                "{selectedMsg.content}"
              </Text>
            )}
            {selectedMsg?.role === 'assistant' && (
              <TouchableOpacity style={s.actionRow} onPress={handleReport} activeOpacity={0.7}>
                <View style={s.actionIconWrap}>
                  <Text style={s.actionIconEmoji}>🚩</Text>
                </View>
                <Text style={s.actionLabelDanger}>Report message</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.cancelBtn} onPress={closeActionMenu} activeOpacity={0.7}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Header menu (⋯) ────────────────────────────────────────── */}
      <Modal visible={showHeaderMenu} transparent animationType="fade" onRequestClose={() => setShowHeaderMenu(false)}>
        <Pressable style={s.overlay} onPress={() => setShowHeaderMenu(false)}>
          <View style={s.actionSheet}>
            <View style={s.sheetHandle} />
            <TouchableOpacity style={s.actionRow} onPress={handleClearChat} activeOpacity={0.7}>
              <View style={s.actionIconWrap}>
                <Text style={s.actionIconEmoji}>🗑</Text>
              </View>
              <Text style={s.actionLabelDanger}>Clear conversation</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowHeaderMenu(false)} activeOpacity={0.7}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Clear chat confirmation ─────────────────────────────────── */}
      <Modal visible={showClearConfirm} transparent animationType="fade" onRequestClose={() => setShowClearConfirm(false)}>
        <Pressable style={s.overlayCenter} onPress={() => setShowClearConfirm(false)}>
          <Pressable style={s.confirmCard} onPress={() => {}}>
            <Text style={s.confirmGlyph}>✦</Text>
            <Text style={s.confirmTitle}>Begin Anew?</Text>
            <Text style={s.confirmMsg}>
              All messages will be cleared and your sacred conversation will start fresh.
            </Text>
            <View style={s.confirmDivider} />
            <View style={s.confirmBtns}>
              <TouchableOpacity
                style={s.confirmBtnCancel}
                onPress={() => setShowClearConfirm(false)}
                activeOpacity={0.7}
              >
                <Text style={s.confirmBtnCancelText}>Keep Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirmBtnDanger}
                onPress={confirmClear}
                activeOpacity={0.8}
              >
                <Text style={s.confirmBtnDangerText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },

  // ── Header ─────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerAvatarWrap: {
    position: 'relative',
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarRing: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,147,58,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarImg: { width: '72%', height: '72%', resizeMode: 'contain' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.success,
    borderWidth: 1.5, borderColor: Colors.teal,
  },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes.xl,
    color: Colors.white,
    lineHeight: 24,
  },
  headerSub: {
    fontSize: 9,
    color: 'rgba(212,147,58,0.85)',
    fontFamily: Typography.bodyMedium,
    letterSpacing: 1.5,
  },
  menuBtn: {
    width: 36, height: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Personality banner ─────────────────────────────────────────
  personalityBanner: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.goldPale,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,147,58,0.2)',
    alignItems: 'center',
  },
  personalityText: {
    fontSize: 9,
    color: Colors.gold,
    fontFamily: Typography.bodyMedium,
    letterSpacing: 2,
  },

  // ── Chat ───────────────────────────────────────────────────────
  messagesList: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },

  msgRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  msgRowAI:   { alignItems: 'flex-end' },
  msgRowUser: { justifyContent: 'flex-end' },

  // AI avatar
  avatarWrap: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, alignSelf: 'flex-end',
  },
  avatarRing: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.teal,
    borderWidth: 1.5,
    borderColor: 'rgba(212,147,58,0.45)',
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  avatarImg: { width: '72%', height: '72%', resizeMode: 'contain' },

  // Bubbles
  bubble: {
    maxWidth: SCREEN_W * 0.72,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  bubbleAI: {
    backgroundColor: Colors.goldPale,
    borderBottomLeftRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: Colors.gold,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.2)',
    ...Shadows.sm,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
    overflow: 'hidden',
    ...Shadows.gold,
  },
  bubbleError: {
    backgroundColor: 'rgba(224,92,92,0.07)',
    borderColor: 'rgba(224,92,92,0.2)',
    borderLeftColor: Colors.error,
  },

  bubbleText: {
    lineHeight: 22,
  },
  bubbleTextAI: {
    fontFamily: Typography.headingRegular,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    lineHeight: 26,
  },
  bubbleTextUser: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.sizes.base,
    color: '#1A0A00',
    lineHeight: 24,
  },

  // Escalated note
  escalatedBadge: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,147,58,0.28)',
  },
  escalatedText: {
    fontSize: Typography.sizes.xs,
    color: Colors.gold,
    fontFamily: Typography.bodyMedium,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },

  // ── Typing indicator ───────────────────────────────────────────
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  typingBubble: {
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.lg,
    borderBottomLeftRadius: 4,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    borderLeftWidth: 3,
    borderLeftColor: Colors.gold,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.2)',
    ...Shadows.sm,
  },
  typingDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: Colors.gold,
  },

  // ── Input bar ──────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: Colors.cream,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputWrapperFocused: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldPale,
  },
  input: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontFamily: Typography.body,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    flexShrink: 0,
    ...Shadows.gold,
  },
  sendBtnDisabled: { shadowOpacity: 0 },
  sendGradient: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: {
    fontSize: 16,
    color: Colors.white,
    marginLeft: 2,
  },

  // ── Toast ──────────────────────────────────────────────────────
  toast: {
    alignSelf: 'center',
    backgroundColor: Colors.tealDark,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
    marginHorizontal: Spacing.base,
  },
  toastText: {
    color: Colors.white,
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.bodyMedium,
    letterSpacing: 0.5,
  },

  // ── Modal overlay ──────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,30,30,0.5)',
    justifyContent: 'flex-end',
  },
  overlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(10,30,30,0.5)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },

  // ── Action sheet ───────────────────────────────────────────────
  actionSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingBottom: Spacing['2xl'],
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.creamDark,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  actionPreview: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.headingRegular,
    fontStyle: 'italic',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  actionIconWrap: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: 'rgba(224,92,92,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionIconEmoji: { fontSize: 16 },
  actionLabelDanger: {
    fontSize: Typography.sizes.md,
    color: Colors.error,
    fontFamily: Typography.bodyMedium,
  },
  cancelBtn: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.cream,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cancelText: {
    fontSize: Typography.sizes.md,
    color: Colors.textMuted,
    fontFamily: Typography.bodyMedium,
  },

  // ── Clear confirm card ─────────────────────────────────────────
  confirmCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius['2xl'],
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.lg,
  },
  confirmGlyph: {
    fontFamily: Typography.heading,
    fontSize: 40,
    color: Colors.teal,
    opacity: 0.45,
    marginBottom: 2,
  },
  confirmTitle: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes['3xl'],
    color: Colors.tealDark,
    lineHeight: 34,
  },
  confirmMsg: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    fontFamily: Typography.body,
    lineHeight: 21,
    paddingHorizontal: Spacing.sm,
  },
  confirmDivider: {
    width: '100%', height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.xs,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  confirmBtnCancel: {
    flex: 1, paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    backgroundColor: Colors.cream,
    borderWidth: 1, borderColor: Colors.border,
  },
  confirmBtnCancelText: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  confirmBtnDanger: {
    flex: 1, paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    backgroundColor: Colors.error,
  },
  confirmBtnDangerText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.sm,
    color: Colors.white,
  },
});
