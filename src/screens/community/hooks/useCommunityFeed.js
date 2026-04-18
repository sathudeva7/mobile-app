import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  doc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '../../../services/firebase.client';
import { useAuthStore } from '../../../store/authStore';

export default function useCommunityFeed() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [replyPost, setReplyPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const replyListRef = useRef(null);
  const flatListRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const showError = useCallback((msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 3000);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.COMMUNITY),
      orderBy('createdAt', 'desc'),
      limit(51),
    );
    return onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPinned(all.filter((p) => p.pinned === true));
        setPosts(all.filter((p) => !p.pinned));
        setLoading(false);
      },
      (err) => {
        console.error('Community error:', err.code, err.message);
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    if (!replyPost) {
      setReplies([]);
      return;
    }
    setReplyLoading(true);
    const q = query(
      collection(db, COLLECTIONS.COMMUNITY, replyPost.id, 'replies'),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(
      q,
      (snap) => {
        setReplies(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setReplyLoading(false);
      },
      (err) => {
        console.error('Replies error:', err.code, err.message);
        setReplyLoading(false);
      },
    );
  }, [replyPost?.id]);

  const combinedData = useMemo(
    () => [
      ...pinned.map((p) => ({ ...p, _type: 'pinned' })),
      ...posts.map((p) => ({ ...p, _type: 'post' })),
    ],
    [pinned, posts],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const q = query(
        collection(db, COLLECTIONS.COMMUNITY),
        orderBy('createdAt', 'desc'),
        limit(51),
      );
      const snap = await getDocs(q);
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPinned(all.filter((p) => p.pinned === true));
      setPosts(all.filter((p) => !p.pinned));
    } catch (e) {
      console.warn('Refresh error:', e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handlePost = useCallback(async () => {
    const text = inputText.trim();
    if (!text || posting) return;
    setPosting(true);
    setInputText('');
    try {
      await addDoc(collection(db, COLLECTIONS.COMMUNITY), {
        content: text,
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        pinned: false,
        likes: [],
        replyCount: 0,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      showError('Could not post. Please try again.');
      setInputText(text);
    } finally {
      setPosting(false);
    }
  }, [inputText, posting, user, showError]);

  const handleLike = useCallback(
    async (post) => {
      const ref = doc(db, COLLECTIONS.COMMUNITY, post.id);
      const hasLiked = post.likes?.includes(user.uid);
      await updateDoc(ref, {
        likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    },
    [user?.uid],
  );

  const handleDeletePost = useCallback((post) => {
    setDeleteTarget(post);
  }, []);

  const confirmDelete = useCallback(async () => {
    const post = deleteTarget;
    setDeleteTarget(null);
    if (!post) return;
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
      await addDoc(collection(db, COLLECTIONS.COMMUNITY, replyPost.id, 'replies'), {
        content: text,
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        createdAt: serverTimestamp(),
      });
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

  return {
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
  };
}
