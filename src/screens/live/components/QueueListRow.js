import React from 'react';
import { View, Text } from 'react-native';
import { Colors } from '../../../theme';

export default React.memo(function QueueListRow({ item, index, userId, styles }) {
  const isMe = item.userId === userId;
  const isFirst = index === 0 && item.status === 'in-session';
  return (
    <View style={[styles.queueItem, isMe && styles.queueItemMe]}>
      <View
        style={[
          styles.queueNum,
          isMe ? styles.queueNumMe : isFirst ? styles.queueNumFirst : styles.queueNumDefault,
        ]}
      >
        <Text style={[styles.queueNumText, (isMe || isFirst) && { color: Colors.white }]}>
          {index + 1}
        </Text>
      </View>
      <Text style={[styles.queueName, isMe && styles.queueNameMe]}>{isMe ? 'You' : item.userName}</Text>
      {isFirst && <Text style={styles.inSessionBadge}>● In session</Text>}
      {isMe && !isFirst && <Text style={styles.youBadge}>← You</Text>}
    </View>
  );
});
