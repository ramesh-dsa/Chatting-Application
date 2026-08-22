import { useEffect } from 'react';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export const usePresence = () => {
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;

    const userStatusRef = ref(db, `users/${currentUser.uid}`);
    const connectedRef = ref(db, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // We're connected (or reconnected)! Set up our disconnect operations
        
        // When I disconnect, update the last time I was seen online
        onDisconnect(userStatusRef).update({
          isOnline: false,
          lastSeen: serverTimestamp()
        }).then(() => {
          // The onDisconnect operation has been queued on the server
          // Now set our status to online
          set(ref(db, `users/${currentUser.uid}/isOnline`), true);
          set(ref(db, `users/${currentUser.uid}/lastSeen`), serverTimestamp());
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);
};
