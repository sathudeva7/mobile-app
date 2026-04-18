import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../../theme';

export default function OrnamentalRule({ label }) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      {label ? (
        <Text style={styles.label}>{label}</Text>
      ) : (
        <Text style={styles.glyph}>✦</Text>
      )}
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  line:  { flex: 1, height: 1, backgroundColor: 'rgba(27,107,107,0.15)' },
  glyph: { fontSize: 10, color: Colors.gold },
  label: {
    fontSize: 9,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    letterSpacing: 1.5,
  },
});
