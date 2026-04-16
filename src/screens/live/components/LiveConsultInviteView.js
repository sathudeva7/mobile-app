import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Gradients } from '../../../theme';
import styles from '../liveSessionScreen.styles';

export default function LiveConsultInviteView({ onJoin, onDecline }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={Gradients.gold} style={styles.inviteGradient}>
        <Text style={styles.inviteIcon}>✨</Text>
        <Text style={styles.inviteTitle}>Rabbi is ready for you!</Text>
        <Text style={styles.inviteSub}>
          Your private consultation is about to begin.{'\n'}
          You have 5 minutes with Rabbi Landau.
        </Text>
        <TouchableOpacity style={styles.joinConsultBtn} onPress={onJoin}>
          <Text style={styles.joinConsultBtnText}>Join Private Consultation</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
          <Text style={styles.declineBtnText}>Not now</Text>
        </TouchableOpacity>
      </LinearGradient>
    </SafeAreaView>
  );
}
