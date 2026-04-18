import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gradients, Colors } from '../../../theme';
import { formatEstWait } from '../liveSessionUtils';
import QueueListRow from './QueueListRow';
import styles from '../liveSessionScreen.styles';

export default function WaitingRoomSection({
  visibleQueue,
  visibleQueueCount,
  userId,
  inQueue,
  myPosition,
  myEntry,
  joining,
  onJoinQueue,
  onLeaveQueue,
}) {
  const renderItem = useCallback(
    ({ item, index }) => <QueueListRow item={item} index={index} userId={userId} styles={styles} />,
    [userId],
  );

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <View style={styles.waitingSection}>
      <View style={styles.waitingHeader}>
        <Text style={styles.waitingTitle}>Private Consultation Queue</Text>
        <Text style={styles.waitingCount}>{visibleQueueCount} waiting</Text>
      </View>

      {inQueue && myPosition && myEntry?.status === 'waiting' && (
        <LinearGradient colors={Gradients.teal} style={styles.myPositionCard}>
          <Text style={styles.myPositionLabel}>YOUR POSITION</Text>
          <Text style={styles.myPositionNum}>#{myPosition}</Text>
          <Text style={styles.myPositionWait}>{formatEstWait(myPosition)}</Text>
        </LinearGradient>
      )}

      <FlatList
        data={visibleQueue}
        keyExtractor={keyExtractor}
        style={styles.queueList}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
      />

      {!inQueue ? (
        <TouchableOpacity
          style={[styles.joinBtn, joining && styles.joinBtnDisabled]}
          onPress={onJoinQueue}
          disabled={joining}
        >
          {joining ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.joinBtnText}>Join Consultation Queue</Text>
          )}
        </TouchableOpacity>
      ) : (
        myEntry?.status === 'waiting' && (
          <TouchableOpacity style={styles.leaveBtn} onPress={onLeaveQueue}>
            <Text style={styles.leaveBtnText}>Leave Waiting Room</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}
