import React from 'react';
import { View, Text } from 'react-native';
import { avatarColor, getInitials, formatTime } from '../communityUtils';
import postStyles from '../communityPostStyles';

const styles = postStyles;

export default React.memo(function ReplyItem({ item }) {
  const palette = avatarColor(item.authorName);
  return (
    <View style={styles.replyRow}>
      <View style={[styles.replyAvatar, { backgroundColor: palette.bg, borderColor: palette.text + '30' }]}>
        <Text style={[styles.replyAvatarText, { color: palette.text }]}>
          {getInitials(item.authorName)}
        </Text>
      </View>
      <View style={styles.replyBubble}>
        <View style={styles.replyBubbleHeader}>
          <Text style={styles.replyAuthor}>{item.authorName}</Text>
          <Text style={styles.replyTime}>{formatTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.replyContent}>{item.content}</Text>
      </View>
    </View>
  );
});
