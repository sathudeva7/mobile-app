/**
 * HomeScreen — Video Teaching Feed
 * Instagram-style grid of Rabbi Landau's teachings.
 * Filterable by topic, with featured video at top.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, Dimensions, Image, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../services/firebase.client';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { getVideoThumbnailUrl } from '../../services/videoService';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_PADDING  = Spacing.base;
const GRID_GAP      = Spacing.sm;
const CARD_WIDTH    = (SCREEN_W - GRID_PADDING * 2 - GRID_GAP) / 2;
const FEATURED_H    = 264;
const GRID_THUMB_H  = 118;

const INITIAL_LOAD        = 10;
const PAGE_SIZE           = 5;
const LOAD_MORE_THRESHOLD = 300;

const TOPIC_FILTERS = [
  { id: 'all',       label: 'All'       },
  { id: 'marriage',  label: 'Marriage'  },
  { id: 'faith',     label: 'Faith'     },
  { id: 'parenting', label: 'Parenting' },
  { id: 'anger',     label: 'Anger'     },
  { id: 'daily',     label: 'Daily Life'},
  { id: 'prayer',    label: 'Prayer'    },
  { id: 'purpose',   label: 'Purpose'   },
];

// ─── Hamburger icon (3 lines, tapered middle) ─────────────────────
const MenuIcon = () => (
  <View style={{ gap: 4.5 }}>
    <View style={{ width: 18, height: 1.5, backgroundColor: 'rgba(255,255,255,0.82)' }} />
    <View style={{ width: 13, height: 1.5, backgroundColor: 'rgba(255,255,255,0.82)' }} />
    <View style={{ width: 18, height: 1.5, backgroundColor: 'rgba(255,255,255,0.82)' }} />
  </View>
);

// ─── Staggered gold loading dots ──────────────────────────────────
const LoadingDots = () => {
  const dot1 = useRef(new Animated.Value(0.2)).current;
  const dot2 = useRef(new Animated.Value(0.2)).current;
  const dot3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const pulse = (dot, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1,   duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.2, duration: 300, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ])
    );
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 200);
    const a3 = pulse(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={ld.wrap}>
      <View style={ld.dotsRow}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[ld.dot, { opacity: dot }]} />
        ))}
      </View>
      <Text style={ld.label}>LOADING TEACHINGS</Text>
    </View>
  );
};

const ld = StyleSheet.create({
  wrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cream, gap: 16 },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.teal },
  label:   { fontSize: 9, letterSpacing: 2.5, color: Colors.textMuted, fontFamily: Typography.bodyMedium },
});

// ─── Video thumbnail (React.memo — only re-renders when video changes) ──
const VideoThumb = React.memo(function VideoThumb({ video, height }) {
  const thumbUrl = getVideoThumbnailUrl(video);
  return (
    <View style={[s.thumb, { height }]}>
      {thumbUrl
        ? <Image source={{ uri: thumbUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : <LinearGradient colors={Gradients.dark} style={StyleSheet.absoluteFill} />
      }
      <View style={s.thumbScrim} />
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { user } = useAuthStore();

  const [videos,       setVideos]      = useState([]);
  const [activeFilter, setFilter]      = useState('all');
  const [loading,      setLoading]     = useState(true);
  const [loadingMore,  setLoadingMore] = useState(false);
  const [refreshing,   setRefreshing]  = useState(false);
  const [hasMore,      setHasMore]     = useState(true);
  const [error,        setError]       = useState(null);

  const lastDocRef   = useRef(null);
  const featuredAnim = useRef(new Animated.Value(0)).current;

  // ── Initial / refresh load ────────────────────────────────────────
  const loadVideos = useCallback(async () => {
    setError(null);
    try {
      const q = query(
        collection(db, COLLECTIONS.VIDEOS),
        orderBy('createdAt', 'desc'),
        limit(INITIAL_LOAD),
      );
      const snap = await getDocs(q);
      const now  = new Date();
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(v => {
          if (v.publishStatus !== 'scheduled') return true;
          return v.scheduledPublishAt && new Date(v.scheduledPublishAt) <= now;
        });

      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === INITIAL_LOAD);
      setVideos(data);
    } catch (e) {
      console.error('loadVideos error:', e);
      setError(e.message || 'Failed to load videos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Paginated load-more ───────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, COLLECTIONS.VIDEOS),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      const now  = new Date();
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(v => {
          if (v.publishStatus !== 'scheduled') return true;
          return v.scheduledPublishAt && new Date(v.scheduledPublishAt) <= now;
        });

      if (snap.docs.length > 0) lastDocRef.current = snap.docs[snap.docs.length - 1];
      setHasMore(snap.docs.length === PAGE_SIZE);
      setVideos(prev => [...prev, ...data]);
    } catch (e) {
      console.error('loadMore error:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  useEffect(() => { loadVideos(); }, []);

  // Animate featured card in once data arrives
  useEffect(() => {
    if (!loading) {
      featuredAnim.setValue(0);
      Animated.timing(featuredAnim, {
        toValue: 1, duration: 550, useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const onRefresh = useCallback(() => {
    featuredAnim.setValue(0);
    lastDocRef.current = null;
    setHasMore(true);
    setRefreshing(true);
    loadVideos();
  }, [loadVideos]);

  const handleScroll = useCallback(({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const nearBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - LOAD_MORE_THRESHOLD;
    if (nearBottom && hasMore && !loadingMore) loadMore();
  }, [hasMore, loadingMore, loadMore]);

  // ── Derived data (memoised) ───────────────────────────────────────
  const filtered = useMemo(() => {
    if (activeFilter === 'all') return videos;
    return videos.filter(v => v.topics?.includes(activeFilter));
  }, [activeFilter, videos]);

  const featuredVideo = filtered[0];

  const gridRows = useMemo(() => {
    const grid = filtered.slice(1);
    const rows = [];
    for (let i = 0; i < grid.length; i += 2) rows.push(grid.slice(i, i + 2));
    return rows;
  }, [filtered]);

  const featuredStyle = {
    opacity: featuredAnim,
    transform: [{
      scale: featuredAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }),
    }],
  };

  if (loading) return <LoadingDots />;

  return (
    <SafeAreaView style={s.container} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <LinearGradient
        colors={Gradients.dark}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <View style={s.logoWrap}>
          <View style={s.logoRing}>
            <Image source={require('../../../assets/icon.png')} style={s.logoImg} />
          </View>
          <View>
            <Text style={s.logoName}>Rivnitz</Text>
            <Text style={s.logoTagline}>MIRACLES THROUGH MISSION</Text>
          </View>
        </View>

        <View style={s.headerActions}>
          <TouchableOpacity style={s.iconBtn} activeOpacity={0.7}>
            <Text style={s.bellIcon}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => navigation.openDrawer()}
            activeOpacity={0.7}
          >
            <MenuIcon />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Topic filter chips ───────────────────────────────────── */}
      <View style={s.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersContent}
        >
          {TOPIC_FILTERS.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[s.filterChip, activeFilter === f.id && s.filterChipActive]}
              onPress={() => setFilter(f.id)}
              activeOpacity={0.75}
            >
              <Text style={[s.filterChipText, activeFilter === f.id && s.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Feed ────────────────────────────────────────────────── */}
      <ScrollView
        style={s.feed}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={300}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.teal}
            colors={[Colors.teal]}
          />
        }
      >

        {/* ── Error state ───────────────────────────────────────── */}
        {error && (
          <View style={s.stateContainer}>
            <Text style={s.stateGlyph}>✦</Text>
            <Text style={s.stateTitle}>Could not load teachings</Text>
            <Text style={s.stateMessage}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={loadVideos} activeOpacity={0.8}>
              <Text style={s.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Empty state ───────────────────────────────────────── */}
        {!error && filtered.length === 0 && (
          <View style={s.stateContainer}>
            <Text style={s.stateGlyph}>✦</Text>
            <Text style={s.stateTitle}>No teachings found</Text>
            <Text style={s.stateMessage}>
              {activeFilter !== 'all'
                ? `No videos found for "${activeFilter}". Try a different topic.`
                : 'Teachings will appear here once added.'}
            </Text>
          </View>
        )}

        {/* ── Featured card (cinematic hero) ────────────────────── */}
        {featuredVideo && (
          <Animated.View style={[s.featuredWrap, featuredStyle]}>
            <TouchableOpacity
              style={s.featuredCard}
              onPress={() => navigation.navigate('VideoPlayer', { video: featuredVideo })}
              activeOpacity={0.92}
            >
              {/* All layers inside one overflow:hidden container */}
              <View style={s.featuredThumb}>

                {/* Base thumbnail */}
                <VideoThumb video={featuredVideo} height={FEATURED_H} />

                {/* Cinematic gradient scrim — transparent top → dark bottom */}
                <LinearGradient
                  colors={['transparent', 'rgba(4,14,14,0.42)', 'rgba(4,14,14,0.97)']}
                  locations={[0.2, 0.56, 1]}
                  style={StyleSheet.absoluteFill}
                />

                {/* NEW badge — top left */}
                {featuredVideo.isNew && (
                  <View style={s.newBadge}>
                    <Text style={s.newBadgeText}>NEW</Text>
                  </View>
                )}

                {/* Duration badge — top right */}
                {featuredVideo.duration && (
                  <View style={s.durationBadge}>
                    <Text style={s.durationText}>{featuredVideo.duration}</Text>
                  </View>
                )}

                {/* Play button — centered, nudged above info area */}
                <View style={s.playOverlay} pointerEvents="none">
                  <View style={s.playBtn}>
                    <Text style={s.playBtnIcon}>▶</Text>
                  </View>
                </View>

                {/* Info overlay — anchored to bottom */}
                <View style={s.featuredInfo}>
                  <Text style={s.featuredEyebrow}>✦  FEATURED TEACHING</Text>
                  <Text style={s.featuredTitle} numberOfLines={2}>
                    {featuredVideo.title}
                  </Text>
                  <View style={s.metaRow}>
                    <Text style={s.metaText}>Rabbi Landau</Text>
                    {featuredVideo.postedDate ? (
                      <>
                        <View style={s.metaDot} />
                        <Text style={s.metaText}>{featuredVideo.postedDate}</Text>
                      </>
                    ) : null}
                    {featuredVideo.viewCount > 0 ? (
                      <>
                        <View style={s.metaDot} />
                        <Text style={s.metaText}>{featuredVideo.viewCount} views</Text>
                      </>
                    ) : null}
                  </View>
                  {featuredVideo.topics?.length > 0 && (
                    <View style={s.tagsRow}>
                      {featuredVideo.topics.slice(0, 3).map(t => (
                        <View key={t} style={s.tag}>
                          <Text style={s.tagText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Ornamental section divider ────────────────────────── */}
        {gridRows.length > 0 && (
          <View style={s.sectionHeader}>
            <View style={s.sectionRule} />
            <Text style={s.sectionGlyph}>✦</Text>
            <Text style={s.sectionTitle}>MORE TEACHINGS</Text>
            <Text style={s.sectionGlyph}>✦</Text>
            <View style={s.sectionRule} />
          </View>
        )}

        {/* ── 2-column grid ─────────────────────────────────────── */}
        <View style={s.grid}>
          {gridRows.map((row, rowIdx) => (
            <View key={rowIdx} style={s.gridRow}>
              {row.map(video => (
                <TouchableOpacity
                  key={video.id}
                  style={s.gridCard}
                  onPress={() => navigation.navigate('VideoPlayer', { video })}
                  activeOpacity={0.82}
                >
                  {/* Thumbnail */}
                  <View style={s.gridThumb}>
                    <VideoThumb video={video} height={GRID_THUMB_H} />
                    {/* Centered play button */}
                    <View style={s.gridPlayOverlay} pointerEvents="none">
                      <View style={s.gridPlay}>
                        <Text style={s.gridPlayIcon}>▶</Text>
                      </View>
                    </View>
                    {/* Duration */}
                    {video.duration && (
                      <View style={s.gridDuration}>
                        <Text style={s.gridDurationText}>{video.duration}</Text>
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={s.gridInfo}>
                    <Text style={s.gridTitle} numberOfLines={2}>{video.title}</Text>
                    <Text style={s.gridDate} numberOfLines={1}>{video.postedDate}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {/* Phantom cell for odd rows */}
              {row.length === 1 && <View style={s.gridPlaceholder} />}
            </View>
          ))}
        </View>

        {/* ── Load-more spinner ─────────────────────────────────── */}
        {loadingMore && (
          <View style={s.loadMoreRow}>
            <ActivityIndicator size="small" color={Colors.teal} />
          </View>
        )}

        {/* ── End-of-list ornamental marker ─────────────────────── */}
        {!hasMore && videos.length > 0 && (
          <View style={s.endRow}>
            <View style={s.sectionRule} />
            <Text style={s.endText}>✦  ALL TEACHINGS LOADED  ✦</Text>
            <View style={s.sectionRule} />
          </View>
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },

  // ── Header ─────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  logoWrap:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logoRing: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.45)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(212,147,58,0.06)',
  },
  logoImg:     { width: 26, height: 26, resizeMode: 'contain' },
  logoName:    { fontFamily: Typography.heading, fontSize: 24, color: Colors.white, lineHeight: 26 },
  logoTagline: { fontSize: 8, color: 'rgba(212,147,58,0.68)', letterSpacing: 2, fontFamily: Typography.bodyMedium },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn: {
    width: 38, height: 38,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  bellIcon: { fontSize: 15 },

  // ── Filters ────────────────────────────────────────────────────
  filtersWrapper: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  filtersContent: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.base,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.creamDark,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filterChipActive: {
    backgroundColor: Colors.teal,
    borderColor: Colors.teal,
    ...Shadows.md,
  },
  filterChipText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Typography.bodyMedium,
    letterSpacing: 0.3,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontFamily: Typography.bodySemiBold,
  },

  // ── Feed ───────────────────────────────────────────────────────
  feed: { flex: 1, backgroundColor: Colors.cream },

  // ── Thumbnail base ─────────────────────────────────────────────
  thumb: {
    width: '100%',
    backgroundColor: '#0D2E2E',
    overflow: 'hidden',
  },
  thumbScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },

  // ── Featured card ──────────────────────────────────────────────
  featuredWrap: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
  },
  featuredCard: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    shadowColor: Colors.tealDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  featuredThumb: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },

  // Badges
  newBadge: {
    position: 'absolute', top: Spacing.md, left: Spacing.md,
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  newBadgeText: {
    fontSize: 9, color: Colors.white,
    fontFamily: Typography.bodySemiBold, letterSpacing: 1.5,
  },
  durationBadge: {
    position: 'absolute', top: Spacing.md, right: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.sm,
    paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  durationText: { fontSize: 10, color: Colors.white, fontFamily: Typography.bodyMedium },

  // Play button — centered, above info area
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  playBtn: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
    ...Shadows.gold,
  },
  playBtnIcon: { fontSize: 22, color: Colors.white, marginLeft: 4 },

  // Info overlay — anchored to bottom of featured thumbnail
  featuredInfo: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: Spacing.base,
    gap: 5,
  },
  featuredEyebrow: {
    fontSize: 9, letterSpacing: 2.5,
    color: Colors.gold, fontFamily: Typography.bodyMedium, opacity: 0.9,
  },
  featuredTitle: {
    fontFamily: Typography.heading,
    fontSize: 22, color: Colors.white,
    lineHeight: 28, letterSpacing: 0.2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 11, color: 'rgba(255,255,255,0.62)', fontFamily: Typography.body },
  metaDot:  { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.35)' },
  tagsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  tag: {
    backgroundColor: 'rgba(212,147,58,0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(212,147,58,0.28)',
  },
  tagText: { fontSize: 10, color: Colors.goldLight, fontFamily: Typography.bodyMedium },

  // ── Ornamental section divider ─────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.lg,
  },
  sectionRule:  { flex: 1, height: 1, backgroundColor: Colors.border },
  sectionGlyph: { fontSize: 8, color: Colors.gold },
  sectionTitle: {
    fontSize: 9, letterSpacing: 2.5,
    color: Colors.textMuted, fontFamily: Typography.bodyMedium,
  },

  // ── Grid ───────────────────────────────────────────────────────
  grid:        { paddingHorizontal: GRID_PADDING, gap: GRID_GAP },
  gridRow:     { flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP },
  gridCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  gridPlaceholder: { width: CARD_WIDTH },

  gridThumb: { overflow: 'hidden' },
  gridPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  gridPlay: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(212,147,58,0.85)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  gridPlayIcon: { fontSize: 12, color: Colors.white, marginLeft: 2 },
  gridDuration: {
    position: 'absolute', bottom: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  gridDurationText: { fontSize: 9, color: Colors.white, fontFamily: Typography.bodyMedium },

  gridInfo: {
    padding: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    gap: 3,
  },
  gridTitle: {
    fontFamily: Typography.headingRegular,
    fontSize: 14, color: Colors.textPrimary, lineHeight: 19,
  },
  gridDate: { fontSize: 10, color: Colors.textMuted, fontFamily: Typography.body },

  // ── State screens (empty / error) ──────────────────────────────
  stateContainer: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing['4xl'], paddingHorizontal: Spacing['2xl'],
    gap: Spacing.sm,
  },
  stateGlyph: { fontSize: 28, color: Colors.teal, opacity: 0.4, marginBottom: Spacing.sm },
  stateTitle: {
    fontFamily: Typography.heading, fontSize: 22,
    color: Colors.tealDark, textAlign: 'center',
  },
  stateMessage: {
    fontSize: 13, color: Colors.textMuted,
    textAlign: 'center', lineHeight: 20, fontFamily: Typography.body,
  },
  retryBtn: {
    marginTop: Spacing.md,
    borderWidth: 1, borderColor: Colors.teal,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm,
  },
  retryBtnText: {
    color: Colors.teal, fontFamily: Typography.bodyMedium,
    fontSize: 13, letterSpacing: 0.5,
  },

  // ── Pagination ─────────────────────────────────────────────────
  loadMoreRow: { alignItems: 'center', paddingVertical: Spacing.lg },
  endRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.lg,
  },
  endText: {
    fontSize: 9, color: Colors.textMuted,
    fontFamily: Typography.bodyMedium, letterSpacing: 2,
  },
});
