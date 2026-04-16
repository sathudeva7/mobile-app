import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../../theme';

export default function ErrorToast({ message }) {
  if (!message) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.container}>
        <Text style={styles.exclaim}>!</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 90,
    left: Spacing.xl,
    right: Spacing.xl,
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.tealDark,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.25)',
    ...Shadows.lg,
  },
  exclaim: {
    fontSize: 13,
    color: Colors.gold,
    fontFamily: Typography.bodySemiBold,
    width: 18,
    textAlign: 'center',
  },
  message: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.9)',
    flex: 1,
  },
});
