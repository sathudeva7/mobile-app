/**
 * ProfileScreen — User Profile & Settings
 * Shows completion nudges for missing fields.
 * Allows editing all profile info.
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';

export default function ProfileScreen({ navigation }) {
  const { user, updateProfile } = useAuthStore();
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [fields, setFields]     = useState({
    displayName: user?.displayName  || '',
    phoneNumber: user?.phoneNumber  || '',
    hebrewName:  user?.hebrewName   || '',
    mothersName: user?.mothersName  || '',
  });

  const completionFields = [
    { key: 'displayName', label: 'Full Name',      icon: '👤', required: true },
    { key: 'phoneNumber', label: 'Phone Number',   icon: '📱', required: false },
    { key: 'hebrewName',  label: 'Hebrew Name',    icon: '✡️',  required: false },
    { key: 'mothersName', label: 'Mother\'s Name', icon: '🙏', required: false },
  ];

  const filledCount   = completionFields.filter(f => user?.[f.key]).length;
  const completionPct = Math.round((filledCount / completionFields.length) * 100);

  const handleSave = async () => {
    if (!fields.displayName.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    setSaving(true);
    await updateProfile(fields);
    setSaving(false);
    setEditing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <LinearGradient colors={Gradients.teal} style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <Text style={styles.name}>{user?.displayName || 'Your Name'}</Text>
          <Text style={styles.memberType}>{user?.membershipTier === 'premium' ? '⭐ Premium Member' : 'Member'}</Text>
          {user?.personalityType && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>🔥 {user.personalityType}</Text>
            </View>
          )}
        </LinearGradient>

        {/* Completion banner */}
        {completionPct < 100 && (
          <View style={styles.completionBanner}>
            <View style={styles.completionBannerTop}>
              <Text style={styles.completionBannerTitle}>Complete your profile — {completionPct}%</Text>
              <Text style={styles.completionBannerSub}>Add missing fields to unlock all features</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${completionPct}%` }]} />
            </View>
          </View>
        )}

        {/* Personality section */}
        {user?.personalityType && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Nature</Text>
            <View style={styles.natureCard}>
              <View style={styles.natureRow}>
                <View style={styles.natureBadge}>
                  <Text style={styles.natureBadgeLabel}>Rivnitz Type</Text>
                  <Text style={styles.natureBadgeValue}>{user.personalityType}</Text>
                </View>
                {user.mbtiType && (
                  <View style={styles.natureBadge}>
                    <Text style={styles.natureBadgeLabel}>MBTI</Text>
                    <Text style={styles.natureBadgeValue}>{user.mbtiType}</Text>
                  </View>
                )}
                {user.enneagramType && (
                  <View style={styles.natureBadge}>
                    <Text style={styles.natureBadgeLabel}>Enneagram</Text>
                    <Text style={styles.natureBadgeValue}>{user.enneagramType}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.retakeBtn} onPress={() => navigation.navigate('NatureQuiz')}>
                <Text style={styles.retakeBtnText}>Retake Nature Quiz</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Profile fields */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Profile Info</Text>
            <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color={Colors.teal} />
                : <Text style={styles.editBtn}>{editing ? 'Save' : 'Edit'}</Text>
              }
            </TouchableOpacity>
          </View>

          {completionFields.map(f => {
            const value   = user?.[f.key];
            const missing = !value;
            return (
              <View key={f.key} style={[styles.fieldCard, missing && !editing && styles.fieldCardMissing]}>
                <Text style={styles.fieldIcon}>{f.icon}</Text>
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabel}>
                    {f.label}
                    {missing && !editing && <Text style={styles.missingTag}> — Missing</Text>}
                  </Text>
                  {editing ? (
                    <TextInput
                      style={styles.fieldInput}
                      value={fields[f.key]}
                      onChangeText={val => setFields(prev => ({ ...prev, [f.key]: val }))}
                      placeholder={`Enter ${f.label.toLowerCase()}`}
                      placeholderTextColor={Colors.textMuted}
                      keyboardType={f.key === 'phoneNumber' ? 'phone-pad' : 'default'}
                    />
                  ) : (
                    <Text style={[styles.fieldValue, missing && styles.fieldValueMissing]}>
                      {value || 'Tap Edit to add'}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Streak info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Growth Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{user?.streakCount || 0}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{user?.membershipTier === 'premium' ? '⭐' : '🆓'}</Text>
              <Text style={styles.statLabel}>Membership</Text>
            </View>
          </View>
        </View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  scroll: { paddingBottom: Spacing['3xl'] },

  header: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing['2xl'] },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30 },
  name: { fontFamily: Typography.heading, fontSize: Typography.sizes['2xl'], color: Colors.white },
  memberType: { fontSize: Typography.sizes.xs, color: Colors.goldLight, fontFamily: Typography.body },
  typeBadge: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 4, marginTop: 2 },
  typeBadgeText: { fontSize: Typography.sizes.xs, color: Colors.goldLight, fontFamily: Typography.bodyMedium },

  completionBanner: {
    margin: Spacing.base, backgroundColor: Colors.gold,
    borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm,
  },
  completionBannerTop: {},
  completionBannerTitle: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.sm, color: Colors.white },
  completionBannerSub:   { fontSize: Typography.sizes.xs, color: 'rgba(255,255,255,0.8)', fontFamily: Typography.body },
  progressBg:   { height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.white, borderRadius: Radius.full },

  section: { padding: Spacing.base, paddingBottom: 0, gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.xs, color: Colors.tealDark, textTransform: 'uppercase', letterSpacing: 1 },
  editBtn: { fontSize: Typography.sizes.sm, color: Colors.teal, fontFamily: Typography.bodySemiBold },

  natureCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm, gap: Spacing.md },
  natureRow:  { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  natureBadge: { backgroundColor: Colors.tealPale, borderRadius: Radius.md, padding: Spacing.sm, minWidth: 80, alignItems: 'center' },
  natureBadgeLabel: { fontSize: 9, color: Colors.teal, fontFamily: Typography.bodySemiBold, textTransform: 'uppercase', letterSpacing: 0.5 },
  natureBadgeValue: { fontFamily: Typography.heading, fontSize: Typography.sizes.lg, color: Colors.tealDark },
  retakeBtn: { alignItems: 'center', paddingVertical: Spacing.xs },
  retakeBtnText: { fontSize: Typography.sizes.xs, color: Colors.teal, fontFamily: Typography.bodyMedium },

  fieldCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  fieldCardMissing: { borderStyle: 'dashed', borderColor: 'rgba(212,147,58,0.4)', borderWidth: 2 },
  fieldIcon:    { fontSize: 18, width: 24, textAlign: 'center' },
  fieldContent: { flex: 1 },
  fieldLabel:   { fontSize: Typography.sizes.xs, color: Colors.textMuted, fontFamily: Typography.bodyMedium, marginBottom: 2 },
  missingTag:   { color: Colors.gold },
  fieldValue:       { fontSize: Typography.sizes.sm, color: Colors.textPrimary, fontFamily: Typography.body },
  fieldValueMissing:{ color: Colors.textMuted, fontStyle: 'italic' },
  fieldInput: { fontSize: Typography.sizes.sm, color: Colors.textPrimary, fontFamily: Typography.body, padding: 0, borderBottomWidth: 1, borderBottomColor: Colors.border },

  statsRow: { flexDirection: 'row', gap: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm },
  statNum:  { fontFamily: Typography.heading, fontSize: Typography.sizes['2xl'], color: Colors.teal },
  statLabel:{ fontSize: Typography.sizes.xs, color: Colors.textMuted, marginTop: 2, fontFamily: Typography.body },
});
