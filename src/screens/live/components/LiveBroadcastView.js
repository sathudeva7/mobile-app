import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { RtcSurfaceView } from 'react-native-agora';
import { Gradients, Colors } from '../../../theme';
import WaitingRoomSection from './WaitingRoomSection';
import styles from '../liveSessionScreen.styles';

export default function LiveBroadcastView({
  session,
  phase,
  broadcastUid,
  agoraError,
  remoteVideoLive,
  elapsed,
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
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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

      <View style={styles.videoArea}>
        {phase === 'connecting' && (
          <View style={styles.videoOverlay}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.videoOverlayText}>Connecting to live stream...</Text>
          </View>
        )}

        {agoraError && (
          <View style={styles.videoOverlay}>
            <Text style={styles.videoErrorIcon}>📡</Text>
            <Text style={styles.videoOverlayText}>{agoraError}</Text>
          </View>
        )}

        {phase === 'broadcast' && broadcastUid !== null && !agoraError && (
          <RtcSurfaceView canvas={{ uid: broadcastUid }} style={StyleSheet.absoluteFill} />
        )}

        {phase === 'broadcast' && broadcastUid !== null && !remoteVideoLive && !agoraError && !session.inConsultation && (
          <View style={styles.videoOverlay}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.videoOverlayText}>Loading video stream...</Text>
          </View>
        )}

        {phase === 'broadcast' && session.inConsultation && !agoraError && (
          <View style={styles.videoOverlay}>
            <Text style={styles.videoErrorIcon}>🤝</Text>
            <Text style={styles.videoOverlayText}>Rabbi is in a private consultation</Text>
            <Text style={styles.videoOverlaySubText}>Back shortly...</Text>
          </View>
        )}

        <View style={styles.videoTimer}>
          <Text style={styles.videoTimerText}>🔴 {elapsed}</Text>
        </View>
      </View>

      <WaitingRoomSection
        visibleQueue={visibleQueue}
        visibleQueueCount={visibleQueueCount}
        userId={userId}
        inQueue={inQueue}
        myPosition={myPosition}
        myEntry={myEntry}
        joining={joining}
        onJoinQueue={onJoinQueue}
        onLeaveQueue={onLeaveQueue}
      />
    </SafeAreaView>
  );
}
