import React, { useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gradients } from '../../../theme';
import LoadingDots from './LoadingDots';
import ReplyItem from './ReplyItem';
import CommunityComposerBar from './CommunityComposerBar';
import { ReplyListEmpty } from './CommunityFeedExtras';

export default function ReplyThreadModal({
  visible,
  replyPost,
  onClose,
  replies,
  replyLoading,
  replyText,
  setReplyText,
  sendingReply,
  onSendReply,
  replyListRef,
  displayName,
  styles,
}) {
  const renderReply = useCallback(
    ({ item }) => <ReplyItem item={item} />,
    [],
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const onContentSizeChange = useCallback(() => {
    if (replies.length > 0) replyListRef.current?.scrollToEnd({ animated: true });
  }, [replies.length, replyListRef]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalHandle} />

        <LinearGradient
          colors={Gradients.teal}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.modalHeader}
        >
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} activeOpacity={0.7}>
            <Text style={styles.modalCloseBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {replies.length > 0 ? `${replies.length} Replies` : 'Replies'}
          </Text>
          <View style={styles.modalHeaderSpacer} />
        </LinearGradient>

        {replyPost && (
          <View style={styles.originalPostCard}>
            <View style={styles.originalAccent} />
            <View style={styles.originalInner}>
              <Text style={styles.originalAuthor}>{replyPost.authorName}</Text>
              <Text style={styles.originalContent}>{replyPost.content}</Text>
            </View>
          </View>
        )}

        <View style={styles.modalDividerRow}>
          <View style={styles.modalDividerLine} />
          <Text style={styles.modalDividerGlyph}>✦</Text>
          <View style={styles.modalDividerLine} />
        </View>

        {replyLoading ? (
          <View style={styles.replyLoading}>
            <LoadingDots />
          </View>
        ) : (
          <FlatList
            ref={replyListRef}
            data={replies}
            renderItem={renderReply}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.repliesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={onContentSizeChange}
            ListEmptyComponent={<ReplyListEmpty styles={styles} />}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={8}
            removeClippedSubviews={Platform.OS === 'android'}
          />
        )}

        <CommunityComposerBar
          styles={styles}
          barStyle={styles.replyInputBar}
          displayName={displayName}
          value={replyText}
          onChangeText={setReplyText}
          onSend={onSendReply}
          sending={sendingReply}
          placeholder="Write a reply..."
          autoFocus
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}
