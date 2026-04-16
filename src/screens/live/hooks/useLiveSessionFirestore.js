import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '../../../services/firebase.client';

export function filterVisibleQueue(waitingRoom) {
  return waitingRoom.filter((m) => m.status !== 'left');
}

/**
 * Active live session + waiting room + derived queue fields for the current user.
 */
export default function useLiveSessionFirestore(uid) {
  const [session, setSession] = useState(null);
  const [waitingRoom, setWaitingRoom] = useState([]);
  const [myEntry, setMyEntry] = useState(null);
  const [inQueue, setInQueue] = useState(false);
  const [myPosition, setMyPosition] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, COLLECTIONS.LIVE_SESSIONS), where('status', '==', 'live'));
    return onSnapshot(q, (snap) => {
      setSession(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!session) {
      setWaitingRoom([]);
      setMyEntry(null);
      return;
    }
    const q = query(
      collection(db, COLLECTIONS.LIVE_SESSIONS, session.id, 'waitingRoom'),
      orderBy('joinedAt', 'asc'),
    );
    return onSnapshot(q, (snap) => {
      const members = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setWaitingRoom(members);
      const myIdx = members.findIndex((m) => m.userId === uid);
      const entry = myIdx !== -1 ? members[myIdx] : null;
      setMyEntry(entry);
      setInQueue(myIdx !== -1);
      setMyPosition(myIdx !== -1 ? myIdx + 1 : null);
    });
  }, [session?.id, uid]);

  const visibleQueue = useMemo(() => filterVisibleQueue(waitingRoom), [waitingRoom]);
  const visibleQueueCount = visibleQueue.length;

  return {
    session,
    loading,
    waitingRoom,
    visibleQueue,
    visibleQueueCount,
    myEntry,
    inQueue,
    myPosition,
  };
}
