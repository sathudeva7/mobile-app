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

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert,
  Platform, PermissionsAndroid, AppState,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createAgoraRtcEngine,
  RtcSurfaceView,
  ChannelProfileType,
  ClientRoleType,
  VideoSourceType,
  AudienceLatencyLevelType,
} from 'react-native-agora';
import {
  collection, doc, onSnapshot, query, orderBy,
  updateDoc, addDoc, serverTimestamp, where,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '../../services/firebase.client';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { agora as agoraConfig } from '../../config';

const AGORA_APP_ID        = agoraConfig.appId;
const ADMIN_PORTAL_URL    = agoraConfig.adminPortalUrl;
const CONSULT_DURATION_S  = 5 * 60; // 5 minutes

// ─── Fetch a fresh Agora RTC token from the admin portal ─────────
async function fetchAgoraToken(channel, uid = 0) {
  if (!ADMIN_PORTAL_URL) {
    console.warn('[Agora] ADMIN_PORTAL_URL is empty — joining without token');
    return null;
  }
  const url = `${ADMIN_PORTAL_URL}/api/agora-token?channel=${encodeURIComponent(channel)}&uid=${uid}`;
  console.log('[Agora] Fetching token from:', url);
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('Failed to fetch Agora token');
    const { token } = await res.json();
    console.log('[Agora] Token received:', token ? 'yes' : 'NO TOKEN');
    return token;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Token server timed out — check admin portal is reachable');
    throw e;
  }
}

// ─── Permission helper (Android only) ────────────────────────────
async function requestMediaPermissions() {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  return (
    granted[PermissionsAndroid.PERMISSIONS.CAMERA]    === PermissionsAndroid.RESULTS.GRANTED &&
    granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
  );
}

export default function LiveSessionScreen({ navigation }) {
  const { user } = useAuthStore();
  const isFocused = useIsFocused();

  // ── Firestore
  const [session, setSession]         = useState(null);
  const [waitingRoom, setWaitingRoom] = useState([]);
  const [myEntry, setMyEntry]         = useState(null);
  const [inQueue, setInQueue]         = useState(false);
  const [myPosition, setMyPosition]   = useState(null);
  const [joining, setJoining]         = useState(false);
  const [loading, setLoading]         = useState(true);

  // ── Agora
  const engineRef                           = useRef(null);
  const [phase, setPhase]                   = useState('idle');
  // phases: idle | connecting | broadcast | consult-invite | consultation
  const [broadcastUid, setBroadcastUid]     = useState(null); // Rabbi's remote uid (broadcast)
  const [consultRemoteUid, setConsultRemoteUid] = useState(null); // Rabbi's uid in private call
  const [agoraError, setAgoraError]         = useState(null);
  const [remoteVideoLive, setRemoteVideoLive] = useState(false); // true once host video is actually rendering
  const reinitRef                           = useRef(0); // bumped to force Agora re-init

  // ── Timer
  const [elapsed, setElapsed]       = useState('00:00');
  const [consultLeft, setConsultLeft] = useState(CONSULT_DURATION_S);

  // ── Listen for active session ─────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.LIVE_SESSIONS),
      where('status', '==', 'live')
    );
    return onSnapshot(q, snap => {
      setSession(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
      setLoading(false);
    });
  }, []);

  // ── Listen for waiting room ───────────────────────────────────
  useEffect(() => {
    if (!session) { setWaitingRoom([]); setMyEntry(null); return; }
    const q = query(
      collection(db, COLLECTIONS.LIVE_SESSIONS, session.id, 'waitingRoom'),
      orderBy('joinedAt', 'asc')
    );
    return onSnapshot(q, snap => {
      const members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setWaitingRoom(members);
      const myIdx  = members.findIndex(m => m.userId === user?.uid);
      const entry  = myIdx !== -1 ? members[myIdx] : null;
      setMyEntry(entry);
      setInQueue(myIdx !== -1);
      setMyPosition(myIdx !== -1 ? myIdx + 1 : null);
    });
  }, [session?.id, user?.uid]);

  // ── Detect when Rabbi admits this user ───────────────────────
  useEffect(() => {
    if (myEntry?.status === 'in-session' && phase === 'broadcast') {
      setPhase('consult-invite');
    }
    if (myEntry?.status === 'done' && phase === 'consultation') {
      endConsultation();
    }
  }, [myEntry?.status]);

  // ── Broadcast elapsed timer ──────────────────────────────────
  useEffect(() => {
    if (!session?.startedAt) return;
    const tick = () => {
      // Firestore Timestamps have .toMillis(); plain objects from cache
      // may arrive as { seconds, nanoseconds } without the helper method.
      let startMs;
      if (typeof session.startedAt.toMillis === 'function') {
        startMs = session.startedAt.toMillis();
      } else if (session.startedAt.seconds) {
        startMs = session.startedAt.seconds * 1000;
      } else {
        startMs = Date.now(); // fallback — show 00:00
      }
      const s    = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const m    = Math.floor(s / 60).toString().padStart(2, '0');
      const sec  = (s % 60).toString().padStart(2, '0');
      setElapsed(`${m}:${sec}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.startedAt]);

  // ── Consultation countdown ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'consultation') return;
    setConsultLeft(CONSULT_DURATION_S);
    const id = setInterval(() => {
      setConsultLeft(prev => {
        if (prev <= 1) { clearInterval(id); endConsultation(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── Init Agora & join broadcast channel ──────────────────────
  // Depends on isFocused so Agora is stopped when navigating away
  // (Drawer keeps screens mounted, so useEffect cleanup only fires on
  //  focus change — not on unmount — when using drawer navigation)
  // reinitRef.current is bumped to force a full teardown+reinit (e.g. after
  // returning from background with a dead connection).
  useEffect(() => {
    if (!isFocused || !session?.agoraChannel || !AGORA_APP_ID) return;
    let didCancel = false;

    const init = async () => {
      setPhase('connecting');
      setAgoraError(null);
      setRemoteVideoLive(false);
      try {
        const engine = createAgoraRtcEngine();
        engineRef.current = engine;

        engine.initialize({
          appId: AGORA_APP_ID,
          channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
        });

        engine.setClientRole(ClientRoleType.ClientRoleAudience, {
          audienceLatencyLevel: AudienceLatencyLevelType.AudienceLatencyLevelUltraLowLatency,
        });
        engine.enableVideo();
        engine.enableAudio();

        const hostUid = session.hostUid ?? 1;

        // onUserJoined — confirms host is streaming (also fires after consultation ends)
        engine.addListener('onUserJoined', (_conn, uid) => {
          console.log('[Agora] onUserJoined uid:', uid, 'hostUid:', hostUid);
          if (!didCancel && uid === hostUid) setBroadcastUid(uid);
        });
        // onUserOffline — host left or went into private consultation
        engine.addListener('onUserOffline', (_conn, uid) => {
          console.log('[Agora] onUserOffline uid:', uid);
          if (!didCancel && uid === hostUid) {
            setBroadcastUid(null);
            setRemoteVideoLive(false);
          }
        });
        engine.addListener('onJoinChannelSuccess', () => {
          console.log('[Agora] onJoinChannelSuccess — setting broadcastUid to', hostUid);
          if (!didCancel) {
            setBroadcastUid(hostUid);
            setPhase('broadcast');
            setTimeout(() => {
              if (!didCancel) setRemoteVideoLive(true);
            }, 4000);
          }
        });

        // First decoded frame — the most reliable signal that video is
        // actually rendering. Fires on both react-native-agora v3 and v4.
        engine.addListener('onFirstRemoteVideoDecoded', (_conn, uid) => {
          console.log('[Agora] onFirstRemoteVideoDecoded uid:', uid);
          if (!didCancel && uid === hostUid) {
            setRemoteVideoLive(true);
          }
        });

        // Also listen for state changes as a backup.
        // state 2 = RemoteVideoStateDecoding (video frames arriving).
        engine.addListener('onRemoteVideoStateChanged', (_conn, uid, state) => {
          if (!didCancel && uid === hostUid) {
            setRemoteVideoLive(state === 2);
          }
        });

        // Track connection state so we can detect drops and auto-reconnect.
        // state 5 = ConnectionStateFailed — the SDK gave up reconnecting.
        engine.addListener('onConnectionStateChanged', (_conn, state, reason) => {
          if (didCancel) return;
          console.log(`Agora connection: state=${state} reason=${reason}`);
          if (state === 5) {
            // Connection failed — trigger a full re-init
            setAgoraError('Connection lost — reconnecting…');
            cleanupEngine();
            reinitRef.current += 1;
          }
        });

        engine.addListener('onError', (err) => {
          console.warn('Agora error:', err);
          if (!didCancel) setAgoraError(`Connection error (${err})`);
        });

        const broadcastToken = await fetchAgoraToken(session.agoraChannel);
        await engine.joinChannel(
          broadcastToken,
          session.agoraChannel,
          0,
          {
            clientRoleType: ClientRoleType.ClientRoleAudience,
            audienceLatencyLevel: AudienceLatencyLevelType.AudienceLatencyLevelUltraLowLatency,
            channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
            autoSubscribeAudio: true,
            autoSubscribeVideo: true,
          }
        );
      } catch (e) {
        console.error('Agora init error:', e);
        if (!didCancel) setAgoraError('Could not connect to live stream.');
      }
    };

    init();

    return () => {
      didCancel = true;
      cleanupEngine();
      setPhase('idle');
      setRemoteVideoLive(false);
    };
  }, [session?.agoraChannel, isFocused, reinitRef.current]);

  // ── Handle app background / foreground transitions ───────────
  // iOS aggressively kills background TCP connections, so the Agora
  // connection is very likely dead after more than a few seconds in
  // background.  Instead of trying to unmute a dead socket, do a
  // full teardown + re-init when the app returns to the foreground.
  const backgroundedAtRef = useRef(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAtRef.current = Date.now();
        // Mute to save data while briefly in background
        if (engineRef.current) {
          engineRef.current.muteAllRemoteAudioStreams(true);
          engineRef.current.muteAllRemoteVideoStreams(true);
        }
      } else if (nextState === 'active') {
        const elapsed = backgroundedAtRef.current
          ? Date.now() - backgroundedAtRef.current
          : 0;
        backgroundedAtRef.current = null;

        if (elapsed > 5000) {
          // Backgrounded for more than 5 seconds — connection is likely dead.
          // Tear down and force a full re-init via the reinitRef dependency.
          cleanupEngine();
          setPhase('idle');
          setRemoteVideoLive(false);
          reinitRef.current += 1;
        } else if (engineRef.current) {
          // Brief background (e.g. notification banner) — just unmute
          engineRef.current.muteAllRemoteAudioStreams(false);
          engineRef.current.muteAllRemoteVideoStreams(false);
        }
      }
    });
    return () => sub.remove();
  }, []);

  // ── Helpers ───────────────────────────────────────────────────
  const cleanupEngine = () => {
    if (engineRef.current) {
      engineRef.current.leaveChannel();
      engineRef.current.release();
      engineRef.current = null;
    }
    setBroadcastUid(null);
    setConsultRemoteUid(null);
  };

  const joinConsultation = async () => {
    if (!session || !AGORA_APP_ID) return;
    const ok = await requestMediaPermissions();
    if (!ok) {
      Alert.alert('Permissions required', 'Camera and microphone access are needed for the consultation.');
      return;
    }

    const privateChannel = `${session.agoraChannel}-pvt`;
    const engine = engineRef.current;
    if (!engine) return;

    setPhase('consultation');
    setConsultRemoteUid(null);

    try {
      // Switch to broadcaster role and join private channel
      await engine.leaveChannel();
      engine.removeAllListeners();

      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      engine.enableVideo();
      engine.enableAudio();
      await engine.startPreview();

      engine.addListener('onUserJoined', (_conn, uid) => {
        setConsultRemoteUid(uid);
      });
      engine.addListener('onUserOffline', () => {
        setConsultRemoteUid(null);
      });
      engine.addListener('onError', (err) => {
        console.warn('Agora consult error:', err);
      });

      const consultToken = await fetchAgoraToken(privateChannel);
      await engine.joinChannel(
        consultToken,
        privateChannel,
        0,
        { clientRoleType: ClientRoleType.ClientRoleBroadcaster }
      );
    } catch (e) {
      console.error('Consultation join error:', e);
      Alert.alert('Error', 'Could not join the consultation. Please try again.');
      setPhase('broadcast');
    }
  };

  const endConsultation = async () => {
    const engine = engineRef.current;
    if (!engine) return;

    try {
      await engine.leaveChannel();
      engine.removeAllListeners();

      // Rejoin main broadcast channel as audience
      engine.setClientRole(ClientRoleType.ClientRoleAudience, {
          audienceLatencyLevel: AudienceLatencyLevelType.AudienceLatencyLevelUltraLowLatency,
        });
      engine.disableVideo();
      engine.enableVideo();

      const hostUid = session?.hostUid ?? 1;
      setRemoteVideoLive(false);
      engine.addListener('onUserJoined', (_conn, uid) => { if (uid === hostUid) setBroadcastUid(uid); });
      engine.addListener('onUserOffline', (_conn, uid) => {
        if (uid === hostUid) { setBroadcastUid(null); setRemoteVideoLive(false); }
      });
      engine.addListener('onFirstRemoteVideoDecoded', (_conn, uid) => {
        if (uid === hostUid) setRemoteVideoLive(true);
      });
      engine.addListener('onRemoteVideoStateChanged', (_conn, uid, state) => {
        if (uid === hostUid) setRemoteVideoLive(state === 2);
      });
      engine.addListener('onJoinChannelSuccess', () => {
        setBroadcastUid(hostUid);
        setPhase('broadcast');
        setTimeout(() => setRemoteVideoLive(true), 4000);
      });

      const rejoinToken = await fetchAgoraToken(session?.agoraChannel);
      await engine.joinChannel(
        rejoinToken,
        session?.agoraChannel,
        0,
        {
          clientRoleType: ClientRoleType.ClientRoleAudience,
          audienceLatencyLevel: AudienceLatencyLevelType.AudienceLatencyLevelUltraLowLatency,
          channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
          autoSubscribeAudio: true,
          autoSubscribeVideo: true,
        }
      );
    } catch (e) {
      console.error('End consultation error:', e);
      setPhase('broadcast');
    }
    setConsultRemoteUid(null);
  };

  const joinWaitingRoom = async () => {
    if (!session || !user) return;

    // Private consultations are a premium feature
    if (user.membershipTier !== 'premium') {
      Alert.alert(
        'Premium Feature',
        'Private consultations with Rabbi Landau are available for Premium members only.\n\nUpgrade your membership to join the consultation queue.',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'View Plans', onPress: () => navigation.navigate('Settings') },
        ]
      );
      return;
    }

    setJoining(true);
    try {
      await addDoc(
        collection(db, COLLECTIONS.LIVE_SESSIONS, session.id, 'waitingRoom'),
        { userId: user.uid, userName: user.displayName, status: 'waiting', joinedAt: serverTimestamp() }
      );
    } catch {
      Alert.alert('Error', 'Could not join the waiting room. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const leaveWaitingRoom = () => {
    if (!myEntry) return;
    Alert.alert('Leave Waiting Room', 'Are you sure you want to leave the queue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: () => updateDoc(
          doc(db, COLLECTIONS.LIVE_SESSIONS, session.id, 'waitingRoom', myEntry.id),
          { status: 'left' }
        ),
      },
    ]);
  };

  const formatEstWait = (pos) => {
    const mins = (pos - 1) * 6;
    return mins === 0 ? "You're next!" : `~${mins} min`;
  };

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.teal} />
      </View>
    );
  }

  // ── No active session ─────────────────────────────────────────
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
        <LinearGradient colors={Gradients.teal} style={styles.offlineGradient}>
          <Text style={styles.offlineIcon}>📺</Text>
          <Text style={styles.offlineTitle}>No Live Session Right Now</Text>
          <Text style={styles.offlineSub}>
            You'll get a push notification as soon as Rabbi Landau goes live.
          </Text>
          <View style={styles.offlineNote}>
            <Text style={styles.offlineNoteText}>🔔 Make sure notifications are enabled</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ── Private consultation invitation ──────────────────────────
  if (phase === 'consult-invite') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LinearGradient colors={Gradients.gold} style={styles.inviteGradient}>
          <Text style={styles.inviteIcon}>✨</Text>
          <Text style={styles.inviteTitle}>Rabbi is ready for you!</Text>
          <Text style={styles.inviteSub}>
            Your private consultation is about to begin.{'\n'}
            You have 5 minutes with Rabbi Landau.
          </Text>
          <TouchableOpacity style={styles.joinConsultBtn} onPress={joinConsultation}>
            <Text style={styles.joinConsultBtnText}>Join Private Consultation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineBtn} onPress={() => setPhase('broadcast')}>
            <Text style={styles.declineBtnText}>Not now</Text>
          </TouchableOpacity>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ── Private consultation (2-way video call) ───────────────────
  if (phase === 'consultation') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Timer bar */}
        <LinearGradient colors={Gradients.teal} style={styles.consultHeader}>
          <Text style={styles.consultHeaderLabel}>Private Consultation</Text>
          <View style={[styles.consultTimerBadge, consultLeft <= 60 && styles.consultTimerUrgent]}>
            <Text style={styles.consultTimerText}>{formatCountdown(consultLeft)}</Text>
          </View>
        </LinearGradient>

        {/* Rabbi's video (remote) */}
        <View style={styles.consultRemoteWrap}>
          {consultRemoteUid !== null ? (
            <RtcSurfaceView
              canvas={{ uid: consultRemoteUid }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.gold} size="large" />
              <Text style={styles.waitingVideoText}>Waiting for Rabbi to connect...</Text>
            </View>
          )}
        </View>

        {/* Your own camera (local) — small pip */}
        <View style={styles.localPip}>
          <RtcSurfaceView
            canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* End button */}
        <View style={styles.consultFooter}>
          <TouchableOpacity style={styles.endConsultBtn} onPress={endConsultation}>
            <Text style={styles.endConsultBtnText}>End Consultation</Text>
          </TouchableOpacity>
        </View>   
      </SafeAreaView>
    );
  }

  // ── Main broadcast view ───────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Live header */}
      <LinearGradient colors={Gradients.teal} style={styles.liveHeader}>
        <View style={styles.liveHeaderTop}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE NOW</Text>
          </View>
          <Text style={styles.watchingCount}>👁 {session.viewerCount || 0} watching</Text>
        </View>
        <Text style={styles.liveTitle}>Rabbi Landau</Text>
        <Text style={styles.liveSubtitle}>{session.title || 'Live Session'}</Text>
      </LinearGradient>

      {/* Video area */}
      <View style={styles.videoArea}>

        {/* Connecting */}
        {phase === 'connecting' && (
          <View style={styles.videoOverlay}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.videoOverlayText}>Connecting to live stream...</Text>
          </View>
        )}

        {/* Error */}
        {agoraError && (
          <View style={styles.videoOverlay}>
            <Text style={styles.videoErrorIcon}>📡</Text>
            <Text style={styles.videoOverlayText}>{agoraError}</Text>
          </View>
        )}

        {/* Rabbi's live video — the RtcSurfaceView is always mounted once
            we have a broadcastUid so the SDK can decode frames into it.
            A loading overlay sits on top until onRemoteVideoStateChanged
            confirms actual video frames are arriving. */}
        {phase === 'broadcast' && broadcastUid !== null && !agoraError && (
          <RtcSurfaceView
            canvas={{ uid: broadcastUid }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Loading overlay — shown when channel is joined but video hasn't
            started rendering yet (prevents showing a black rectangle) */}
        {phase === 'broadcast' && broadcastUid !== null && !remoteVideoLive && !agoraError && !session.inConsultation && (
          <View style={styles.videoOverlay}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.videoOverlayText}>Loading video stream...</Text>
          </View>
        )}

        {/* Private consultation overlay — driven by Firestore, not by broadcastUid,
            so it shows correctly even when user joins while admin is in a consult. */}
        {phase === 'broadcast' && session.inConsultation && !agoraError && (
          <View style={styles.videoOverlay}>
            <Text style={styles.videoErrorIcon}>🤝</Text>
            <Text style={styles.videoOverlayText}>Rabbi is in a private consultation</Text>
            <Text style={styles.videoOverlaySubText}>Back shortly...</Text>
          </View>
        )}

        {/* Elapsed timer */}
        <View style={styles.videoTimer}>
          <Text style={styles.videoTimerText}>🔴 {elapsed}</Text>
        </View>
      </View>

      {/* Waiting room section */}
      <View style={styles.waitingSection}>
        <View style={styles.waitingHeader}>
          <Text style={styles.waitingTitle}>Private Consultation Queue</Text>
          <Text style={styles.waitingCount}>
            {waitingRoom.filter(m => m.status !== 'left').length} waiting
          </Text>
        </View>

        {/* My position card */}
        {inQueue && myPosition && myEntry?.status === 'waiting' && (
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
          style={styles.queueList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const isMe    = item.userId === user?.uid;
            const isFirst = index === 0 && item.status === 'in-session';
            return (
              <View style={[styles.queueItem, isMe && styles.queueItemMe]}>
                <View style={[
                  styles.queueNum,
                  isMe ? styles.queueNumMe : isFirst ? styles.queueNumFirst : styles.queueNumDefault,
                ]}>
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
          myEntry?.status === 'waiting' && (
            <TouchableOpacity style={styles.leaveBtn} onPress={leaveWaitingRoom}>
              <Text style={styles.leaveBtnText}>Leave Waiting Room</Text>
            </TouchableOpacity>
          )
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cream },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn:     { width: 34, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: Typography.sizes.xl, color: Colors.teal },
  headerTitle: { fontFamily: Typography.heading, fontSize: Typography.sizes.xl, color: Colors.tealDark },

  // Offline
  offlineGradient: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'], gap: Spacing.base },
  offlineIcon:     { fontSize: 56 },
  offlineTitle:    { fontFamily: Typography.heading, fontSize: Typography.sizes['2xl'], color: Colors.white, textAlign: 'center' },
  offlineSub:      { fontSize: Typography.sizes.md, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 22, fontFamily: Typography.body },
  offlineNote:     { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md },
  offlineNoteText: { fontSize: Typography.sizes.sm, color: 'rgba(255,255,255,0.8)', fontFamily: Typography.body },

  // Consultation invite
  inviteGradient: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'], gap: Spacing.lg },
  inviteIcon:     { fontSize: 64 },
  inviteTitle:    { fontFamily: Typography.heading, fontSize: Typography.sizes['3xl'], color: Colors.white, textAlign: 'center' },
  inviteSub:      { fontSize: Typography.sizes.md, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 24, fontFamily: Typography.body },
  joinConsultBtn: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.base,
    marginTop: Spacing.md, ...Shadows.gold,
  },
  joinConsultBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.base, color: Colors.gold },
  declineBtn:         { paddingVertical: Spacing.sm },
  declineBtnText:     { fontSize: Typography.sizes.sm, color: 'rgba(255,255,255,0.6)', fontFamily: Typography.body },

  // Consultation screen
  consultHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.base, paddingVertical: Spacing.md,
  },
  consultHeaderLabel:  { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.white },
  consultTimerBadge:   { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  consultTimerUrgent:  { backgroundColor: Colors.error },
  consultTimerText:    { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.base, color: Colors.white },
  consultRemoteWrap:   { flex: 1, backgroundColor: '#000', position: 'relative' },
  localPip: {
    position: 'absolute', bottom: 100, right: Spacing.base,
    width: 90, height: 130, borderRadius: Radius.md,
    backgroundColor: Colors.tealDark, overflow: 'hidden',
    borderWidth: 2, borderColor: Colors.white,
  },
  waitingVideoText: { color: 'rgba(255,255,255,0.5)', fontFamily: Typography.body, fontSize: Typography.sizes.sm, marginTop: Spacing.md },
  consultFooter: { padding: Spacing.base, backgroundColor: Colors.white },
  endConsultBtn:      { backgroundColor: Colors.error, borderRadius: Radius.xl, padding: Spacing.md, alignItems: 'center' },
  endConsultBtnText:  { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.white },

  // Live header
  liveHeader:    { padding: Spacing.base, paddingBottom: Spacing.md },
  liveHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  livePill:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: 'rgba(224,92,92,0.2)', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  liveDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.error },
  liveText:      { fontSize: 10, color: '#FF8888', fontFamily: Typography.bodySemiBold, letterSpacing: 1 },
  watchingCount: { fontSize: Typography.sizes.xs, color: 'rgba(255,255,255,0.65)', fontFamily: Typography.body },
  liveTitle:     { fontFamily: Typography.heading, fontSize: Typography.sizes.xl, color: Colors.white },
  liveSubtitle:  { fontSize: Typography.sizes.xs, color: Colors.goldLight, marginTop: 2, fontFamily: Typography.body },

  // Video
  videoArea: { height: 220, backgroundColor: '#000', position: 'relative' },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0A1A1A', gap: Spacing.md, zIndex: 1,
  },
  videoErrorIcon:    { fontSize: 36 },
  videoOverlayText:  { fontSize: Typography.sizes.sm, color: 'rgba(255,255,255,0.5)', fontFamily: Typography.body },
  videoOverlaySubText: { fontSize: Typography.sizes.xs, color: 'rgba(255,255,255,0.35)', fontFamily: Typography.body },
  videoTimer: {
    position: 'absolute', bottom: Spacing.sm, right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 3, zIndex: 2,
  },
  videoTimerText: { fontSize: Typography.sizes.xs, color: Colors.white, fontFamily: Typography.bodyMedium },

  // Waiting room
  waitingSection: { flex: 1, padding: Spacing.md, gap: Spacing.sm },
  waitingHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  waitingTitle:   { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.sm, color: Colors.tealDark, textTransform: 'uppercase', letterSpacing: 1 },
  waitingCount:   { fontSize: Typography.sizes.xs, color: Colors.textMuted, fontFamily: Typography.body },

  myPositionCard:  { borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center' },
  myPositionLabel: { fontSize: Typography.sizes.xs, color: Colors.goldLight, letterSpacing: 1, fontFamily: Typography.bodySemiBold },
  myPositionNum:   { fontFamily: Typography.heading, fontSize: 40, color: Colors.white },
  myPositionWait:  { fontSize: Typography.sizes.xs, color: 'rgba(255,255,255,0.7)', fontFamily: Typography.body },

  queueList: { flex: 1 },
  queueItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, marginBottom: Spacing.xs,
  },
  queueItemMe:     { borderColor: Colors.teal, borderWidth: 2, backgroundColor: Colors.tealPale },
  queueNum:        { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  queueNumDefault: { backgroundColor: Colors.creamDark },
  queueNumFirst:   { backgroundColor: Colors.success },
  queueNumMe:      { backgroundColor: Colors.teal },
  queueNumText:    { fontSize: Typography.sizes.xs, color: Colors.textMuted, fontFamily: Typography.bodySemiBold },
  queueName:       { flex: 1, fontSize: Typography.sizes.sm, color: Colors.textPrimary, fontFamily: Typography.body },
  queueNameMe:     { color: Colors.tealDark, fontFamily: Typography.bodySemiBold },
  inSessionBadge:  { fontSize: Typography.sizes.xs, color: Colors.success, fontFamily: Typography.bodySemiBold },
  youBadge:        { fontSize: Typography.sizes.xs, color: Colors.teal, fontFamily: Typography.bodySemiBold },

  joinBtn:         { backgroundColor: Colors.gold, borderRadius: Radius.xl, padding: Spacing.base, alignItems: 'center', ...Shadows.gold },
  joinBtnDisabled: { opacity: 0.6 },
  joinBtnText:     { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.white },
  leaveBtn:        { borderWidth: 1, borderColor: 'rgba(224,92,92,0.3)', borderRadius: Radius.xl, padding: Spacing.md, alignItems: 'center' },
  leaveBtnText:    { fontSize: Typography.sizes.sm, color: Colors.error, fontFamily: Typography.bodyMedium },
});
