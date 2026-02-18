/**
 * PrayersScreen — Prayer Requests, Candle Lighting & Blessings
 * All donation-based. Integrates with Stripe for donations.
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../services/firebase.client';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';

const SERVICES = [
  {
    id:          'candle',
    icon:        '🕯️',
    title:       'Light a Candle',
    description: 'In honor or memory of a loved one',
    bgColor:     Colors.goldPale,
    fields:      [
      { key: 'honoreeName', label: 'In honor / memory of', placeholder: 'Full name' },
      { key: 'message',     label: 'Message (optional)',   placeholder: 'Your message...' },
    ],
  },
  {
    id:          'prayer',
    icon:        '🙏',
    title:       'Submit Prayer Request',
    description: 'A name to be prayed for at the Tziyun',
    bgColor:     Colors.tealPale,
    fields:      [
      { key: 'hebrewName',  label: 'Hebrew name',         placeholder: 'e.g. Moshe ben Sara' },
      { key: 'prayerFor',   label: 'Prayer for',          placeholder: 'Health, parnassah, shidduch...' },
    ],
  },
  {
    id:          'yeshua',
    icon:        '✨',
    title:       'Request a Yeshua',
    description: 'For a miracle or salvation in your life',
    bgColor:     'rgba(212,147,58,0.08)',
    fields:      [
      { key: 'situation',   label: 'Your situation',      placeholder: 'Describe what you need...' },
      { key: 'hebrewName',  label: 'Hebrew name',         placeholder: 'e.g. Moshe ben Sara' },
    ],
  },
  {
    id:          'blessing',
    icon:        '💚',
    title:       'Personal Blessing',
    description: 'Request a blessing for yourself or family',
    bgColor:     Colors.tealPale,
    fields:      [
      { key: 'blessingFor', label: 'Blessing for',        placeholder: 'Yourself, spouse, children...' },
      { key: 'hebrewName',  label: 'Hebrew name',         placeholder: 'e.g. Moshe ben Sara' },
      { key: 'message',     label: 'Your request',        placeholder: 'What would you like blessed?' },
    ],
  },
];

const DONATION_AMOUNTS = [18, 36, 54, 72, 108];

export default function PrayersScreen({ navigation }) {
  const { user }                      = useAuthStore();
  const [selectedService, setService] = useState(null);
  const [formData, setFormData]       = useState({});
  const [donationAmt, setDonation]    = useState(36);
  const [customAmt, setCustomAmt]     = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);

  const openService = (service) => {
    setService(service);
    setFormData({});
    setSubmitted(false);
  };

  const closeModal = () => {
    setService(null);
    setFormData({});
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    const amount = customAmt ? parseFloat(customAmt) : donationAmt;
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid donation amount.');
      return;
    }
    setSubmitting(true);
    try {
      // Save request to Firestore
      await addDoc(collection(db, COLLECTIONS.PRAYER_REQUESTS), {
        type:         selectedService.id,
        userId:       user?.uid,
        userName:     user?.displayName,
        userEmail:    user?.email,
        formData,
        donationAmt:  amount,
        status:       'pending',
        createdAt:    serverTimestamp(),
      });

      // In production: initiate Stripe payment here before saving
      // await initiateStripeDonation(amount, selectedService.title);

      setSubmitted(true);
    } catch (e) {
      Alert.alert('Error', 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sacred Requests</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero */}
        <LinearGradient colors={Gradients.teal} style={styles.hero}>
          <Text style={styles.heroIcon}>🕯️</Text>
          <Text style={styles.heroTitle}>Prayers at the Holy Tziyun</Text>
          <Text style={styles.heroSub}>
            Rabbi Landau prays at the Ribnitzer Rebbe's tziyun on your behalf
          </Text>
        </LinearGradient>

        {/* Service cards */}
        {SERVICES.map(service => (
          <TouchableOpacity
            key={service.id}
            style={styles.serviceCard}
            onPress={() => openService(service)}
            activeOpacity={0.85}
          >
            <View style={[styles.serviceIcon, { backgroundColor: service.bgColor }]}>
              <Text style={styles.serviceIconText}>{service.icon}</Text>
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceTitle}>{service.title}</Text>
              <Text style={styles.serviceDesc}>{service.description}</Text>
            </View>
            <TouchableOpacity
              style={styles.donateBtn}
              onPress={() => openService(service)}
            >
              <Text style={styles.donateBtnText}>Donate</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {/* Donation note */}
        <View style={styles.donationNote}>
          <Text style={styles.donationNoteIcon}>♥</Text>
          <View style={styles.donationNoteInfo}>
            <Text style={styles.donationNoteTitle}>All requests are donation-based</Text>
            <Text style={styles.donationNoteSub}>Give what your heart calls you to give</Text>
          </View>
        </View>
      </ScrollView>

      {/* Request Modal */}
      <Modal
        visible={!!selectedService}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          {submitted ? (
            // Success screen
            <View style={styles.successContainer}>
              <LinearGradient colors={Gradients.teal} style={styles.successGradient}>
                <Text style={styles.successIcon}>🙏</Text>
                <Text style={styles.successTitle}>Request Submitted</Text>
                <Text style={styles.successSub}>
                  Rabbi Landau will pray for you at the holy Tziyun.{'\n'}
                  May your request be answered with blessings.
                </Text>
                <TouchableOpacity style={styles.successBtn} onPress={closeModal}>
                  <Text style={styles.successBtnText}>Close</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Modal header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeModal}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{selectedService?.title}</Text>
                <View style={{ width: 24 }} />
              </View>

              {/* Form fields */}
              <View style={styles.formSection}>
                {selectedService?.fields.map(field => (
                  <View key={field.key} style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder={field.placeholder}
                      placeholderTextColor={Colors.textMuted}
                      value={formData[field.key] || ''}
                      onChangeText={val => setFormData(prev => ({ ...prev, [field.key]: val }))}
                      multiline={field.key === 'message' || field.key === 'situation'}
                      numberOfLines={field.key === 'message' || field.key === 'situation' ? 3 : 1}
                    />
                  </View>
                ))}
              </View>

              {/* Donation amount */}
              <View style={styles.donationSection}>
                <Text style={styles.donationTitle}>Donation Amount</Text>
                <Text style={styles.donationSub}>Give what your heart calls you to give</Text>
                <View style={styles.amountRow}>
                  {DONATION_AMOUNTS.map(amt => (
                    <TouchableOpacity
                      key={amt}
                      style={[styles.amountBtn, donationAmt === amt && !customAmt && styles.amountBtnActive]}
                      onPress={() => { setDonation(amt); setCustomAmt(''); }}
                    >
                      <Text style={[styles.amountBtnText, donationAmt === amt && !customAmt && styles.amountBtnTextActive]}>
                        ${amt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.customAmountInput}
                  placeholder="Custom amount"
                  placeholderTextColor={Colors.textMuted}
                  value={customAmt}
                  onChangeText={setCustomAmt}
                  keyboardType="numeric"
                />
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.submitBtnText}>
                      Submit & Donate ${customAmt || donationAmt}
                    </Text>
                }
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
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
  backBtn:     { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: Typography.sizes.xl, color: Colors.teal },
  headerTitle: { fontFamily: Typography.heading, fontSize: Typography.sizes.xl, color: Colors.tealDark },

  scrollContent: { padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing['3xl'] },

  hero: { borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center' },
  heroIcon:  { fontSize: 32, marginBottom: Spacing.sm },
  heroTitle: { fontFamily: Typography.heading, fontSize: Typography.sizes.xl, color: Colors.white, textAlign: 'center', marginBottom: Spacing.xs },
  heroSub:   { fontSize: Typography.sizes.xs, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 18, fontFamily: Typography.body },

  serviceCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  serviceIcon: { width: 46, height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  serviceIconText: { fontSize: 22 },
  serviceInfo:    { flex: 1 },
  serviceTitle:   { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.tealDark },
  serviceDesc:    { fontSize: Typography.sizes.xs, color: Colors.textMuted, marginTop: 2, fontFamily: Typography.body },
  donateBtn:      { backgroundColor: Colors.gold, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  donateBtnText:  { fontSize: Typography.sizes.xs, color: Colors.white, fontFamily: Typography.bodySemiBold },

  donationNote: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.goldPale, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(212,147,58,0.2)',
  },
  donationNoteIcon:  { fontSize: 18, color: Colors.gold },
  donationNoteInfo:  {},
  donationNoteTitle: { fontSize: Typography.sizes.sm, color: Colors.gold, fontFamily: Typography.bodySemiBold },
  donationNoteSub:   { fontSize: Typography.sizes.xs, color: Colors.textMuted, fontFamily: Typography.body, marginTop: 2 },

  // Modal
  modal: { flex: 1, backgroundColor: Colors.cream },
  modalScroll: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing['4xl'] },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  modalClose: { fontSize: Typography.sizes.xl, color: Colors.textMuted },
  modalTitle: { fontFamily: Typography.heading, fontSize: Typography.sizes.xl, color: Colors.tealDark },

  formSection: { gap: Spacing.md },
  fieldGroup:  { gap: Spacing.xs },
  fieldLabel:  { fontSize: Typography.sizes.sm, color: Colors.tealDark, fontFamily: Typography.bodyMedium },
  fieldInput: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    padding: Spacing.md, fontSize: Typography.sizes.md,
    color: Colors.textPrimary, fontFamily: Typography.body,
    borderWidth: 1, borderColor: Colors.border, minHeight: 44,
  },

  donationSection: { gap: Spacing.sm },
  donationTitle:   { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.tealDark },
  donationSub:     { fontSize: Typography.sizes.xs, color: Colors.textMuted, fontFamily: Typography.body },
  amountRow:       { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  amountBtn: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.xs, backgroundColor: Colors.white,
  },
  amountBtnActive:      { backgroundColor: Colors.teal, borderColor: Colors.teal },
  amountBtnText:        { fontSize: Typography.sizes.sm, color: Colors.textMuted, fontFamily: Typography.bodyMedium },
  amountBtnTextActive:  { color: Colors.white },
  customAmountInput: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    padding: Spacing.md, fontSize: Typography.sizes.md,
    color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, fontFamily: Typography.body,
  },

  submitBtn: { backgroundColor: Colors.gold, borderRadius: Radius.xl, padding: Spacing.base, alignItems: 'center', ...Shadows.gold },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.white },

  // Success
  successContainer: { flex: 1 },
  successGradient: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'], gap: Spacing.base },
  successIcon:  { fontSize: 56 },
  successTitle: { fontFamily: Typography.heading, fontSize: Typography.sizes['3xl'], color: Colors.white, textAlign: 'center' },
  successSub:   { fontSize: Typography.sizes.md, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22, fontFamily: Typography.body },
  successBtn:   { backgroundColor: Colors.gold, borderRadius: Radius.xl, paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md, marginTop: Spacing.md, ...Shadows.gold },
  successBtnText: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.md, color: Colors.white },
});
