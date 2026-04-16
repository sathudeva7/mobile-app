import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../../../theme';
import styles from '../liveSessionScreen.styles';

export default function LiveLoadingView() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={Colors.teal} />
    </View>
  );
}
