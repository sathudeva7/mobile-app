import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { RtcSurfaceView, VideoSourceType } from 'react-native-agora';
import { Gradients, Colors } from '../../../theme';
import { formatCountdown } from '../liveSessionUtils';
import styles from '../liveSessionScreen.styles';

export default function LiveConsultationView({
  consultLeft,
  consultRemoteUid,
  localPreviewReady,
  onEndConsultation,
}) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={Gradients.teal} style={styles.consultHeader}>
        <Text style={styles.consultHeaderLabel}>Private Consultation</Text>
        <View style={[styles.consultTimerBadge, consultLeft <= 60 && styles.consultTimerUrgent]}>
          <Text style={styles.consultTimerText}>{formatCountdown(consultLeft)}</Text>
        </View>
      </LinearGradient>

      <View style={styles.consultRemoteWrap}>
        {consultRemoteUid !== null ? (
          <RtcSurfaceView canvas={{ uid: consultRemoteUid }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.gold} size="large" />
            <Text style={styles.waitingVideoText}>Waiting for Rabbi to connect...</Text>
          </View>
        )}
      </View>

      <View style={styles.consultFooter}>
        <TouchableOpacity style={styles.endConsultBtn} onPress={onEndConsultation}>
          <Text style={styles.endConsultBtnText}>End Consultation</Text>
        </TouchableOpacity>
      </View>

      {localPreviewReady && (
        <View style={styles.localPip}>
          <RtcSurfaceView
            canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
