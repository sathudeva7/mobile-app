import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../../theme';

export default function UnderlineTextField({ label, error, ...inputProps }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="transparent"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...inputProps}
      />
      <View style={[styles.line, focused && styles.lineFocused, error && styles.lineError]} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 2 },
  label: {
    fontSize: 9,
    letterSpacing: 2,
    color: Colors.teal,
    fontFamily: Typography.bodyMedium,
    textTransform: 'uppercase',
  },
  labelFocused: { color: Colors.gold },
  input: {
    backgroundColor: 'transparent',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: 0,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontFamily: Typography.body,
  },
  line:        { height: 1,   backgroundColor: 'rgba(27,107,107,0.2)' },
  lineFocused: { height: 1.5, backgroundColor: Colors.gold },
  lineError:   { backgroundColor: Colors.error },
  error: {
    fontSize: Typography.sizes.xs,
    color: Colors.error,
    fontFamily: Typography.body,
    marginTop: 4,
  },
});
