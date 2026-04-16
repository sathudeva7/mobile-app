import React from 'react';
import { View, Text } from 'react-native';

export const FeedEmpty = React.memo(function FeedEmpty({ styles }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyGlyph}>✦</Text>
      <Text style={styles.emptyTitle}>The Gathering Begins With You</Text>
      <Text style={styles.emptyText}>
        Be the first to share a blessing or thought with the community.
      </Text>
    </View>
  );
});

export const FeedFooter = React.memo(function FeedFooter({ styles }) {
  return (
    <View style={styles.feedFooter}>
      <View style={styles.feedFooterLine} />
      <Text style={styles.feedFooterGlyph}>✦</Text>
      <View style={styles.feedFooterLine} />
    </View>
  );
});

export const ReplyListEmpty = React.memo(function ReplyListEmpty({ styles }) {
  return (
    <View style={styles.replyEmpty}>
      <Text style={styles.replyEmptyGlyph}>✦</Text>
      <Text style={styles.replyEmptyText}>Start the conversation</Text>
    </View>
  );
});
