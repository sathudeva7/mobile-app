/**
 * LiveSessionScreen — User side
 *
 * Two modes:
 *  1. BROADCAST  — audience watches Rabbi's live stream via Agora
 *  2. CONSULTATION — when Rabbi admits the user, a private 2-way
 *                    video call opens (both are broadcasters in a
 *                    separate private channel)
 *
 * The admin web portal controls:
 *   • Creating / ending the live_sessions Firestore doc
 *   • Setting session.agoraChannel
 *   • Updating waitingRoom entries (status: in-session / done)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  collection, doc,
  updateDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '../../services/firebase.client';
import { useAuthStore } from '../../store/authStore';
import { CONSULT_DURATION_S, getStartedAtMs } from './liveSessionUtils';
import useLiveSessionFirestore from './hooks/useLiveSessionFirestore';
import useLiveSessionAgora from './hooks/useLiveSessionAgora';
import LiveLoadingView from './components/LiveLoadingView';
import LiveOfflineView from './components/LiveOfflineView';
import LiveConsultInviteView from './components/LiveConsultInviteView';
import LiveConsultationView from './components/LiveConsultationView';
import LiveBroadcastView from './components/LiveBroadcastView';

export default function LiveSessionScreen({ navigation }) {
  const { user } = useAuthStore();
  const isFocused = useIsFocused();

  const {
    session,
    loading,
    visibleQueue,
    visibleQueueCount,
    myEntry,
    inQueue,
    myPosition,
  } = useLiveSessionFirestore(user?.uid);

  const {
    phase,
    setPhase,
    broadcastUid,
    consultRemoteUid,
    agoraError,
    remoteVideoLive,
    localPreviewReady,
    joinConsultation,
    endConsultation,
  } = useLiveSessionAgora(session, isFocused);

  const [joining, setJoining] = useState(false);
  const [elapsed, setElapsed] = useState('00:00');
  const [consultLeft, setConsultLeft] = useState(CONSULT_DURATION_S);

  useEffect(() => {
    if (myEntry?.status === 'in-session' && phase === 'broadcast') {
      setPhase('consult-invite');
    }
    if (myEntry?.status === 'done' && phase === 'consultation') {
      void endConsultation();
    }
  }, [myEntry?.status, phase, setPhase, endConsultation]);

  useEffect(() => {
    if (!session?.startedAt) return;
    const tick = () => {
      const startMs = getStartedAtMs(session.startedAt);
      const s = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const m = Math.floor(s / 60).toString().padStart(2, '0');
      const sec = (s % 60).toString().padStart(2, '0');
      setElapsed(`${m}:${sec}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.startedAt]);

  useEffect(() => {
    if (phase !== 'consultation') return;
    setConsultLeft(CONSULT_DURATION_S);
    const id = setInterval(() => {
      setConsultLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          void endConsultation();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, endConsultation]);

  const joinWaitingRoom = useCallback(async () => {
    if (!session || !user) return;

    if (user.membershipTier !== 'premium') {
      Alert.alert(
        'Premium Feature',
        'Private consultations with Rabbi Landau are available for Premium members only.\n\nUpgrade your membership to join the consultation queue.',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'View Plans', onPress: () => navigation.navigate('Settings') },
        ],
      );
      return;
    }

    setJoining(true);
    try {
      await addDoc(collection(db, COLLECTIONS.LIVE_SESSIONS, session.id, 'waitingRoom'), {
        userId: user.uid,
        userName: user.displayName,
        status: 'waiting',
        joinedAt: serverTimestamp(),
      });
    } catch {
      Alert.alert('Error', 'Could not join the waiting room. Please try again.');
    } finally {
      setJoining(false);
    }
  }, [session, user, navigation]);

  const leaveWaitingRoom = useCallback(() => {
    if (!myEntry || !session) return;
    Alert.alert('Leave Waiting Room', 'Are you sure you want to leave the queue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () =>
          updateDoc(doc(db, COLLECTIONS.LIVE_SESSIONS, session.id, 'waitingRoom', myEntry.id), {
            status: 'left',
          }),
      },
    ]);
  }, [myEntry, session]);

  if (loading) {
    return <LiveLoadingView />;
  }

  if (!session) {
    return <LiveOfflineView onGoBack={() => navigation.goBack()} />;
  }

  if (phase === 'consult-invite') {
    return (
      <LiveConsultInviteView
        onJoin={joinConsultation}
        onDecline={() => setPhase('broadcast')}
      />
    );
  }

  if (phase === 'consultation') {
    return (
      <LiveConsultationView
        consultLeft={consultLeft}
        consultRemoteUid={consultRemoteUid}
        localPreviewReady={localPreviewReady}
        onEndConsultation={endConsultation}
      />
    );
  }

  return (
    <LiveBroadcastView
      session={session}
      phase={phase}
      broadcastUid={broadcastUid}
      agoraError={agoraError}
      remoteVideoLive={remoteVideoLive}
      elapsed={elapsed}
      visibleQueue={visibleQueue}
      visibleQueueCount={visibleQueueCount}
      userId={user?.uid}
      inQueue={inQueue}
      myPosition={myPosition}
      myEntry={myEntry}
      joining={joining}
      onJoinQueue={joinWaitingRoom}
      onLeaveQueue={leaveWaitingRoom}
    />
  );
}
