/**
 * CommunityScreen — Sacred Gathering
 * All members can post, read, like, and reply.
 * Pinned posts from Rabbi shown at top.
 * Real-time updates via Firestore onSnapshot.
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Gradients } from '../../theme';
import useCommunityFeed from './hooks/useCommunityFeed';
import screenStyles from './communityScreen.styles';
import LoadingDots from './components/LoadingDots';
import ConfirmModal from './components/ConfirmModal';
import ErrorToast from './components/ErrorToast';
import PinnedPost from './components/PinnedPost';
import PostItem from './components/PostItem';
import ReplyThreadModal from './components/ReplyThreadModal';
import CommunityComposerBar from './components/CommunityComposerBar';
import { FeedEmpty, FeedFooter } from './components/CommunityFeedExtras';

const styles = screenStyles;

export default function CommunityScreen() {
  const {
    user,
    posts,
    combinedData,
    loading,
    refreshing,
    inputText,
    setInputText,
    posting,
    handleRefresh,
    handlePost,
    handleLike,
    handleDeletePost,
    confirmDelete,
    deleteTarget,
    setDeleteTarget,
    errorMsg,
    replyPost,
    setReplyPost,
    replies,
    replyLoading,
    replyText,
    setReplyText,
    sendingReply,
    handleSendReply,
    replyListRef,
    flatListRef,
  } = useCommunityFeed();

  const headerAnim = useRef(new Animated.Value(0)).current;
  const feedAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(feedAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [headerAnim, feedAnim]);

  const headerStyle = useMemo(
    () => ({
      opacity: headerAnim,
      transform: [
        { translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
      ],
    }),
    [headerAnim],
  );

  const feedStyle = useMemo(
    () => ({
      opacity: feedAnim,
      transform: [
        { translateY: feedAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
      ],
    }),
    [feedAnim],
  );

  const openReplyId = replyPost?.id;
  const liveReplyCount = replies.length;

  const renderItem = useCallback(
    ({ item }) => {
      if (item._type === 'pinned') {
        return <PinnedPost item={item} />;
      }
      const replyCount =
        openReplyId === item.id ? liveReplyCount : (item.replyCount ?? 0);
      return (
        <PostItem
          item={item}
          userId={user?.uid}
          replyCount={replyCount}
          onLike={handleLike}
          onDelete={handleDeletePost}
          onReply={setReplyPost}
        />
      );
    },
    [user?.uid, openReplyId, liveReplyCount, handleLike, handleDeletePost, setReplyPost],
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const listEmpty = useMemo(() => <FeedEmpty styles={styles} />, []);
  const listFooter = useMemo(
    () => (posts.length > 0 ? <FeedFooter styles={styles} /> : null),
    [posts.length],
  );

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
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
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={false}
        />
      </Animated.View>

      <CommunityComposerBar
        styles={styles}
        displayName={user?.displayName}
        value={inputText}
        onChangeText={setInputText}
        onSend={handlePost}
        sending={posting}
        placeholder="Share with the community..."
      />

      </KeyboardAvoidingView>

      <ReplyThreadModal
        visible={!!replyPost}
        replyPost={replyPost}
        onClose={() => setReplyPost(null)}
        replies={replies}
        replyLoading={replyLoading}
        replyText={replyText}
        setReplyText={setReplyText}
        sendingReply={sendingReply}
        onSendReply={handleSendReply}
        replyListRef={replyListRef}
        displayName={user?.displayName}
        styles={styles}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        title="Delete Post"
        message="Are you sure you want to delete this post? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ErrorToast message={errorMsg} />
    </SafeAreaView>
  );
}
