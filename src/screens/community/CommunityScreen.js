/**
 * CommunityScreen — Sacred Gathering
 * All members can post, read, like, and reply.
 * Pinned posts from Rabbi shown at top.
 * Real-time updates via Firestore onSnapshot.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform, RefreshControl, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection, query, orderBy, limit, onSnapshot, getDocs,
  addDoc, updateDoc, deleteDoc, increment, doc, arrayUnion, arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '../../services/firebase.client';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';
import { useAuthStore } from '../../store/authStore';

// ─── Pure helpers ─────────────────────────────────────────────────

const AVATAR_PALETTES = [
  { bg: 'rgba(27,107,107,0.10)',  text: Colors.teal      },
  { bg: 'rgba(212,147,58,0.12)', text: Colors.gold       },
  { bg: 'rgba(46,139,87,0.10)',  text: '#2E8B57'         },
  { bg: 'rgba(61,124,201,0.10)', text: '#3D7CC9'         },
  { bg: 'rgba(150,80,180,0.10)', text: '#9650B4'         },
];

function avatarColor(name = '') {
  const code = name.charCodeAt(0);
  const i = isNaN(code) ? 0 : code % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[i];
}

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff  = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Loading dots ──────────────────────────────────────────────────

function LoadingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.delay((2 - i) * 200),
        ]),
      ),
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={ld.row}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[ld.dot, { opacity: dot, transform: [{ scale: dot.interpolate({ inputRange: [0,1], outputRange: [0.7, 1.2] }) }] }]}
        />
      ))}
    </View>
  );
}

const ld = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.teal },
});

// ─── Confirm Modal ────────────────────────────────────────────────
function ConfirmModal({ visible, title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={confirmStyles.overlay}>
        <View style={confirmStyles.card}>
          <View style={confirmStyles.iconWrap}>
            <Text style={confirmStyles.iconGlyph}>✦</Text>
          </View>
          <Text style={confirmStyles.title}>{title}</Text>
          <Text style={confirmStyles.message}>{message}</Text>
          <View style={confirmStyles.actions}>
            <TouchableOpacity style={confirmStyles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={confirmStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={confirmStyles.confirmBtn} onPress={onConfirm} activeOpacity={0.7}>
              <Text style={confirmStyles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Error Toast ──────────────────────────────────────────────────
function ErrorToast({ message }) {
  if (!message) return null;
  return (
    <View style={toastStyles.wrap}>
      <View style={toastStyles.container}>
        <Text style={toastStyles.exclaim}>!</Text>
        <Text style={toastStyles.message}>{message}</Text>
      </View>
    </View>
  );
}

// ─── Memoized row components ──────────────────────────────────────

const PinnedPost = React.memo(function PinnedPost({ item }) {
  return (
    <View style={styles.pinnedCard}>
      <View style={styles.pinnedAccent} />
      <View style={styles.pinnedInner}>
        <View style={styles.pinnedBadgeRow}>
          <View style={styles.pinnedBadge}>
            <Text style={styles.pinnedBadgeText}>✦  RABBI'S MESSAGE</Text>
          </View>
          <Text style={styles.pinnedMeta}>{formatTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.pinnedText}>{item.content}</Text>
        <Text style={styles.pinnedAuthor}>— Rabbi Landau</Text>
      </View>
    </View>
  );
});

const PostItem = React.memo(function PostItem({
  item, userId, activeReplyId, activeReplyCount, onLike, onDelete, onReply,
}) {
  const palette    = avatarColor(item.authorName);
  const liked      = item.likes?.includes(userId);
  const replyCount = activeReplyId === item.id ? activeReplyCount : (item.replyCount || 0);
  const likeCount  = item.likes?.length || 0;

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: palette.bg, borderColor: palette.text + '30' }]}>
          <Text style={[styles.avatarText, { color: palette.text }]}>
            {getInitials(item.authorName)}
          </Text>
        </View>

        <View style={styles.postMeta}>
          <Text style={styles.postAuthor}>{item.authorName}</Text>
          <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
        </View>

        {item.authorId === userId && (
          <TouchableOpacity onPress={() => onDelete(item)} style={styles.deleteBtn} activeOpacity={0.6}>
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.postContent}>{item.content}</Text>

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onLike(item)} activeOpacity={0.7}>
          <View style={[styles.actionPill, liked && styles.actionPillLiked]}>
            <Text style={[styles.actionHeart, liked && styles.actionHeartLiked]}>
              {liked ? '♥' : '♡'}
            </Text>
            {likeCount > 0 && (
              <Text style={[styles.actionCount, liked && styles.actionCountLiked]}>{likeCount}</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onReply(item)} activeOpacity={0.7}>
          <View style={styles.actionPill}>
            <Text style={styles.actionReplyIcon}>◎</Text>
            <Text style={styles.actionCount}>
              {replyCount > 0 ? `${replyCount}` : 'Reply'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const ReplyItem = React.memo(function ReplyItem({ item }) {
  const palette = avatarColor(item.authorName);
  return (
    <View style={styles.replyRow}>
      <View style={[styles.replyAvatar, { backgroundColor: palette.bg, borderColor: palette.text + '30' }]}>
        <Text style={[styles.replyAvatarText, { color: palette.text }]}>
          {getInitials(item.authorName)}
        </Text>
      </View>
      <View style={styles.replyBubble}>
        <View style={styles.replyBubbleHeader}>
          <Text style={styles.replyAuthor}>{item.authorName}</Text>
          <Text style={styles.replyTime}>{formatTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.replyContent}>{item.content}</Text>
      </View>
    </View>
  );
});

// ─── Screen ───────────────────────────────────────────────────────

export default function CommunityScreen() {
  const { user }                        = useAuthStore();
  const [posts, setPosts]               = useState([]);
  const [pinned, setPinned]             = useState([]);
  const [inputText, setInput]           = useState('');
  const [loading, setLoading]           = useState(true);
  const [posting, setPosting]           = useState(false);
  const [refreshing, setRefreshing]     = useState(false);

  // Reply modal state
  const [replyPost, setReplyPost]       = useState(null);
  const [replies, setReplies]           = useState([]);
  const [replyText, setReplyText]       = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const replyListRef                    = useRef(null);
  const flatListRef                     = useRef(null);

  // Custom UI state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [errorMsg, setErrorMsg]         = useState('');

  // Header entrance animation
  const headerAnim = useRef(new Animated.Value(0)).current;
  const feedAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(feedAnim,   { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const headerStyle = {
    opacity: headerAnim,
    transform: [{ translateY: headerAnim.interpolate({ inputRange: [0,1], outputRange: [-8, 0] }) }],
  };
  const feedStyle = {
    opacity: feedAnim,
    transform: [{ translateY: feedAnim.interpolate({ inputRange: [0,1], outputRange: [16, 0] }) }],
  };

  const showError = useCallback((msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 3000);
  }, []);

  // ── Posts listener ─────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.COMMUNITY),
      orderBy('createdAt', 'desc'),
      limit(51),
    );
    return onSnapshot(
      q,
      snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPinned(all.filter(p => p.pinned === true));
        setPosts(all.filter(p => !p.pinned));
        setLoading(false);
      },
      err => {
        console.error('Community error:', err.code, err.message);
        setLoading(false);
      },
    );
  }, []);

  // ── Replies listener ───────────────────────────────────────────────
  useEffect(() => {
    if (!replyPost) { setReplies([]); return; }
    setReplyLoading(true);
    const q = query(
      collection(db, COLLECTIONS.COMMUNITY, replyPost.id, 'replies'),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(
      q,
      snap => {
        setReplies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setReplyLoading(false);
      },
      err => {
        console.error('Replies error:', err.code, err.message);
        setReplyLoading(false);
      },
    );
  }, [replyPost?.id]);

  // ── Unified feed ───────────────────────────────────────────────────
  const combinedData = useMemo(() => [
    ...pinned.map(p => ({ ...p, _type: 'pinned' })),
    ...posts.map(p =>  ({ ...p, _type: 'post'   })),
  ], [pinned, posts]);

  // ── Pull-to-refresh ────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const q = query(
        collection(db, COLLECTIONS.COMMUNITY),
        orderBy('createdAt', 'desc'),
        limit(51),
      );
      const snap = await getDocs(q);
      const all  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPinned(all.filter(p => p.pinned === true));
      setPosts(all.filter(p => !p.pinned));
    } catch (e) {
      console.warn('Refresh error:', e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────

  const handlePost = useCallback(async () => {
    const text = inputText.trim();
    if (!text || posting) return;
    setPosting(true);
    setInput('');
    try {
      await addDoc(collection(db, COLLECTIONS.COMMUNITY), {
        content:    text,
        authorId:   user.uid,
        authorName: user.displayName || 'Anonymous',
        pinned:     false,
        likes:      [],
        replyCount: 0,
        createdAt:  serverTimestamp(),
      });
    } catch (e) {
      showError('Could not post. Please try again.');
      setInput(text);
    } finally {
      setPosting(false);
    }
  }, [inputText, posting, user, showError]);

  const handleLike = useCallback(async (post) => {
    const ref      = doc(db, COLLECTIONS.COMMUNITY, post.id);
    const hasLiked = post.likes?.includes(user.uid);
    await updateDoc(ref, {
      likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  }, [user?.uid]);

  const handleDeletePost = useCallback((post) => {
    setDeleteTarget(post);
  }, []);

  const confirmDelete = useCallback(async () => {
    const post = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteDoc(doc(db, COLLECTIONS.COMMUNITY, post.id));
    } catch (e) {
      showError('Could not delete post. Please try again.');
    }
  }, [deleteTarget, showError]);

  const handleSendReply = useCallback(async () => {
    const text = replyText.trim();
    if (!text || sendingReply || !replyPost) return;
    setSendingReply(true);
    setReplyText('');
    try {
      await addDoc(
        collection(db, COLLECTIONS.COMMUNITY, replyPost.id, 'replies'),
        {
          content:    text,
          authorId:   user.uid,
          authorName: user.displayName || 'Anonymous',
          createdAt:  serverTimestamp(),
        }
      );
    } catch (e) {
      showError('Could not send reply. Please try again.');
      setReplyText(text);
      setSendingReply(false);
      return;
    }
    try {
      await updateDoc(doc(db, COLLECTIONS.COMMUNITY, replyPost.id), {
        replyCount: increment(1),
      });
    } catch (e) {
      console.warn('replyCount increment failed:', e.message);
    }
    setSendingReply(false);
  }, [replyText, sendingReply, replyPost, user, showError]);

  const renderItem = useCallback(({ item }) => {
    if (item._type === 'pinned') {
      return <PinnedPost item={item} />;
    }
    return (
      <PostItem
        item={item}
        userId={user?.uid}
        activeReplyId={replyPost?.id}
        activeReplyCount={replies.length}
        onLike={handleLike}
        onDelete={handleDeletePost}
        onReply={setReplyPost}
      />
    );
  }, [user?.uid, replyPost?.id, replies.length, handleLike, handleDeletePost]);

  const keyExtractor = useCallback(item => item.id, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingDots />
        <Text style={styles.loadingText}>Gathering voices...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────── */}
      <Animated.View style={headerStyle}>
        <LinearGradient
          colors={Gradients.teal}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Rivnitz Community</Text>
          <View style={styles.headerOrnamentRow}>
            <View style={styles.headerOrnamentLine} />
            <Text style={styles.headerOrnamentGlyph}>✦</Text>
            <View style={styles.headerOrnamentLine} />
          </View>
          <Text style={styles.headerSub}>SACRED GATHERING</Text>
        </LinearGradient>
      </Animated.View>

      {/* ── Feed ────────────────────────────────────────────── */}
      <Animated.View style={[{ flex: 1 }, feedStyle]}>
        <FlatList
          ref={flatListRef}
          data={combinedData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.teal]}
              tintColor={Colors.teal}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyGlyph}>✦</Text>
              <Text style={styles.emptyTitle}>The Gathering Begins With You</Text>
              <Text style={styles.emptyText}>Be the first to share a blessing or thought with the community.</Text>
            </View>
          }
          ListFooterComponent={
            posts.length > 0
              ? (
                <View style={styles.feedFooter}>
                  <View style={styles.feedFooterLine} />
                  <Text style={styles.feedFooterGlyph}>✦</Text>
                  <View style={styles.feedFooterLine} />
                </View>
              )
              : null
          }
        />
      </Animated.View>

      {/* ── Input Bar ───────────────────────────────────────── */}
      <View style={styles.inputBar}>
        {/* User avatar */}
        <View style={[styles.inputAvatar, { backgroundColor: avatarColor(user?.displayName || '').bg, borderColor: avatarColor(user?.displayName || '').text + '40' }]}>
          <Text style={[styles.inputAvatarText, { color: avatarColor(user?.displayName || '').text }]}>
            {getInitials(user?.displayName || '')}
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
          onPress={handlePost}
          disabled={!inputText.trim() || posting}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={(!inputText.trim() || posting) ? ['rgba(212,147,58,0.35)', 'rgba(212,147,58,0.35)'] : [Colors.gold, '#C47A25']}
            style={styles.sendBtn}
          >
            {posting
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.sendBtnText}>➤</Text>
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Replies Modal ───────────────────────────────────── */}
      <Modal
        visible={!!replyPost}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReplyPost(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Modal handle */}
          <View style={styles.modalHandle} />

          {/* Modal header */}
          <LinearGradient
            colors={Gradients.teal}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalHeader}
          >
            <TouchableOpacity onPress={() => setReplyPost(null)} style={styles.modalCloseBtn} activeOpacity={0.7}>
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {replies.length > 0 ? `${replies.length} Replies` : 'Replies'}
            </Text>
            <View style={{ width: 36 }} />
          </LinearGradient>

          {/* Original post context */}
          {replyPost && (
            <View style={styles.originalPostCard}>
              <View style={styles.originalAccent} />
              <View style={styles.originalInner}>
                <Text style={styles.originalAuthor}>{replyPost.authorName}</Text>
                <Text style={styles.originalContent}>{replyPost.content}</Text>
              </View>
            </View>
          )}

          {/* Ornamental divider */}
          <View style={styles.modalDividerRow}>
            <View style={styles.modalDividerLine} />
            <Text style={styles.modalDividerGlyph}>✦</Text>
            <View style={styles.modalDividerLine} />
          </View>

          {/* Replies list */}
          {replyLoading ? (
            <View style={styles.replyLoading}>
              <LoadingDots />
            </View>
          ) : (
            <FlatList
              ref={replyListRef}
              data={replies}
              renderItem={({ item }) => <ReplyItem item={item} />}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.repliesList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() =>
                replies.length > 0 && replyListRef.current?.scrollToEnd({ animated: true })
              }
              ListEmptyComponent={
                <View style={styles.replyEmpty}>
                  <Text style={styles.replyEmptyGlyph}>✦</Text>
                  <Text style={styles.replyEmptyText}>Start the conversation</Text>
                </View>
              }
            />
          )}

          {/* Reply input */}
          <View style={styles.replyInputBar}>
            <View style={[styles.inputAvatar, { backgroundColor: avatarColor(user?.displayName || '').bg, borderColor: avatarColor(user?.displayName || '').text + '40' }]}>
              <Text style={[styles.inputAvatarText, { color: avatarColor(user?.displayName || '').text }]}>
                {getInitials(user?.displayName || '')}
              </Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Write a reply..."
              placeholderTextColor={Colors.textMuted}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={500}
              autoFocus
            />
            <TouchableOpacity
              onPress={handleSendReply}
              disabled={!replyText.trim() || sendingReply}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={(!replyText.trim() || sendingReply) ? ['rgba(212,147,58,0.35)', 'rgba(212,147,58,0.35)'] : [Colors.gold, '#C47A25']}
                style={styles.sendBtn}
              >
                {sendingReply
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.sendBtnText}>➤</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delete Confirm Modal ─────────────────────────────── */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="Delete Post"
        message="Are you sure you want to delete this post? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── Error Toast ──────────────────────────────────────── */}
      <ErrorToast message={errorMsg} />

    </SafeAreaView>
  );
}

// ─── Main Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.cream },
  loadingContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.cream, gap: Spacing.md,
  },
  loadingText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.bodyMedium,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // ── Header ────────────────────────────────────────────────────────
  header: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md + 4,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontFamily: Typography.heading,
    fontSize: 30,
    color: Colors.white,
    letterSpacing: 0.5,
    lineHeight: 34,
  },
  headerOrnamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '55%',
    marginTop: 2,
  },
  headerOrnamentLine:  { flex: 1, height: 1, backgroundColor: 'rgba(212,147,58,0.45)' },
  headerOrnamentGlyph: { fontSize: 8, color: Colors.goldLight },
  headerSub: {
    fontSize: 8,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: Typography.bodyMedium,
  },

  // ── Feed ──────────────────────────────────────────────────────────
  feedContent: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },

  // ── Pinned Post ───────────────────────────────────────────────────
  pinnedCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(27,107,107,0.15)',
    ...Shadows.sm,
  },
  pinnedAccent: {
    width: 3,
    backgroundColor: Colors.teal,
  },
  pinnedInner: {
    flex: 1,
    padding: Spacing.md,
    gap: 6,
  },
  pinnedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinnedBadge: {
    backgroundColor: Colors.tealPale,
    borderRadius: Radius.sm,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  pinnedBadgeText: {
    fontSize: 8,
    color: Colors.teal,
    fontFamily: Typography.bodySemiBold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  pinnedMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
  },
  pinnedText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: 22,
    fontFamily: Typography.body,
    fontStyle: 'italic',
  },
  pinnedAuthor: {
    fontSize: Typography.sizes.xs,
    color: Colors.teal,
    fontFamily: Typography.bodySemiBold,
    letterSpacing: 0.3,
  },

  // ── Post Card ─────────────────────────────────────────────────────
  postCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.1)',
    ...Shadows.sm,
    gap: Spacing.sm,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, flexShrink: 0,
  },
  avatarText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.bodySemiBold,
  },
  postMeta:   { flex: 1, gap: 2 },
  postAuthor: {
    fontSize: Typography.sizes.sm,
    color: Colors.tealDark,
    fontFamily: Typography.heading,
    letterSpacing: 0.2,
  },
  postTime: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
  },
  deleteBtn:     { padding: 6 },
  deleteBtnText: { fontSize: 12, color: Colors.textMuted },

  postContent: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: 22,
    fontFamily: Typography.body,
  },

  // Actions
  postActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,147,58,0.1)',
  },
  actionBtn: {},
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: Radius.xl,
    backgroundColor: Colors.cream,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  actionPillLiked: {
    backgroundColor: Colors.goldPale,
    borderColor: 'rgba(212,147,58,0.3)',
  },
  actionHeart:      { fontSize: 13, color: Colors.textMuted },
  actionHeartLiked: { color: Colors.gold },
  actionReplyIcon:  { fontSize: 12, color: Colors.textMuted },
  actionCount:      { fontSize: Typography.sizes.xs, color: Colors.textMuted, fontFamily: Typography.bodyMedium },
  actionCountLiked: { color: Colors.gold },

  // ── Empty state ───────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing['3xl'],
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.sm,
  },
  emptyGlyph: { fontSize: 22, color: Colors.gold, marginBottom: 4 },
  emptyTitle: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes.xl,
    color: Colors.tealDark,
    textAlign: 'center',
    lineHeight: 28,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontFamily: Typography.body,
    textAlign: 'center',
    lineHeight: 20,
  },

  feedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  feedFooterLine:  { flex: 1, height: 1, backgroundColor: 'rgba(212,147,58,0.18)' },
  feedFooterGlyph: { fontSize: 9, color: Colors.gold },

  // ── Input Bar ─────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,147,58,0.12)',
  },
  inputAvatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, flexShrink: 0,
  },
  inputAvatarText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.bodySemiBold,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.cream,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontFamily: Typography.body,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.15)',
    maxHeight: 100,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.gold,
  },
  sendBtnText: { fontSize: 14, color: Colors.white },

  // ── Reply Modal ───────────────────────────────────────────────────
  modalContainer: { flex: 1, backgroundColor: Colors.cream },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  modalCloseBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
  },
  modalCloseBtnText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: Typography.bodySemiBold,
  },
  modalTitle: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes.xl,
    color: Colors.white,
    letterSpacing: 0.3,
  },

  // Original post preview inside modal
  originalPostCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    margin: Spacing.md,
    marginBottom: 0,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(27,107,107,0.12)',
  },
  originalAccent: { width: 3, backgroundColor: Colors.gold },
  originalInner:  { flex: 1, padding: Spacing.sm + 2, gap: 4 },
  originalAuthor: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.xs,
    color: Colors.teal,
    letterSpacing: 0.2,
  },
  originalContent: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
    fontFamily: Typography.body,
  },

  modalDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.md,
  },
  modalDividerLine:  { flex: 1, height: 1, backgroundColor: 'rgba(212,147,58,0.2)' },
  modalDividerGlyph: { fontSize: 8, color: Colors.gold },

  replyLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  repliesList:  { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.md },

  replyRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  replyAvatar: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, flexShrink: 0,
    marginTop: 2,
  },
  replyAvatarText: {
    fontSize: 10,
    fontFamily: Typography.bodySemiBold,
  },
  replyBubble: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.1)',
    gap: 4,
  },
  replyBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyAuthor: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes.xs,
    color: Colors.tealDark,
    letterSpacing: 0.2,
  },
  replyTime: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontFamily: Typography.body,
  },
  replyContent: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
    fontFamily: Typography.body,
  },

  replyEmpty: {
    alignItems: 'center',
    paddingTop: Spacing['2xl'],
    gap: Spacing.sm,
  },
  replyEmptyGlyph: { fontSize: 18, color: 'rgba(212,147,58,0.4)' },
  replyEmptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontFamily: Typography.body,
  },

  replyInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,147,58,0.12)',
  },
});

// ─── Confirm Modal Styles ─────────────────────────────────────────
const confirmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4,20,20,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    ...Shadows.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.15)',
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(224,92,92,0.08)',
    borderWidth: 1, borderColor: 'rgba(224,92,92,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  iconGlyph: { fontSize: 18, color: 'rgba(224,92,92,0.7)' },
  title: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes['2xl'],
    color: Colors.tealDark,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  actions:  { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.creamDark,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: Typography.bodyMedium,
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: 'rgba(224,92,92,0.08)',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.28)',
  },
  confirmText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: Typography.sizes.sm,
    color: Colors.error,
  },
});

// ─── Error Toast Styles ───────────────────────────────────────────
const toastStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 90,
    left: Spacing.xl,
    right: Spacing.xl,
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.tealDark,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,147,58,0.25)',
    ...Shadows.lg,
  },
  exclaim: {
    fontSize: 13,
    color: Colors.gold,
    fontFamily: Typography.bodySemiBold,
    width: 18,
    textAlign: 'center',
  },
  message: {
    fontFamily: Typography.body,
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.9)',
    flex: 1,
  },
});
