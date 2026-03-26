/**
 * CoachScreen — AI Personal Coach
 * Personalized spiritual coaching chat.
 * Responses are tailored to the user's personality type.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { sendCoachMessage } from '../../services/aiCoach';

const WELCOME_MESSAGE = (user) => ({
  id: 'welcome',
  role: 'assistant',
  content: `Shalom${user?.displayName ? `, ${user.displayName}` : ''}! 🔥\n\nI'm your personal Rivnitz coach. Based on your unique nature, I'm here to guide you with wisdom tailored specifically for you.\n\nWhat's on your heart today?`,
  timestamp: new Date(),
});

export default function CoachScreen({ navigation }) {
  const { user }            = useAuthStore();
  const [messages, setMessages]       = useState([]);
  const [inputText, setInputText]     = useState('');
  const [isTyping, setIsTyping]       = useState(false);
  const flatListRef                   = useRef(null);

  // Initialize with welcome message
  useEffect(() => {
    if (user) setMessages([WELCOME_MESSAGE(user)]);
  }, [user]);

  // If user hasn't done nature quiz, prompt them
  if (!user?.hasCompletedNatureQuiz) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Coach</Text>
        </View>
        <View style={styles.quizPrompt}>
          <Text style={styles.quizPromptEmoji}>🌿</Text>
          <Text style={styles.quizPromptTitle}>
            Let's discover your nature first
          </Text>
          <Text style={styles.quizPromptText}>
            To give you truly personalized coaching, I need to understand who you are. 
            It only takes about 5 minutes and it's a meaningful conversation.
          </Text>
          <TouchableOpacity
            style={styles.quizBtn}
            onPress={() => navigation.navigate('NatureQuiz')}
          >
            <Text style={styles.quizBtnText}>Begin Nature Discovery →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isTyping) return;

    const userMessage = {
      id:        Date.now().toString(),
      role:      'user',
      content:   text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Scroll to bottom
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { reply, escalated } = await sendCoachMessage({
        user,
        messages: messages.filter(m => m.id !== 'welcome'),
        newMessage: text,
      });

      const aiMessage = {
        id:        (Date.now() + 1).toString(),
        role:      'assistant',
        content:   reply,
        escalated,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = {
        id:        (Date.now() + 1).toString(),
        role:      'assistant',
        content:   'I\'m having trouble connecting right now. Please try again in a moment.',
        timestamp: new Date(),
        isError:   true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>🔥</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI, item.isError && styles.bubbleError]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
            {item.content}
          </Text>
          {item.escalated && (
            <Text style={styles.escalatedNote}>
              ✦ This question has been sent to Rabbi Landau for personal guidance
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>🔥</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Rivnitz Coach</Text>
            <Text style={styles.headerStatus}>● Online</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <Text>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Personality badge */}
      {user?.personalityType && (
        <View style={styles.personalityBanner}>
          <Text style={styles.personalityBannerText}>
            Your Type: {user.personalityType}
            {user.mbtiType ? ` · ${user.mbtiType}` : ''}
            {user.enneagramType ? ` · ${user.enneagramType}` : ''}
          </Text>
        </View>
      )}

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
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

        {/* Typing indicator */}
        {isTyping && (
          <View style={styles.typingRow}>
            <View style={styles.aiAvatar}>
              <Text style={styles.aiAvatarText}>🔥</Text>
            </View>
            <View style={styles.typingBubble}>
              <View style={styles.typingDots}>
                <View style={[styles.dot, styles.dot1]} />
                <View style={[styles.dot, styles.dot2]} />
                <View style={[styles.dot, styles.dot3]} />
              </View>
            </View>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Ask anything..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isTyping}
          >
            {isTyping ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.sendBtnText}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { fontSize: 18 },
  headerTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.md,
    color: Colors.tealDark,
  },
  headerStatus: {
    fontSize: Typography.sizes.xs,
    color: Colors.success,
  },
  iconBtn: {
    width: 34,
    height: 34,
    backgroundColor: Colors.tealPale,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Personality banner
  personalityBanner: {
    backgroundColor: Colors.tealPale,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
  },
  personalityBannerText: {
    fontSize: Typography.sizes.xs,
    color: Colors.teal,
    fontFamily: Typography.bodyMedium,
  },

  // Chat
  chatContainer: { flex: 1 },
  messagesList: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
  },

  // Messages
  msgRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  msgRowAI:   { alignItems: 'flex-end' },
  msgRowUser: { justifyContent: 'flex-end' },

  aiAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'flex-end',
  },
  aiAvatarText: { fontSize: 14 },

  bubble: {
    maxWidth: '80%',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  bubbleAI: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  bubbleUser: {
    backgroundColor: Colors.teal,
    borderBottomRightRadius: Radius.sm,
  },
  bubbleError: {
    backgroundColor: 'rgba(224,92,92,0.08)',
    borderColor: 'rgba(224,92,92,0.2)',
  },
  bubbleText: {
    fontSize: Typography.sizes.sm,
    lineHeight: 18,
    fontFamily: Typography.body,
  },
  bubbleTextAI:   { color: Colors.textPrimary },
  bubbleTextUser: { color: Colors.white },

  escalatedNote: {
    fontSize: Typography.sizes.xs,
    color: Colors.gold,
    fontFamily: Typography.body,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },

  // Typing indicator
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  typingBubble: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderBottomLeftRadius: Radius.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold,
  },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.cream,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontFamily: Typography.body,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.gold,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    fontSize: 16,
    color: Colors.white,
  },

  // Quiz prompt (when nature quiz not done)
  quizPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
    gap: Spacing.base,
  },
  quizPromptEmoji: { fontSize: 48 },
  quizPromptTitle: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes['2xl'],
    color: Colors.tealDark,
    textAlign: 'center',
  },
  quizPromptText: {
    fontSize: Typography.sizes.md,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Typography.body,
  },
  quizBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    ...Shadows.gold,
  },
  quizBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.md,
    color: Colors.white,
  },
});
