/**
 * LiveSessionScreen — Rabbi Live Sessions
 * Shows live broadcast + private consultation waiting room.
 * Uses Agora RTC for video streaming.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection, doc, onSnapshot, query, orderBy,
  updateDoc, addDoc, serverTimestamp, where, getDoc,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '../../services/firebase.client';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';

export default function LiveSessionScreen({ navigation }) {
  const { user }                      = useAuthStore();
  const [session, setSession]         = useState(null);
  const [waitingRoom, setWaitingRoom] = useState([]);
  const [myPosition, setMyPosition]   = useState(null);
  const [inQueue, setInQueue]         = useState(false);
  const [joining, setJoining]         = useState(false);
  const [loading, setLoading]         = useState(true);

  // Listen for active live session
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.LIVE_SESSIONS),
      where('status', '==', 'live'),
      orderBy('startedAt', 'desc')
    );
    return onSnapshot(q, snap => {
      if (!snap.empty) {
        setSession({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setSession(null);
      }
      setLoading(false);
    });
  }, []);

  // Listen for waiting room when session is active
  useEffect(() => {
    if (!session) { setWaitingRoom([]); return; }
    const q = query(
      collection(db, COLLECTIONS.LIVE_SESSIONS, session.id, 'waitingRoom'),
      orderBy('joinedAt', 'asc')
    );
    return onSnapshot(q, snap => {
      const members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setWaitingRoom(members);
      const myIdx = members.findIndex(m => m.userId === user?.uid);
      setInQueue(myIdx !== -1);
      setMyPosition(myIdx !== -1 ? myIdx + 1 : null);
    });
  }, [session, user]);

  const joinWaitingRoom = async () => {
    if (!session || !user) return;
    setJoining(true);
    try {
      await addDoc(
        collection(db, COLLECTIONS.LIVE_SESSIONS, session.id, 'waitingRoom'),
        {
          userId:      user.uid,
          userName:    user.displayName,
          status:      'waiting', // waiting | in-session | done
          joinedAt:    serverTimestamp(),
        }
      );
    } catch (e) {
      Alert.alert('Error', 'Could not join the waiting room. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const leaveWaitingRoom = async () => {
    if (!session || !user) return;
    const myEntry = waitingRoom.find(m => m.userId === user.uid);
    if (!myEntry) return;
    Alert.alert(
      'Leave Waiting Room',
      'Are you sure you want to leave the queue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await updateDoc(
              doc(db, COLLECTIONS.LIVE_SESSIONS, session.id, 'waitingRoom', myEntry.id),
              { status: 'left' }
            );
          },
        },
      ]
    );
  };

  const formatEstWait = (position) => {
    const mins = (position - 1) * 6;
    if (mins === 0) return 'You\'re next!';
    return `~${mins} minutes`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.teal} />
      </View>
    );
  }

  // No active session
  if (!session) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rabbi Live</Text>
          <View style={{ width: 34 }} />
        </View>
        <View style={styles.offlineContainer}>
          <LinearGradient colors={Gradients.teal} style={styles.offlineGradient}>
            <Text style={styles.offlineIcon}>📺</Text>
            <Text style={styles.offlineTitle}>No Live Session Right Now</Text>
            <Text style={styles.offlineSub}>
              You'll receive a push notification as soon as Rabbi Landau goes live.
            </Text>
            <View style={styles.offlineNote}>
              <Text style={styles.offlineNoteText}>
                🔔 Make sure notifications are enabled in Settings
              </Text>
            </View>
          </LinearGradient>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Live header */}
      <LinearGradient colors={Gradients.teal} style={styles.liveHeader}>
        <View style={styles.liveHeaderTop}>
          <View style={styles.liveDot}>
            <View style={styles.liveDotInner} />
            <Text style={styles.liveText}>LIVE NOW</Text>
          </View>
          <Text style={styles.watchingCount}>👁 {session.viewerCount || 0} watching</Text>
        </View>
        <Text style={styles.liveTitle}>Rabbi Landau</Text>
        <Text style={styles.liveSubtitle}>{session.title || 'Private Consultation Session'}</Text>
      </LinearGradient>

      {/* Video area */}
      <View style={styles.videoArea}>
        {/* In production: render Agora RtcLocalView / RtcRemoteView here */}
        <Text style={styles.videoPlaceholder}>📺  Live Stream</Text>
        <View style={styles.videoTimer}>
          <Text style={styles.videoTimerText}>{session.duration || '00:00'}</Text>
        </View>
      </View>

      {/* Waiting room section */}
      <View style={styles.waitingSection}>
        <View style={styles.waitingHeader}>
          <Text style={styles.waitingTitle}>Private Consultation Queue</Text>
          <Text style={styles.waitingCount}>{waitingRoom.length} waiting</Text>
        </View>

        {/* My position card */}
        {inQueue && myPosition && (
          <LinearGradient colors={Gradients.teal} style={styles.myPositionCard}>
            <Text style={styles.myPositionLabel}>YOUR POSITION</Text>
            <Text style={styles.myPositionNum}>#{myPosition}</Text>
            <Text style={styles.myPositionWait}>{formatEstWait(myPosition)}</Text>
          </LinearGradient>
        )}

        {/* Queue list */}
        <FlatList
          data={waitingRoom.filter(m => m.status !== 'left')}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => {
            const isMe    = item.userId === user?.uid;
            const isFirst = index === 0 && item.status === 'in-session';
            return (
              <View style={[styles.queueItem, isMe && styles.queueItemMe]}>
                <View style={[styles.queueNum, isMe ? styles.queueNumMe : isFirst ? styles.queueNumFirst : styles.queueNumDefault]}>
                  <Text style={[styles.queueNumText, (isMe || isFirst) && { color: Colors.white }]}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={[styles.queueName, isMe && styles.queueNameMe]}>
                  {isMe ? 'You' : item.userName}
                </Text>
                {isFirst && <Text style={styles.inSessionBadge}>● In session</Text>}
                {isMe && !isFirst && <Text style={styles.youBadge}>← You</Text>}
              </View>
            );
          }}
          style={styles.queueList}
          showsVerticalScrollIndicator={false}
        />

        {/* Join / leave button */}
        {!inQueue ? (
          <TouchableOpacity
            style={[styles.joinBtn, joining && styles.joinBtnDisabled]}
            onPress={joinWaitingRoom}
            disabled={joining}
          >
            {joining
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.joinBtnText}>Join Consultation Queue</Text>
            }
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.leaveBtn} onPress={leaveWaitingRoom}>
            <Text style={styles.leaveBtnText}>Leave Waiting Room</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cream },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn:     { width: 34, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: Typography.sizes.xl, color: Colors.teal },
  headerTitle: { fontFamily: Typography.heading, fontSize: Typography.sizes.xl, color: Colors.tealDark },

  // Offline state
  offlineContainer: { flex: 1 },
  offlineGradient:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'], gap: Spacing.base },
  offlineIcon:  { fontSize: 56 },
  offlineTitle: { fontFamily: Typography.heading, fontSize: Typography.sizes['2xl'], color: Colors.white, textAlign: 'center' },
  offlineSub:   { fontSize: Typography.sizes.md, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 22, fontFamily: Typography.body },
  offlineNote:  { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md },
  offlineNoteText: { fontSize: Typography.sizes.sm, color: 'rgba(255,255,255,0.8)', fontFamily: Typography.body },

  // Live header
  liveHeader: { padding: Spacing.base, paddingBottom: Spacing.lg },
  liveHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  liveDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error },
  liveText:      { fontSize: Typography.sizes.xs, color: '#FF8888', fontFamily: Typography.bodySemiBold, letterSpacing: 1 },
  watchingCount: { fontSize: Typography.sizes.xs, color: 'rgba(255,255,255,0.6)', fontFamily: Typography.body },
  liveTitle:    { fontFamily: Typography.heading, fontSize: Typography.sizes.xl, color: Colors.white },
  liveSubtitle: { fontSize: Typography.sizes.xs, color: Colors.goldLight, marginTop: 2, fontFamily: Typography.body },

  // Video area
  videoArea: {
    height: 180, backgroundColor: '#0A2A2A',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  videoPlaceholder: { fontSize: Typography.sizes.md, color: 'rgba(255,255,255,0.4)', fontFamily: Typography.body },
  videoTimer: {
    position: 'absolute', bottom: Spacing.sm, right: Spacing.sm,
    backgroundColor: Colors.overlayDark, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  videoTimerText: { fontSize: Typography.sizes.xs, color: Colors.white, fontFamily: Typography.body },

  // Waiting section
  waitingSection: { flex: 1, padding: Spacing.md, gap: Spacing.sm },
  waitingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  waitingTitle:  { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.sm, color: Colors.tealDark, textTransform: 'uppercase', letterSpacing: 1 },
  waitingCount:  { fontSize: Typography.sizes.xs, color: Colors.textMuted, fontFamily: Typography.body },

  myPositionCard: { borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center' },
  myPositionLabel: { fontSize: Typography.sizes.xs, color: Colors.goldLight, letterSpacing: 1, fontFamily: Typography.bodySemiBold },
  myPositionNum:   { fontFamily: Typography.heading, fontSize: 40, color: Colors.white },
  myPositionWait:  { fontSize: Typography.sizes.xs, color: 'rgba(255,255,255,0.7)', fontFamily: Typography.body },

  queueList: { flex: 1 },
  queueItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, marginBottom: Spacing.xs,
  },
  queueItemMe: { borderColor: Colors.teal, borderWidth: 2, backgroundColor: Colors.tealPale },
  queueNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  queueNumDefault: { backgroundColor: Colors.creamDark },
  queueNumFirst:   { backgroundColor: Colors.success },
  queueNumMe:      { backgroundColor: Colors.teal },
  queueNumText: { fontSize: Typography.sizes.xs, color: Colors.textMuted, fontFamily: Typography.bodySemiBold },
  queueName:    { flex: 1, fontSize: Typography.sizes.sm, color: Colors.textPrimary, fontFamily: Typography.body },
  queueNameMe:  { color: Colors.tealDark, fontFamily: Typography.bodySemiBold },
  inSessionBadge: { fontSize: Typography.sizes.xs, color: Colors.success, fontFamily: Typography.bodySemiBold },
  youBadge:       { fontSize: Typography.sizes.xs, color: Colors.teal, fontFamily: Typography.bodySemiBold },

  joinBtn: { backgroundColor: Colors.gold, borderRadius: Radius.xl, padding: Spacing.base, alignItems: 'center', ...Shadows.gold },
  joinBtnDisabled: { opacity: 0.6 },
  joinBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.white },
  leaveBtn: { borderWidth: 1, borderColor: 'rgba(224,92,92,0.3)', borderRadius: Radius.xl, padding: Spacing.md, alignItems: 'center' },
  leaveBtnText: { fontSize: Typography.sizes.sm, color: Colors.error, fontFamily: Typography.bodyMedium },
});
