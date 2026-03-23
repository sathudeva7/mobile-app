/**
 * VideoPlayerScreen
 * Full-screen video player using Mux + expo-av.
 * Shows title, description, related videos.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import { trackVideoView, getMuxPlaybackUrl } from '../../services/videoService';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');

export default function VideoPlayerScreen({ route, navigation }) {
  const { video }        = route.params;
  const { user }         = useAuthStore();
  const videoRef         = useRef(null);
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [embedBlocked, setEmbedBlocked] = useState(false);
  const [viewCount, setViewCount] = useState(video.viewCount || 0);
  const viewTracked      = useRef(false);

  const isYoutube   = video.videoType === 'youtube';
  const playbackUrl = isYoutube
    ? null
    : (getMuxPlaybackUrl(video.muxPlaybackId) || video.videoUrl);


  // Track view after 10 seconds of continuous watch time
  useEffect(() => {
    if (status.isLoaded && status.positionMillis > 10000 && !viewTracked.current) {
      viewTracked.current = true;
      trackVideoView(video.id, user?.uid).then(success => {
        if (success) setViewCount(prev => prev + 1);
      });
    }
  }, [status.isLoaded, status.positionMillis]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>←  Back</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Video player */}
        <View style={styles.playerContainer}>
          {loading && (
            <View style={styles.playerLoader}>
              <ActivityIndicator size="large" color={Colors.gold} />
            </View>
          )}
          {isYoutube ? (
            embedBlocked ? (
              <View style={[styles.player, styles.playerPlaceholder]}>
                <Text style={styles.embedBlockedIcon}>▶</Text>
                <Text style={styles.embedBlockedTitle}>Embedding disabled for this video</Text>
                <TouchableOpacity
                  style={styles.watchOnYoutubeBtn}
                  onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${video.youtubeVideoId}`)}
                >
                  <Text style={styles.watchOnYoutubeBtnText}>Watch on YouTube</Text>
                </TouchableOpacity>
              </View>
            ) : video.youtubeVideoId ? (
              <YoutubePlayer
                height={width * 0.5625}
                width={width}
                videoId={video.youtubeVideoId}
                play
                onReady={() => setLoading(false)}
                onError={() => { setLoading(false); setEmbedBlocked(true); }}
              />
            ) : (
              <View style={[styles.player, styles.playerPlaceholder]}>
                <Text style={styles.playerPlaceholderText}>Video unavailable</Text>
              </View>
            )
          ) : playbackUrl ? (
            <Video
              ref={videoRef}
              style={styles.player}
              source={{ uri: playbackUrl }}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              onPlaybackStatusUpdate={setStatus}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          ) : (
            <View style={[styles.player, styles.playerPlaceholder]}>
              <Text style={styles.playerPlaceholderText}>Video unavailable</Text>
            </View>
          )}
        </View>

        {/* Video info */}
        <View style={styles.infoSection}>
          <Text style={styles.videoTitle}>{video.title}</Text>
          <View style={styles.videoMeta}>
            <Text style={styles.videoMetaText}>Rabbi Landau</Text>
            <Text style={styles.videoMetaDot}>·</Text>
            <Text style={styles.videoMetaText}>{video.postedDate}</Text>
            <Text style={styles.videoMetaDot}>·</Text>
            <Text style={styles.videoMetaText}>{viewCount} views</Text>
          </View>

          {/* Topic tags */}
          {video.topics?.length > 0 && (
            <View style={styles.topicsRow}>
              {video.topics.map(topic => (
                <View key={topic} style={styles.topicTag}>
                  <Text style={styles.topicTagText}>{topic}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Description */}
          {video.description && (
            <Text style={styles.description}>{video.description}</Text>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* AI Coach CTA */}
          <TouchableOpacity
            style={styles.coachCta}
            onPress={() => navigation.navigate('Coach')}
          >
            <Text style={styles.coachCtaIcon}>🤖</Text>
            <View style={styles.coachCtaInfo}>
              <Text style={styles.coachCtaTitle}>Discuss this with your AI Coach</Text>
              <Text style={styles.coachCtaSub}>Get personalized guidance on this teaching</Text>
            </View>
            <Text style={styles.coachCtaArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },

  backBtn: { padding: Spacing.md },
  backBtnText: { fontSize: Typography.sizes.md, color: Colors.white, fontFamily: Typography.bodyMedium },

  playerContainer: { position: 'relative', backgroundColor: Colors.black, width, height: width * 0.5625 },
  playerLoader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  player: { width, height: width * 0.5625 },
  playerPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.tealDark, gap: Spacing.sm },
  playerPlaceholderText: { color: Colors.textMuted, fontFamily: Typography.body, fontSize: Typography.sizes.sm },
  embedBlockedIcon: { fontSize: 32, color: Colors.white },
  embedBlockedTitle: { color: Colors.white, fontFamily: Typography.body, fontSize: Typography.sizes.sm, textAlign: 'center', paddingHorizontal: Spacing.base },
  watchOnYoutubeBtn: { backgroundColor: '#FF0000', borderRadius: Radius.md, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, marginTop: Spacing.xs },
  watchOnYoutubeBtnText: { color: Colors.white, fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.sm },

  scroll: { backgroundColor: Colors.cream },
  infoSection: { backgroundColor: Colors.cream, padding: Spacing.base, gap: Spacing.md },

  videoTitle: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.lg, color: Colors.textPrimary, lineHeight: 24 },
  videoMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  videoMetaText: { fontSize: Typography.sizes.xs, color: Colors.textMuted, fontFamily: Typography.body },
  videoMetaDot:  { fontSize: Typography.sizes.xs, color: Colors.textMuted },

  topicsRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  topicTag: { backgroundColor: Colors.tealPale, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  topicTagText: { fontSize: Typography.sizes.xs, color: Colors.teal, fontFamily: Typography.bodyMedium },

  description: { fontSize: Typography.sizes.sm, color: Colors.textMuted, lineHeight: 20, fontFamily: Typography.body },

  divider: { height: 1, backgroundColor: Colors.borderLight },

  coachCta: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  coachCtaIcon:  { fontSize: 22 },
  coachCtaInfo:  { flex: 1 },
  coachCtaTitle: { fontFamily: Typography.bodySemiBold, fontSize: Typography.sizes.sm, color: Colors.tealDark },
  coachCtaSub:   { fontSize: Typography.sizes.xs, color: Colors.textMuted, marginTop: 2, fontFamily: Typography.body },
  coachCtaArrow: { fontSize: Typography.sizes.xl, color: Colors.teal },
});
