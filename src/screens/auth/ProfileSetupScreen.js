/**
 * ProfileSetupScreen
 * Collects basic profile info after signup/quiz.
 * Fields: name, phone, Hebrew name, mother's name.
 * Missing fields always show a completion nudge.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import { useAuthStore } from '../../store/authStore';

export default function ProfileSetupScreen({ navigation }) {
  const { user, updateProfile, completeOnboarding } = useAuthStore();

  const [displayName,  setDisplayName]  = useState(user?.displayName  || '');
  const [phoneNumber,  setPhoneNumber]  = useState(user?.phoneNumber   || '');
  const [hebrewName,   setHebrewName]   = useState(user?.hebrewName    || '');
  const [mothersName,  setMothersName]  = useState(user?.mothersName   || '');
  const [saving] = useState(false);
  const [nameError, setNameError] = useState('');

  const completionPct = [displayName, phoneNumber, hebrewName, mothersName]
    .filter(Boolean).length * 25;

  const handleSave = () => {
    console.log('[ProfileSetup] Save pressed');
    console.log('[ProfileSetup] user:', JSON.stringify(user));
    console.log('[ProfileSetup] displayName:', displayName);
    if (!displayName.trim()) {
      setNameError('Please enter your name to continue.');
      return;
    }
    setNameError('');
    updateProfile({ displayName, phoneNumber, hebrewName, mothersName })
      .then(res => console.log('[ProfileSetup] updateProfile result:', JSON.stringify(res)))
      .catch(e => console.warn('[ProfileSetup] updateProfile error:', e));
    console.log('[ProfileSetup] calling completeOnboarding...');
    completeOnboarding();
    navigation.navigate('AppDrawer');
  };

  const handleSkip = () => {
    completeOnboarding();
    navigation.navigate('AppDrawer');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerFlame}>🔥</Text>
          <Text style={styles.headerTitle}>Complete Your Profile</Text>
          <Text style={styles.headerSub}>
            You can always update this later in Settings
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Profile completion</Text>
            <Text style={styles.progressPct}>{completionPct}%</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${completionPct}%` }]} />
          </View>
          {completionPct < 100 && (
            <Text style={styles.progressNote}>
              Complete your profile to unlock prayer requests & blessings
            </Text>
          )}
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Full Name *</Text>
            <TextInput
              style={[styles.input, nameError ? styles.inputError : null]}
              placeholder="Your full name"
              placeholderTextColor={Colors.textMuted}
              value={displayName}
              onChangeText={t => { setDisplayName(t); if (nameError) setNameError(''); }}
              autoCapitalize="words"
            />
            {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Phone Number
              {!phoneNumber && <Text style={styles.missingTag}> — Missing</Text>}
            </Text>
            <TextInput
              style={[styles.input, !phoneNumber && styles.inputMissing]}
              placeholder="Your phone number"
              placeholderTextColor={Colors.textMuted}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
          </View>
        </View>
  
        {/* Prayer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>For Prayers 🙏</Text>
          <View style={styles.prayerNote}>
            <Text style={styles.prayerNoteText}>
              In Jewish tradition, prayers are offered using your Hebrew name and your mother's name. 
              This ensures your tefillos reach exactly where they need to go.
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Hebrew Name
              {!hebrewName && <Text style={styles.missingTag}> — Missing</Text>}
            </Text>
            <TextInput
              style={[styles.input, !hebrewName && styles.inputMissing]}
              placeholder="e.g. Moshe ben Avraham"
              placeholderTextColor={Colors.textMuted}
              value={hebrewName}
              onChangeText={setHebrewName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Mother's Name
              {!mothersName && <Text style={styles.missingTag}> — Missing</Text>}
            </Text>
            <TextInput
              style={[styles.input, !mothersName && styles.inputMissing]}
              placeholder="e.g. Rivka"
              placeholderTextColor={Colors.textMuted}
              value={mothersName}
              onChangeText={setMothersName}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.saveBtnText}>Save & Enter App →</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  scroll: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing['3xl'] },

  header: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  headerFlame: { fontSize: 36 },
  headerTitle: { fontFamily: Typography.heading, fontSize: Typography.sizes['3xl'], color: Colors.tealDark, textAlign: 'center' },
  headerSub:   { fontSize: Typography.sizes.sm, color: Colors.textMuted, textAlign: 'center', fontFamily: Typography.body },

  progressSection: { gap: Spacing.xs },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel:  { fontSize: Typography.sizes.sm, color: Colors.textPrimary, fontFamily: Typography.bodyMedium },
  progressPct:    { fontSize: Typography.sizes.sm, color: Colors.teal, fontFamily: Typography.bodySemiBold },
  progressBg: { height: 8, backgroundColor: Colors.creamDark, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.teal, borderRadius: Radius.full },
  progressNote: { fontSize: Typography.sizes.xs, color: Colors.gold, fontFamily: Typography.body },

  section: { gap: Spacing.md },
  sectionTitle: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.sm, color: Colors.tealDark, textTransform: 'uppercase', letterSpacing: 1 },

  prayerNote: {
    backgroundColor: Colors.goldPale, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(212,147,58,0.2)',
  },
  prayerNoteText: { fontSize: Typography.sizes.xs, color: Colors.textMuted, lineHeight: 18, fontFamily: Typography.body },

  fieldGroup: { gap: Spacing.xs },
  fieldLabel: { fontSize: Typography.sizes.sm, color: Colors.textPrimary, fontFamily: Typography.bodyMedium },
  missingTag: { color: Colors.gold, fontFamily: Typography.body },
  input: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    padding: Spacing.md, fontSize: Typography.sizes.md,
    color: Colors.textPrimary, fontFamily: Typography.body,
    borderWidth: 1, borderColor: Colors.border,
  },
  inputMissing: { borderStyle: 'dashed', borderColor: 'rgba(212,147,58,0.5)', borderWidth: 2 },
  inputError: { borderColor: Colors.error, borderWidth: 1.5 },
  fieldError: { fontSize: Typography.sizes.xs, color: Colors.error, fontFamily: Typography.body, marginTop: 4, marginLeft: 2 },

  buttons: { gap: Spacing.md, marginTop: Spacing.sm },
  saveBtn: { backgroundColor: Colors.gold, borderRadius: Radius.xl, padding: Spacing.base, alignItems: 'center', ...Shadows.gold },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.white },
  skipBtn: { alignItems: 'center', padding: Spacing.sm },
  skipBtnText: { fontSize: Typography.sizes.sm, color: Colors.textMuted, fontFamily: Typography.body },
});
