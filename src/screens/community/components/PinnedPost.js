import React from 'react';
import { View, Text } from 'react-native';
import { formatTime } from '../communityUtils';
import postStyles from '../communityPostStyles';

const styles = postStyles;

export default React.memo(function PinnedPost({ item }) {
  return (
    <View style={styles.pinnedCard}>
      <View style={styles.pinnedAccent} />
      <View style={styles.pinnedInner}>
        <View style={styles.pinnedBadgeRow}>
          <View style={styles.pinnedBadge}>
            <Text style={styles.pinnedBadgeText}>✦  RABBI'S MESSAGE</Text>
          </View>
          <Text style={styles.pinnedMeta}>{formatTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.pinnedText}>{item.content}</Text>
        <Text style={styles.pinnedAuthor}>— Rabbi Landau</Text>
      </View>
    </View>
  );
});
