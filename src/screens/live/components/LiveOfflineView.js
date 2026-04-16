import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Gradients } from '../../../theme';
import styles from '../liveSessionScreen.styles';

export default function LiveOfflineView({ onGoBack }) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onGoBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rabbi Live</Text>
        <View style={styles.headerSpacer} />
      </View>
      <LinearGradient colors={Gradients.teal} style={styles.offlineGradient}>
        <Text style={styles.offlineIcon}>📺</Text>
        <Text style={styles.offlineTitle}>No Live Session Right Now</Text>
        <Text style={styles.offlineSub}>
          You&apos;ll get a push notification as soon as Rabbi Landau goes live.
        </Text>
        <View style={styles.offlineNote}>
          <Text style={styles.offlineNoteText}>🔔 Make sure notifications are enabled</Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}
