/**
 * HomeScreen — Video Teaching Feed
 * Instagram-style grid of Rabbi Landau's teachings.
 * Filterable by topic, with featured video at top.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection,
  query,
  orderBy,
  where,
  limit,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '../../services/firebase';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.base * 2 - Spacing.sm) / 2;

const TOPIC_FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'marriage',  label: 'Marriage' },
  { id: 'faith',     label: 'Faith' },
  { id: 'parenting', label: 'Parenting' },
  { id: 'anger',     label: 'Anger' },
  { id: 'daily',     label: 'Daily Life' },
  { id: 'prayer',    label: 'Prayer' },
  { id: 'purpose',   label: 'Purpose' },
];

export default function HomeScreen({ navigation }) {
  const { user }          = useAuthStore();
  const [videos, setVideos]         = useState([]);
  const [filtered, setFiltered]     = useState([]);
  const [activeFilter, setFilter]   = useState('all');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load videos from Firestore
  const loadVideos = useCallback(async () => {
    try {
      const q    = query(collection(db, COLLECTIONS.VIDEOS), orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setVideos(data);
      setFiltered(data);
    } catch (e) {
      console.error('loadVideos error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadVideos(); }, []);

  // Filter by topic
  useEffect(() => {
    if (activeFilter === 'all') {
      setFiltered(videos);
    } else {
      setFiltered(videos.filter(v => v.topics?.includes(activeFilter)));
    }
  }, [activeFilter, videos]);

  const onRefresh = () => { setRefreshing(true); loadVideos(); };

  const featuredVideo = filtered[0];
  const gridVideos    = filtered.slice(1);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.teal} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Text style={styles.logoFlame}>🔥</Text>
          <View>
            <Text style={styles.logoName}>Rivnitz</Text>
            <Text style={styles.logoTagline}>Miracles Through Mission</Text>
          </View>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.openDrawer()}
          >
            <Text style={styles.iconBtnText}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Topic filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {TOPIC_FILTERS.map(f => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterTab, activeFilter === f.id && styles.filterTabActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterTabText, activeFilter === f.id && styles.filterTabTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Video feed */}
      <ScrollView
        style={styles.feed}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
      >
        {/* Featured video */}
        {featuredVideo && (
          <TouchableOpacity
            style={styles.featuredCard}
            onPress={() => navigation.navigate('VideoPlayer', { video: featuredVideo })}
            activeOpacity={0.9}
          >
            <LinearGradient colors={Gradients.teal} style={styles.featuredThumb}>
              {featuredVideo.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}
              <View style={styles.playBtn}>
                <Text style={styles.playBtnText}>▶</Text>
              </View>
              {featuredVideo.duration && (
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{featuredVideo.duration}</Text>
                </View>
              )}
            </LinearGradient>
            <View style={styles.featuredInfo}>
              <Text style={styles.featuredTitle} numberOfLines={2}>
                {featuredVideo.title}
              </Text>
              <Text style={styles.featuredMeta}>
                Rabbi Landau · {featuredVideo.postedDate} · {featuredVideo.viewCount} views
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Grid of remaining videos */}
        <View style={styles.grid}>
          {gridVideos.map((video) => (
            <TouchableOpacity
              key={video.id}
              style={styles.gridCard}
              onPress={() => navigation.navigate('VideoPlayer', { video })}
              activeOpacity={0.85}
            >
              <LinearGradient colors={Gradients.teal} style={styles.gridThumb}>
                <Text style={styles.gridPlayIcon}>▶</Text>
                {video.duration && (
                  <View style={styles.gridDuration}>
                    <Text style={styles.gridDurationText}>{video.duration}</Text>
                  </View>
                )}
              </LinearGradient>
              <View style={styles.gridInfo}>
                <Text style={styles.gridTitle} numberOfLines={2}>{video.title}</Text>
                <Text style={styles.gridTime}>{video.postedDate}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom padding */}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cream,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoFlame: { fontSize: 20 },
  logoName: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes.xl,
    color: Colors.teal,
    lineHeight: 22,
  },
  logoTagline: {
    fontSize: Typography.sizes.xs,
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 34,
    height: 34,
    backgroundColor: Colors.tealPale,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 16 },

  // Filters
  filtersScroll: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    maxHeight: 48,
  },
  filtersContent: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.creamDark,
  },
  filterTabActive: {
    backgroundColor: Colors.teal,
  },
  filterTabText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.bodyMedium,
  },
  filterTabTextActive: {
    color: Colors.white,
  },

  // Feed
  feed: {
    flex: 1,
    backgroundColor: Colors.cream,
  },

  // Featured video
  featuredCard: {
    margin: Spacing.base,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    ...Shadows.md,
  },
  featuredThumb: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  newBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: Typography.sizes.xs,
    color: Colors.white,
    fontFamily: Typography.bodySemiBold,
    letterSpacing: 0.5,
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.gold,
  },
  playBtnText: {
    fontSize: 18,
    color: Colors.white,
    marginLeft: 3,
  },
  durationBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.overlayDark,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  durationText: {
    fontSize: Typography.sizes.xs,
    color: Colors.white,
    fontFamily: Typography.body,
  },
  featuredInfo: {
    padding: Spacing.md,
  },
  featuredTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.md,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  featuredMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  gridCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  gridThumb: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gridPlayIcon: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
  },
  gridDuration: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: Colors.overlayDark,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  gridDurationText: {
    fontSize: 8,
    color: Colors.white,
    fontFamily: Typography.body,
  },
  gridInfo: {
    padding: Spacing.sm,
  },
  gridTitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.textPrimary,
    fontFamily: Typography.bodyMedium,
    lineHeight: 15,
    marginBottom: 3,
  },
  gridTime: {
    fontSize: 9,
    color: Colors.textMuted,
    fontFamily: Typography.body,
  },
});
