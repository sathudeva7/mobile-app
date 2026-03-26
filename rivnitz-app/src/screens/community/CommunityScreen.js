/**
 * CommunityScreen — Public Community Chat
 * All members can post, read, like, and reply.
 * Pinned posts from Rabbi shown at top.
 * Real-time updates via Firestore onSnapshot.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, doc, arrayUnion, arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '../../services/firebase';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import { useAuthStore } from '../../store/authStore';

export default function CommunityScreen() {
  const { user }                = useAuthStore();
  const [posts, setPosts]       = useState([]);
  const [pinned, setPinned]     = useState([]);
  const [inputText, setInput]   = useState('');
  const [loading, setLoading]   = useState(true);
  const [posting, setPosting]   = useState(false);
  const flatListRef             = useRef(null);

  // Load all posts in one query, split pinned vs regular client-side
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.COMMUNITY),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPinned(all.filter(p => p.pinned === true));
      setPosts(all.filter(p => !p.pinned));
      setLoading(false);
    }, (error) => {
      console.warn('Community posts listener error:', error);
      setLoading(false);
    });
  }, []);

  const handlePost = async () => {
    const text = inputText.trim();
    if (!text || posting) return;

    setPosting(true);
    setInput('');
    try {
      await addDoc(collection(db, COLLECTIONS.COMMUNITY), {
        content:     text,
        authorId:    user.uid,
        authorName:  user.displayName || 'Anonymous',
        pinned:      false,
        likes:       [],
        replyCount:  0,
        createdAt:   serverTimestamp(),
      });
    } catch (e) {
      Alert.alert('Error', 'Could not post. Please try again.');
      setInput(text);
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (post) => {
    const ref       = doc(db, COLLECTIONS.COMMUNITY, post.id);
    const hasLiked  = post.likes?.includes(user.uid);
    await updateDoc(ref, {
      likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const diff  = (Date.now() - date.getTime()) / 1000;
    if (diff < 60)   return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getInitials = (name = '') =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const AVATAR_COLORS = [
    Colors.tealPale, Colors.goldPale,
    'rgba(76,175,130,0.12)', 'rgba(61,124,201,0.12)',
  ];
  const AVATAR_TEXT_COLORS = [Colors.teal, Colors.gold, '#2E8B57', '#3D7CC9'];
  const avatarColor = (name = '') => {
    const i = name.charCodeAt(0) % AVATAR_COLORS.length;
    return { bg: AVATAR_COLORS[i], text: AVATAR_TEXT_COLORS[i] };
  };

  const renderPinnedPost = ({ item }) => (
    <View style={styles.pinnedPost}>
      <Text style={styles.pinnedLabel}>📌  PINNED — FROM RABBI LANDAU</Text>
      <Text style={styles.pinnedText}>{item.content}</Text>
      <Text style={styles.pinnedMeta}>Rabbi Landau · {formatTime(item.createdAt)}</Text>
    </View>
  );

  const renderPost = ({ item }) => {
    const { bg, text } = avatarColor(item.authorName);
    const liked        = item.likes?.includes(user?.uid);
    return (
      <View style={styles.post}>
        <View style={styles.postHeader}>
          <View style={[styles.avatar, { backgroundColor: bg }]}>
            <Text style={[styles.avatarText, { color: text }]}>
              {getInitials(item.authorName)}
            </Text>
          </View>
          <View style={styles.postMeta}>
            <Text style={styles.postAuthor}>{item.authorName}</Text>
            <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>
        <Text style={styles.postContent}>{item.content}</Text>
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item)}>
            <Text style={[styles.actionText, liked && styles.actionTextLiked]}>
              {liked ? '♥' : '♡'} {item.likes?.length || 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionText}>💬 {item.replyCount || 0} replies</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionText}>↗ Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
        <View>
          <Text style={styles.headerTitle}>Rivnitz Community</Text>
          <Text style={styles.headerCount}>🔥 Members Online</Text>
        </View>
      </View>

      {/* Feed */}
      <FlatList
        ref={flatListRef}
        data={posts}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          pinned.length > 0
            ? <FlatList data={pinned} renderItem={renderPinnedPost} keyExtractor={i => i.id} scrollEnabled={false} style={styles.pinnedList} />
            : null
        }
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Input bar */}
      <View style={styles.inputBar}>
        <View style={[styles.inputAvatar, { backgroundColor: Colors.tealPale }]}>
          <Text style={[styles.inputAvatarText, { color: Colors.teal }]}>
            {getInitials(user?.displayName)}
          </Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Share with the community..."
          placeholderTextColor={Colors.textMuted}
          value={inputText}
          onChangeText={setInput}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() || posting) && styles.sendBtnDisabled]}
          onPress={handlePost}
          disabled={!inputText.trim() || posting}
        >
          {posting
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Text style={styles.sendBtnText}>➤</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cream },

  header: {
    backgroundColor: Colors.white, paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerTitle: { fontFamily: Typography.heading, fontSize: Typography.sizes.xl, color: Colors.tealDark },
  headerCount: { fontSize: Typography.sizes.xs, color: Colors.gold, marginTop: 1 },

  feedContent: { padding: Spacing.md, gap: Spacing.sm },
  separator: { height: Spacing.sm },

  pinnedList: { marginBottom: Spacing.sm },
  pinnedPost: {
    backgroundColor: Colors.tealDark, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  pinnedLabel: { fontSize: Typography.sizes.xs, color: Colors.goldLight, fontFamily: Typography.bodySemiBold, marginBottom: Spacing.xs, letterSpacing: 0.5 },
  pinnedText: { fontSize: Typography.sizes.sm, color: 'rgba(255,255,255,0.92)', lineHeight: 20, fontStyle: 'italic', fontFamily: Typography.body },
  pinnedMeta: { fontSize: Typography.sizes.xs, color: Colors.goldLight, marginTop: Spacing.xs },

  post: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: Typography.sizes.xs, fontFamily: Typography.bodySemiBold },
  postMeta: { flex: 1 },
  postAuthor: { fontSize: Typography.sizes.sm, color: Colors.tealDark, fontFamily: Typography.bodySemiBold },
  postTime:   { fontSize: Typography.sizes.xs, color: Colors.textMuted },
  postContent: { fontSize: Typography.sizes.sm, color: Colors.textPrimary, lineHeight: 20, fontFamily: Typography.body },
  postActions: {
    flexDirection: 'row', gap: Spacing.base, marginTop: Spacing.sm,
    paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  actionBtn:  {},
  actionText: { fontSize: Typography.sizes.xs, color: Colors.textMuted, fontFamily: Typography.body },
  actionTextLiked: { color: Colors.gold },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    padding: Spacing.md, backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  inputAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inputAvatarText: { fontSize: Typography.sizes.xs, fontFamily: Typography.bodySemiBold },
  input: {
    flex: 1, backgroundColor: Colors.cream, borderRadius: Radius.xl,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    fontSize: Typography.sizes.sm, color: Colors.textPrimary, fontFamily: Typography.body,
    borderWidth: 1, borderColor: Colors.border, maxHeight: 100,
  },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', ...Shadows.gold },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontSize: 16, color: Colors.white },
});
