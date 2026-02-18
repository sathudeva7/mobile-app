/**
 * SettingsScreen
 * Notifications, subscription, account management.
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { scheduleMorningMotivation, cancelMorningNotifications } from '../../services/notifications';

export default function SettingsScreen({ navigation }) {
  const { user, signOut } = useAuthStore();

  const [notifNewVideo,   setNotifNewVideo]   = useState(true);
  const [notifLive,       setNotifLive]       = useState(true);
  const [notifMorning,    setNotifMorning]    = useState(true);
  const [notifCommunity,  setNotifCommunity]  = useState(false);

  const handleMorningToggle = async (val) => {
    setNotifMorning(val);
    if (val) {
      await scheduleMorningMotivation(9, 0);
    } else {
      await cancelMorningNotifications();
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const SECTIONS = [
    {
      title: 'Notifications',
      items: [
        { label: 'New Video Posted',       sub: 'When Rabbi uploads a teaching',       value: notifNewVideo,  onChange: setNotifNewVideo },
        { label: 'Rabbi Goes Live',        sub: 'Instant alert when live starts',      value: notifLive,      onChange: setNotifLive },
        { label: 'Morning Motivation',     sub: 'Daily guidance at 9:00 AM',           value: notifMorning,   onChange: handleMorningToggle },
        { label: 'Community Activity',     sub: 'Replies to your posts',               value: notifCommunity, onChange: setNotifCommunity },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Edit Profile',        icon: '👤', onPress: () => navigation.navigate('Profile') },
        { label: 'Subscription',        icon: '💳', onPress: () => Alert.alert('Coming soon', 'Subscription management coming soon.') },
        { label: 'Privacy Policy',      icon: '🔒', onPress: () => {} },
        { label: 'Terms of Service',    icon: '📄', onPress: () => {} },
        { label: 'Contact Support',     icon: '💬', onPress: () => {} },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* User info card */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>👤</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.displayName || 'Your Name'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.userTier}>
              {user?.membershipTier === 'premium' ? '⭐ Premium Member' : '🆓 Free Member'}
            </Text>
          </View>
        </View>

        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, i) => (
                <View key={item.label}>
                  {'value' in item ? (
                    // Toggle item
                    <View style={styles.settingRow}>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>{item.label}</Text>
                        {item.sub && <Text style={styles.settingSub}>{item.sub}</Text>}
                      </View>
                      <Switch
                        value={item.value}
                        onValueChange={item.onChange}
                        trackColor={{ false: Colors.creamDark, true: Colors.teal }}
                        thumbColor={Colors.white}
                      />
                    </View>
                  ) : (
                    // Nav item
                    <TouchableOpacity style={styles.settingRow} onPress={item.onPress}>
                      <Text style={styles.settingItemIcon}>{item.icon}</Text>
                      <Text style={[styles.settingLabel, { flex: 1 }]}>{item.label}</Text>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                  )}
                  {i < section.items.length - 1 && <View style={styles.separator} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Sign out */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>🚪  Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* App version */}
        <Text style={styles.version}>Rivnitz v1.0.0 · Miracles Through Mission 🔥</Text>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn:     { width: 34, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: Typography.sizes.xl, color: Colors.teal },
  headerTitle: { fontFamily: Typography.heading, fontSize: Typography.sizes.xl, color: Colors.tealDark },

  scroll: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing['3xl'] },

  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.base,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  userAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.teal, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userAvatarText: { fontSize: 22 },
  userInfo: { flex: 1 },
  userName:  { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.tealDark },
  userEmail: { fontSize: Typography.sizes.xs, color: Colors.textMuted, marginTop: 2, fontFamily: Typography.body },
  userTier:  { fontSize: Typography.sizes.xs, color: Colors.gold, marginTop: 3, fontFamily: Typography.bodyMedium },

  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: Typography.sizes.xs, color: Colors.tealDark, textTransform: 'uppercase', letterSpacing: 1, fontFamily: Typography.bodySemiBold },
  sectionCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.borderLight, overflow: 'hidden' },

  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.md },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: Typography.sizes.sm, color: Colors.textPrimary, fontFamily: Typography.body },
  settingSub:   { fontSize: Typography.sizes.xs, color: Colors.textMuted, marginTop: 1, fontFamily: Typography.body },
  settingItemIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  chevron: { fontSize: Typography.sizes.lg, color: Colors.textMuted },
  separator: { height: 1, backgroundColor: Colors.borderLight, marginLeft: Spacing.base },

  signOutBtn: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.base,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(224,92,92,0.2)',
  },
  signOutText: { fontSize: Typography.sizes.md, color: Colors.error, fontFamily: Typography.bodyMedium },

  version: { textAlign: 'center', fontSize: Typography.sizes.xs, color: Colors.textMuted, fontFamily: Typography.body },
});
