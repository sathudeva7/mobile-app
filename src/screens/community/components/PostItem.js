import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { avatarColor, getInitials, formatTime } from '../communityUtils';
import postStyles from '../communityPostStyles';

const styles = postStyles;

/**
 * @param {number} replyCount — use live count when this post's thread is open, else item.replyCount
 */
export default React.memo(function PostItem({
  item,
  userId,
  replyCount,
  onLike,
  onDelete,
  onReply,
}) {
  const palette = avatarColor(item.authorName);
  const liked = item.likes?.includes(userId);
  const likeCount = item.likes?.length || 0;

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={[styles.avatar, { backgroundColor: palette.bg, borderColor: palette.text + '30' }]}>
          <Text style={[styles.avatarText, { color: palette.text }]}>
            {getInitials(item.authorName)}
          </Text>
        </View>

        <View style={styles.postMeta}>
          <Text style={styles.postAuthor}>{item.authorName}</Text>
          <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
        </View>

        {item.authorId === userId && (
          <TouchableOpacity onPress={() => onDelete(item)} style={styles.deleteBtn} activeOpacity={0.6}>
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.postContent}>{item.content}</Text>

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onLike(item)} activeOpacity={0.7}>
          <View style={[styles.actionPill, liked && styles.actionPillLiked]}>
            <Text style={[styles.actionHeart, liked && styles.actionHeartLiked]}>
              {liked ? '♥' : '♡'}
            </Text>
            {likeCount > 0 && (
              <Text style={[styles.actionCount, liked && styles.actionCountLiked]}>{likeCount}</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onReply(item)} activeOpacity={0.7}>
          <View style={styles.actionPill}>
            <Text style={styles.actionReplyIcon}>◎</Text>
            <Text style={styles.actionCount}>
              {replyCount > 0 ? `${replyCount}` : 'Reply'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
});
