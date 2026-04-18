/**
 * PrayersScreen — The Sacred Sanctuary
 * Prayer Requests, Candle Lighting, Blessings & Dedications
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Modal, TextInput, ActivityIndicator,
  Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useStripe } from '@stripe/stripe-react-native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import app, { db, COLLECTIONS, auth } from '../../services/firebase.client';
import {
  getMuxUploadUrl,
  uploadVideoToMux,
  saveDedication,
  validateDuration,
} from '../../services/dedicateVideo';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';

// ─── Service definitions ──────────────────────────────────────────
const SERVICES = [
  {
    id:          'candle',
    glyph:       '🕯',
    title:       'Light a Candle',
    description: 'In honor or memory of a loved one',
    accentColor: Colors.gold,
    accentBg:    Colors.goldPale,
    fields: [
      { key: 'honoreeName', label: 'In honor / memory of', placeholder: 'Full name',        multiline: false },
      { key: 'message',     label: 'Message (optional)',   placeholder: 'Your message…',    multiline: true  },
    ],
  },
  {
    id:          'prayer',
    glyph:       '✦',
    title:       'Prayer Request',
    description: 'A name prayed for at the holy Tziyun',
    accentColor: Colors.teal,
    accentBg:    Colors.tealPale,
    fields: [
      { key: 'hebrewName', label: 'Hebrew name',  placeholder: 'e.g. Moshe ben Sara',         multiline: false },
      { key: 'prayerFor',  label: 'Prayer for',   placeholder: 'Health, parnassah, shidduch…', multiline: false },
    ],
  },
  {
    id:          'yeshua',
    glyph:       '☀',
    title:       'Request a Yeshua',
    description: 'For a miracle or salvation in your life',
    accentColor: '#C47A25',
    accentBg:    'rgba(212,147,58,0.08)',
    fields: [
      { key: 'situation',  label: 'Your situation', placeholder: 'Describe what you need…',  multiline: true  },
      { key: 'hebrewName', label: 'Hebrew name',    placeholder: 'e.g. Moshe ben Sara',       multiline: false },
    ],
  },
  {
    id:          'blessing',
    glyph:       '◎',
    title:       'Personal Blessing',
    description: 'Request a blessing for yourself or family',
    accentColor: Colors.teal,
    accentBg:    Colors.tealPale,
    fields: [
      { key: 'blessingFor', label: 'Blessing for',  placeholder: 'Yourself, spouse, children…', multiline: false },
      { key: 'hebrewName',  label: 'Hebrew name',   placeholder: 'e.g. Moshe ben Sara',          multiline: false },
      { key: 'message',     label: 'Your request',  placeholder: 'What would you like blessed?', multiline: true  },
    ],
  },
];

const DONATION_AMOUNTS = [18, 36, 54, 72, 108];

const TYPE_MAP = {
  candle:   'candle_lighting',
  prayer:   'prayer_request',
  yeshua:   'blessing',
  blessing: 'blessing',
};

function buildNote(serviceId, formData) {
  switch (serviceId) {
    case 'prayer':
      return [formData.hebrewName, formData.prayerFor].filter(Boolean).join(' — ');
    case 'candle':
      return [
        formData.honoreeName ? `In honor of ${formData.honoreeName}` : null,
        formData.message,
      ].filter(Boolean).join(' — ');
    case 'yeshua':
      return [formData.situation, formData.hebrewName].filter(Boolean).join(' — ');
    case 'blessing':
      return [
        formData.blessingFor ? `For ${formData.blessingFor}` : null,
        formData.hebrewName,
        formData.message,
      ].filter(Boolean).join(' — ');
    default:
      return '';
  }
}

// ─── Ornamental rule ──────────────────────────────────────────────
const OrnamentRule = ({ label, light = false }) => (
  <View style={or.row}>
    <View style={[or.line, light && or.lineLight]} />
    {label
      ? <Text style={[or.label, light && or.labelLight]}>{label}</Text>
      : <Text style={[or.glyph, light && or.glyphLight]}>✦</Text>
    }
    <View style={[or.line, light && or.lineLight]} />
  </View>
);
const or = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  line:       { flex: 1, height: 1, backgroundColor: 'rgba(212,147,58,0.2)' },
  lineLight:  { backgroundColor: 'rgba(255,255,255,0.25)' },
  glyph:      { fontSize: 9, color: Colors.gold },
  glyphLight: { color: 'rgba(212,147,58,0.8)' },
  label:      { fontSize: 8, color: Colors.textMuted, fontFamily: Typography.bodyMedium, letterSpacing: 2 },
  labelLight: { color: 'rgba(255,255,255,0.55)' },
});

// ─── Underline form field (matches Login/SignUp) ──────────────────
const FormField = ({ label, error, ...inputProps }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={ff.wrapper}>
      <Text style={[ff.label, focused && ff.labelFocused]}>{label}</Text>
      <TextInput
        style={[ff.input, inputProps.multiline && ff.inputMulti]}
        placeholderTextColor="transparent"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...inputProps}
      />
      <View style={[ff.line, focused && ff.lineFocused, error && ff.lineError]} />
      {error ? <Text style={ff.error}>{error}</Text> : null}
    </View>
  );
};
const ff = StyleSheet.create({
  wrapper: { gap: 2 },
  label: {
    fontSize: 9, letterSpacing: 2,
    color: Colors.teal, fontFamily: Typography.bodyMedium,
    textTransform: 'uppercase',
  },
  labelFocused: { color: Colors.gold },
  input: {
    backgroundColor: 'transparent',
    paddingVertical: Spacing.sm + 2, paddingHorizontal: 0,
    fontSize: Typography.sizes.base, color: Colors.textPrimary,
    fontFamily: Typography.body,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  line:        { height: 1,   backgroundColor: 'rgba(27,107,107,0.2)' },
  lineFocused: { height: 1.5, backgroundColor: Colors.gold },
  lineError:   { backgroundColor: Colors.error },
  error: { fontSize: Typography.sizes.xs, color: Colors.error, fontFamily: Typography.body, marginTop: 4 },
});

// ─── Animated service card ────────────────────────────────────────
function ServiceCard({ service, onPress, animValue }) {
  const cardStyle = {
    opacity: animValue,
    transform: [{ translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
  };

  return (
    <Animated.View style={cardStyle}>
      <TouchableOpacity
        style={s.serviceCard}
        onPress={() => onPress(service)}
        activeOpacity={0.85}
      >
        {/* Left accent bar */}
        <View style={[s.serviceAccent, { backgroundColor: service.accentColor }]} />

        {/* Glyph icon */}
        <View style={[s.serviceGlyphWrap, { backgroundColor: service.accentBg }]}>
          <Text style={[s.serviceGlyph, { color: service.accentColor }]}>{service.glyph}</Text>
        </View>

        <View style={s.serviceTextBlock}>
          <Text style={s.serviceTitle}>{service.title}</Text>
          <Text style={s.serviceDesc}>{service.description}</Text>
        </View>

        <View style={[s.offerPill, { borderColor: service.accentColor + '50', backgroundColor: service.accentBg }]}>
          <Text style={[s.offerPillText, { color: service.accentColor }]}>Offer →</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────
export default function PrayersScreen({ navigation }) {
  const { user } = useAuthStore();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Sacred request state
  const [selectedService, setService] = useState(null);
  const [formData, setFormData]       = useState({});
  const [donationAmt, setDonation]    = useState(36);
  const [customAmt, setCustomAmt]     = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Dedicate video state
  const [showDedicateModal, setShowDedicateModal] = useState(false);
  const [dedicatedTo, setDedicatedTo]             = useState('');
  const [dedicationMsg, setDedicationMsg]         = useState('');
  const [dedicatedToError, setDedicatedToError]   = useState('');
  const [selectedVideo, setSelectedVideo]         = useState(null);
  const [videoError, setVideoError]               = useState('');
  const [uploadProgress, setUploadProgress]       = useState(0);
  const [uploading, setUploading]                 = useState(false);
  const [uploadDone, setUploadDone]               = useState(false);
  const [uploadError, setUploadError]             = useState('');

  // Entrance animations
  const headerAnim  = useRef(new Animated.Value(0)).current;
  const parchAnim   = useRef(new Animated.Value(0)).current;
  const cardAnims   = useRef(SERVICES.map(() => new Animated.Value(0))).current;
  const dedicAnim   = useRef(new Animated.Value(0)).current;
  const noteAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(headerAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.timing(parchAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      ...cardAnims.map(a => Animated.timing(a, { toValue: 1, duration: 480, useNativeDriver: true })),
      Animated.timing(dedicAnim,  { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(noteAnim,   { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────
  const openService = useCallback((service) => {
    setService(service);
    setFormData({});
    setSubmitted(false);
    setSubmitError('');
    setDonation(36);
    setCustomAmt('');
  }, []);

  const closeModal = useCallback(() => {
    setService(null);
    setFormData({});
    setSubmitted(false);
    setSubmitError('');
  }, []);

  const handleSubmit = async () => {
    const amount = customAmt ? parseFloat(customAmt) : donationAmt;
    if (isNaN(amount) || amount <= 0) {
      setSubmitError('Please enter a valid donation amount.');
      return;
    }
    setSubmitError('');
    setSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) { setSubmitError('You must be signed in to donate.'); return; }
      const idToken = await currentUser.getIdToken();
      const fnRes = await fetch(
        'https://us-central1-rivnitz-cdd4d.cloudfunctions.net/createPaymentIntent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          body: JSON.stringify({
            data: { amount: Math.round(amount * 100), currency: 'usd', donationType: TYPE_MAP[selectedService.id] || 'general' },
          }),
        }
      );
      const rawText = await fnRes.text();
      if (!fnRes.ok) throw new Error(`Server error ${fnRes.status}: ${rawText.slice(0, 200)}`);
      let fnJson;
      try { fnJson = JSON.parse(rawText); } catch { throw new Error(`Unexpected response: ${rawText.slice(0, 200)}`); }
      if (fnJson.error) throw new Error(fnJson.error.message || 'Failed to start payment');
      const { clientSecret, paymentIntentId } = fnJson.result;
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Rivnitz — Rabbi Landau',
        style: 'automatic',
        appearance: { colors: { primary: '#1B6B6B' } },
      });
      if (initError) { setSubmitError(initError.message); return; }
      const { error: payError } = await presentPaymentSheet();
      if (payError) {
        if (payError.code !== 'Canceled') setSubmitError(payError.message);
        return;
      }
      await addDoc(collection(db, COLLECTIONS.DONATIONS), {
        userId: user?.uid || '', userName: user?.displayName || '', userEmail: user?.email || '',
        type: TYPE_MAP[selectedService.id] || 'general', amount,
        note: buildNote(selectedService.id, formData), formData,
        status: 'paid', paymentMethod: 'stripe', paymentIntentId,
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (e) {
      console.error('Payment error:', e);
      setSubmitError(e?.message || 'Payment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openDedicateModal = useCallback(() => {
    setShowDedicateModal(true);
    setDedicatedTo(''); setDedicationMsg(''); setDedicatedToError('');
    setSelectedVideo(null); setVideoError('');
    setUploadProgress(0); setUploading(false); setUploadDone(false); setUploadError('');
  }, []);

  const closeDedicateModal = useCallback(() => {
    if (uploading) return;
    setShowDedicateModal(false);
  }, [uploading]);

  const handlePickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setVideoError('Photo library access is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'videos', allowsEditing: false, videoMaxDuration: 120, quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!validateDuration(asset.duration)) { setVideoError('Video must be 2 minutes or less.'); return; }
    const fileName = asset.fileName || asset.uri.split('/').pop() || 'video.mp4';
    setSelectedVideo({ uri: asset.uri, name: fileName, duration: asset.duration });
    setVideoError('');
  };

  const handleDedicateSubmit = async () => {
    let valid = true;
    if (!dedicatedTo.trim()) { setDedicatedToError('Please enter who this is dedicated to.'); valid = false; }
    else { setDedicatedToError(''); }
    if (!selectedVideo) { setVideoError('Please select a video to upload.'); valid = false; }
    else { setVideoError(''); }
    if (!valid) return;
    setUploading(true); setUploadError(''); setUploadProgress(0);
    try {
      const { uploadId, uploadUrl } = await getMuxUploadUrl();
      await uploadVideoToMux(uploadUrl, selectedVideo.uri, setUploadProgress);
      await saveDedication({
        uploadId, dedicatedTo: dedicatedTo.trim(), message: dedicationMsg.trim(),
        userId: user?.uid || '', displayName: user?.displayName || '', userEmail: user?.email || '',
      });
      setUploadDone(true);
    } catch (e) {
      setUploadError(e.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────── */}
      <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0,1], outputRange: [-10, 0] }) }] }}>
        <LinearGradient colors={Gradients.teal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Sacred Requests</Text>
            <OrnamentRule light />
            <Text style={s.headerSub}>AT THE HOLY TZIYUN</Text>
          </View>
          <View style={{ width: 34 }} />
        </LinearGradient>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ── Parchment intro card ─────────────────────────── */}
        <Animated.View style={{ opacity: parchAnim, transform: [{ translateY: parchAnim.interpolate({ inputRange: [0,1], outputRange: [16, 0] }) }] }}>
          <View style={s.parchCard}>
            <Text style={s.parchGlyph}>✦</Text>
            <Text style={s.parchTitle}>Prayers at the Ribnitzer Tziyun</Text>
            <Text style={s.parchBody}>
              Rabbi Landau personally carries your requests to the holy resting place of the Ribnitzer Rebbe. Submit your sacred request and let miracles unfold.
            </Text>
          </View>
        </Animated.View>

        {/* ── Service cards ────────────────────────────────── */}
        <OrnamentRule label="CHOOSE A REQUEST" />

        {SERVICES.map((service, idx) => (
          <ServiceCard
            key={service.id}
            service={service}
            onPress={openService}
            animValue={cardAnims[idx]}
          />
        ))}

        {/* ── Dedicate a Video card ────────────────────────── */}
        <Animated.View style={{ opacity: dedicAnim, transform: [{ translateY: dedicAnim.interpolate({ inputRange: [0,1], outputRange: [28, 0] }) }] }}>
          <TouchableOpacity style={[s.serviceCard, s.dedicateCard]} onPress={openDedicateModal} activeOpacity={0.85}>
            <View style={[s.serviceAccent, { backgroundColor: Colors.teal }]} />
            <View style={[s.serviceGlyphWrap, { backgroundColor: Colors.tealPale }]}>
              <Text style={[s.serviceGlyph, { color: Colors.teal, fontSize: 18 }]}>▶</Text>
            </View>
            <View style={s.serviceTextBlock}>
              <Text style={s.serviceTitle}>Dedicate a Video</Text>
              <Text style={s.serviceDesc}>Upload a video in honor or memory of someone</Text>
            </View>
            <View style={[s.offerPill, { borderColor: Colors.teal + '50', backgroundColor: Colors.tealPale }]}>
              <Text style={[s.offerPillText, { color: Colors.teal }]}>Upload →</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Donation note ─────────────────────────────────── */}
        <Animated.View style={{ opacity: noteAnim, transform: [{ translateY: noteAnim.interpolate({ inputRange: [0,1], outputRange: [16, 0] }) }] }}>
          <View style={s.donationNote}>
            <View style={s.donationNoteLeft}>
              <Text style={s.donationNoteGlyph}>♥</Text>
            </View>
            <View style={s.donationNoteRight}>
              <Text style={s.donationNoteTitle}>All requests are donation-based</Text>
              <Text style={s.donationNoteSub}>Give what your heart calls you to give</Text>
            </View>
          </View>
        </Animated.View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* ══════════════════════════════════════════════════════
          Sacred Request Modal
      ══════════════════════════════════════════════════════ */}
      <Modal
        visible={!!selectedService}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={s.modal} edges={['bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {submitted ? (
              /* ── Success ─────────────────────────────────── */
              <View style={s.successContainer}>
                <LinearGradient colors={Gradients.teal} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.successGradient}>
                  <View style={s.successIconRing}>
                    <Text style={s.successGlyphBig}>✦</Text>
                  </View>
                  <Text style={s.successTitle}>Request Submitted</Text>
                  <OrnamentRule light />
                  <Text style={s.successSub}>
                    Rabbi Landau will pray for you at the holy Tziyun.{'\n'}
                    May your request be answered with blessings.
                  </Text>
                  <TouchableOpacity style={s.successBtn} onPress={closeModal} activeOpacity={0.8}>
                    <Text style={s.successBtnText}>Close  ✦</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={s.modalScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Modal handle */}
                <View style={s.modalHandle} />

                {/* Modal header */}
                <LinearGradient colors={Gradients.teal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.modalHeader}>
                  <TouchableOpacity onPress={closeModal} style={s.modalCloseBtn} activeOpacity={0.7}>
                    <Text style={s.modalCloseBtnText}>✕</Text>
                  </TouchableOpacity>
                  <View style={s.modalHeaderCenter}>
                    <Text style={s.modalTitle}>{selectedService?.title}</Text>
                  </View>
                  <View style={{ width: 36 }} />
                </LinearGradient>

                {/* Service glyph banner */}
                <View style={s.modalServiceBanner}>
                  <View style={[s.modalServiceGlyphWrap, { backgroundColor: selectedService?.accentBg }]}>
                    <Text style={[s.modalServiceGlyph, { color: selectedService?.accentColor }]}>
                      {selectedService?.glyph}
                    </Text>
                  </View>
                  <Text style={s.modalServiceDesc}>{selectedService?.description}</Text>
                </View>

                <OrnamentRule label="YOUR REQUEST" />

                {/* Form fields */}
                <View style={s.formBlock}>
                  {selectedService?.fields.map(field => (
                    <FormField
                      key={field.key}
                      label={field.label}
                      placeholder={field.placeholder}
                      value={formData[field.key] || ''}
                      onChangeText={val => setFormData(prev => ({ ...prev, [field.key]: val }))}
                      multiline={field.multiline}
                    />
                  ))}
                </View>

                {submitError ? (
                  <View style={s.inlineError}>
                    <Text style={s.inlineErrorText}>✦  {submitError}</Text>
                  </View>
                ) : null}

                <OrnamentRule label="YOUR OFFERING" />

                {/* Donation amounts */}
                <View style={s.donationBlock}>
                  <Text style={s.donationSub}>Give what your heart calls you to give</Text>
                  <View style={s.amountRow}>
                    {DONATION_AMOUNTS.map(amt => {
                      const active = donationAmt === amt && !customAmt;
                      return (
                        <TouchableOpacity
                          key={amt}
                          style={[s.amountChip, active && s.amountChipActive]}
                          onPress={() => { setDonation(amt); setCustomAmt(''); }}
                          activeOpacity={0.75}
                        >
                          <Text style={[s.amountChipText, active && s.amountChipTextActive]}>
                            ${amt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={s.customAmountWrap}>
                    <Text style={s.customAmountLabel}>OR ENTER AMOUNT</Text>
                    <TextInput
                      style={s.customAmountInput}
                      placeholder="$   custom"
                      placeholderTextColor={Colors.textMuted}
                      value={customAmt}
                      onChangeText={setCustomAmt}
                      keyboardType="numeric"
                    />
                    <View style={s.customAmountLine} />
                  </View>
                </View>

                {/* Submit CTA */}
                <TouchableOpacity
                  style={[s.submitBtn, submitting && s.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[Colors.gold, '#C47A25']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.submitBtnGrad}
                  >
                    {submitting
                      ? <ActivityIndicator color={Colors.white} />
                      : <Text style={s.submitBtnText}>
                          Submit & Donate ${customAmt || donationAmt}  ✦
                        </Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════════════════
          Dedicate Video Modal
      ══════════════════════════════════════════════════════ */}
      <Modal
        visible={showDedicateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDedicateModal}
      >
        <SafeAreaView style={s.modal} edges={['bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {uploadDone ? (
              /* ── Success ─────────────────────────────────── */
              <View style={s.successContainer}>
                <LinearGradient colors={Gradients.teal} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.successGradient}>
                  <View style={s.successIconRing}>
                    <Text style={[s.successGlyphBig, { fontSize: 28 }]}>▶</Text>
                  </View>
                  <Text style={s.successTitle}>Video Received</Text>
                  <OrnamentRule light />
                  <Text style={s.successSub}>
                    Your dedication has been received.{'\n'}
                    Rabbi Landau will personally watch your video.
                  </Text>
                  <TouchableOpacity style={s.successBtn} onPress={closeDedicateModal} activeOpacity={0.8}>
                    <Text style={s.successBtnText}>Done  ✦</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={s.modalScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Modal handle */}
                <View style={s.modalHandle} />

                {/* Modal header */}
                <LinearGradient colors={Gradients.teal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.modalHeader}>
                  <TouchableOpacity onPress={closeDedicateModal} disabled={uploading} style={s.modalCloseBtn} activeOpacity={0.7}>
                    <Text style={[s.modalCloseBtnText, uploading && { opacity: 0.3 }]}>✕</Text>
                  </TouchableOpacity>
                  <View style={s.modalHeaderCenter}>
                    <Text style={s.modalTitle}>Dedicate a Video</Text>
                  </View>
                  <View style={{ width: 36 }} />
                </LinearGradient>

                {/* Info banner */}
                <View style={s.dedicateBanner}>
                  <View style={s.dedicateBannerLine} />
                  <Text style={s.dedicateBannerText}>
                    Upload a personal video in honor or memory of a loved one. Rabbi Landau will personally watch it. Max 2 minutes.
                  </Text>
                </View>

                <OrnamentRule label="DEDICATION DETAILS" />

                {/* Fields */}
                <View style={s.formBlock}>
                  <FormField
                    label="Dedicated to *"
                    placeholder="In honor of / In memory of…"
                    value={dedicatedTo}
                    onChangeText={t => { setDedicatedTo(t); if (dedicatedToError) setDedicatedToError(''); }}
                    error={dedicatedToError}
                    editable={!uploading}
                  />
                  <FormField
                    label="Message (optional)"
                    placeholder="A personal note or prayer…"
                    value={dedicationMsg}
                    onChangeText={setDedicationMsg}
                    multiline
                    editable={!uploading}
                  />
                </View>

                <OrnamentRule label="YOUR VIDEO" />

                {/* Video picker */}
                <View style={s.videoPickerWrap}>
                  <TouchableOpacity
                    style={[s.videoPicker, selectedVideo && s.videoPickerSelected, uploading && s.videoPickerDisabled]}
                    onPress={handlePickVideo}
                    disabled={uploading}
                    activeOpacity={0.8}
                  >
                    {selectedVideo ? (
                      <View style={s.videoPickerRow}>
                        <Text style={s.videoPickerIcon}>▶</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={s.videoPickerName} numberOfLines={1}>{selectedVideo.name}</Text>
                          {selectedVideo.duration ? (
                            <Text style={s.videoPickerDur}>{Math.round(selectedVideo.duration / 1000)}s</Text>
                          ) : null}
                        </View>
                        <Text style={s.videoPickerChange}>Change</Text>
                      </View>
                    ) : (
                      <View style={s.videoPickerRow}>
                        <Text style={s.videoPickerPlaceholderIcon}>＋</Text>
                        <Text style={s.videoPickerPlaceholder}>Tap to select a video</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {videoError ? <Text style={s.fieldErrorText}>{videoError}</Text> : null}
                </View>

                {/* Upload progress */}
                {uploading && (
                  <View style={s.progressBlock}>
                    <View style={s.progressHeaderRow}>
                      <Text style={s.progressLabel}>Uploading your dedication…</Text>
                      <Text style={s.progressPct}>{Math.round(uploadProgress * 100)}%</Text>
                    </View>
                    <View style={s.progressTrack}>
                      <LinearGradient
                        colors={[Colors.teal, '#2A8A8A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[s.progressFill, { width: `${uploadProgress * 100}%` }]}
                      />
                    </View>
                  </View>
                )}

                {uploadError ? (
                  <View style={s.inlineError}>
                    <Text style={s.inlineErrorText}>✦  {uploadError}</Text>
                  </View>
                ) : null}

                {/* Submit */}
                <TouchableOpacity
                  style={[s.submitBtn, uploading && s.submitBtnDisabled]}
                  onPress={handleDedicateSubmit}
                  disabled={uploading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[Colors.teal, '#144F4F']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.submitBtnGrad}
                  >
                    {uploading
                      ? <ActivityIndicator color={Colors.white} />
                      : <Text style={s.submitBtnText}>Upload Dedication  ✦</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md + 4,
  },
  backBtn:   { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: Typography.sizes.xl, color: 'rgba(255,255,255,0.85)', lineHeight: 26 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize: 30,
    color: Colors.white,
    letterSpacing: 0.5,
    lineHeight: 34,
  },
  headerSub: {
    fontSize: 8, letterSpacing: 3,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: Typography.bodyMedium,
  },

  // ── Scroll ───────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing['3xl'],
  },

  // ── Parchment intro ───────────────────────────────────────────────
  parchCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.18)',
    ...Shadows.sm,
  },
  parchGlyph: { fontSize: 20, color: Colors.gold },
  parchTitle: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes.xl,
    color: Colors.tealDark,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  parchBody: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    fontFamily: Typography.body,
    fontStyle: 'italic',
  },

  // ── Service card ──────────────────────────────────────────────────
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.1)',
    ...Shadows.sm,
  },
  dedicateCard: { borderColor: 'rgba(27,107,107,0.15)' },
  serviceAccent: { width: 3, alignSelf: 'stretch' },
  serviceGlyphWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginLeft: Spacing.sm,
  },
  serviceGlyph: {
    fontSize: 20,
    fontFamily: Typography.heading,
  },
  serviceTextBlock: { flex: 1, paddingVertical: Spacing.md, gap: 3 },
  serviceTitle: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes.lg,
    color: Colors.tealDark,
    letterSpacing: 0.2,
  },
  serviceDesc: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    lineHeight: 16,
  },
  offerPill: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  offerPillText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.bodySemiBold,
    letterSpacing: 0.3,
  },

  // ── Donation note ─────────────────────────────────────────────────
  donationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.2)',
  },
  donationNoteLeft: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(212,147,58,0.15)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  donationNoteGlyph: { fontSize: 16, color: Colors.gold },
  donationNoteRight: { flex: 1 },
  donationNoteTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.sm,
    color: Colors.gold,
  },
  donationNoteSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    marginTop: 2,
  },

  // ── Modal shared ──────────────────────────────────────────────────
  modal:       { flex: 1, backgroundColor: Colors.cream },
  modalScroll: { paddingBottom: Spacing['3xl'] },

  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.13)',
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  modalCloseBtn: {
    width: 34, height: 34,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  modalCloseBtnText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontFamily: Typography.bodySemiBold },
  modalHeaderCenter: { flex: 1, alignItems: 'center' },
  modalTitle: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes['2xl'],
    color: Colors.white,
    letterSpacing: 0.3,
  },

  // Modal service banner
  modalServiceBanner: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: 8,
  },
  modalServiceGlyphWrap: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  modalServiceGlyph: {
    fontSize: 24,
    fontFamily: Typography.heading,
  },
  modalServiceDesc: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    fontStyle: 'italic',
  },

  // Form block
  formBlock: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },

  // Error
  inlineError: {
    marginHorizontal: Spacing.xl,
    backgroundColor: 'rgba(224,92,92,0.08)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.25)',
    marginBottom: Spacing.sm,
  },
  inlineErrorText: { fontSize: Typography.sizes.sm, color: Colors.error, fontFamily: Typography.body, letterSpacing: 0.3 },

  // Donation block
  donationBlock: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  donationSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  amountChip: {
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.3)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    minWidth: 50,
    alignItems: 'center',
  },
  amountChipActive:     { backgroundColor: Colors.gold, borderColor: Colors.gold },
  amountChipText:       { fontSize: Typography.sizes.sm, color: Colors.textMuted, fontFamily: Typography.bodyMedium },
  amountChipTextActive: { color: Colors.white, fontFamily: Typography.bodySemiBold },

  customAmountWrap: { gap: 4 },
  customAmountLabel: {
    fontSize: 8, letterSpacing: 2,
    color: Colors.teal, fontFamily: Typography.bodyMedium,
    textTransform: 'uppercase',
  },
  customAmountInput: {
    backgroundColor: 'transparent',
    paddingVertical: Spacing.sm,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    fontFamily: Typography.body,
  },
  customAmountLine: { height: 1, backgroundColor: 'rgba(27,107,107,0.2)' },

  // Submit button
  submitBtn: {
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadows.gold,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnGrad: {
    paddingVertical: Spacing.md + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.base,
    color: Colors.white,
    letterSpacing: 0.5,
  },

  // Dedicate banner
  dedicateBanner: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.md,
    gap: 0,
  },
  dedicateBannerLine: { width: 3, backgroundColor: Colors.teal, borderRadius: 2, marginRight: Spacing.md },
  dedicateBannerText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    lineHeight: 20,
    fontFamily: Typography.body,
    fontStyle: 'italic',
  },

  // Video picker
  videoPickerWrap: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  videoPicker: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(27,107,107,0.2)',
    borderStyle: 'dashed',
    padding: Spacing.md,
    minHeight: 60,
    justifyContent: 'center',
  },
  videoPickerSelected:  { borderColor: Colors.teal, borderStyle: 'solid', backgroundColor: Colors.tealPale },
  videoPickerDisabled:  { opacity: 0.5 },
  videoPickerRow:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  videoPickerIcon:      { fontSize: 16, color: Colors.teal },
  videoPickerName:      { fontFamily: Typography.bodyMedium, fontSize: Typography.sizes.sm, color: Colors.tealDark, flex: 1 },
  videoPickerDur:       { fontSize: Typography.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  videoPickerChange:    { fontSize: Typography.sizes.xs, color: Colors.teal, fontFamily: Typography.bodySemiBold },
  videoPickerPlaceholderIcon: { fontSize: 18, color: Colors.textMuted },
  videoPickerPlaceholder:     { fontSize: Typography.sizes.sm, color: Colors.textMuted, fontFamily: Typography.body },
  fieldErrorText: { fontSize: Typography.sizes.xs, color: Colors.error, fontFamily: Typography.body, marginTop: 4 },

  // Progress bar
  progressBlock: { paddingHorizontal: Spacing.xl, gap: Spacing.xs, marginBottom: Spacing.md },
  progressHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: Typography.sizes.sm, color: Colors.tealDark, fontFamily: Typography.bodyMedium },
  progressPct:   { fontSize: Typography.sizes.sm, color: Colors.teal, fontFamily: Typography.bodySemiBold },
  progressTrack: { height: 7, backgroundColor: 'rgba(27,107,107,0.1)', borderRadius: Radius.full, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: Radius.full },

  // Success
  successContainer: { flex: 1 },
  successGradient: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing['2xl'], gap: Spacing.base,
  },
  successIconRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(212,147,58,0.2)',
    borderWidth: 1.5, borderColor: 'rgba(212,147,58,0.5)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  successGlyphBig:  { fontSize: 32, color: Colors.goldLight },
  successTitle: {
    fontFamily: Typography.heading,
    fontSize: 38,
    color: Colors.white,
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 42,
  },
  successSub: {
    fontSize: Typography.sizes.md,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Typography.body,
    fontStyle: 'italic',
  },
  successBtn: {
    backgroundColor: 'rgba(212,147,58,0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,147,58,0.6)',
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  successBtnText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.base,
    color: Colors.goldLight,
    letterSpacing: 0.5,
  },
});
