import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../../theme';
import { avatarColor, getInitials } from '../communityUtils';

/**
 * Shared composer: avatar + multiline input + send gradient button.
 */
export default function CommunityComposerBar({
  styles,
  barStyle,
  displayName,
  value,
  onChangeText,
  onSend,
  sending,
  placeholder,
  maxLength = 500,
  autoFocus = false,
}) {
  const palette = avatarColor(displayName || '');
  const disabled = !value.trim() || sending;
  const rowStyle = barStyle ?? styles.inputBar;

  return (
    <View style={rowStyle}>
      <View
        style={[
          styles.inputAvatar,
          { backgroundColor: palette.bg, borderColor: palette.text + '40' },
        ]}
      >
        <Text style={[styles.inputAvatarText, { color: palette.text }]}>
          {getInitials(displayName || '')}
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        multiline
        maxLength={maxLength}
        autoFocus={autoFocus}
      />

      <TouchableOpacity onPress={onSend} disabled={disabled} activeOpacity={0.8}>
        <LinearGradient
          colors={disabled ? ['rgba(212,147,58,0.35)', 'rgba(212,147,58,0.35)'] : [Colors.gold, '#C47A25']}
          style={styles.sendBtn}
        >
          {sending ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.sendBtnText}>➤</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}
