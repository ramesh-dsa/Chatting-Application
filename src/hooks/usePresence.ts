import { useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export const usePresence = () => {
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;

    const userRef = doc(db, 'users', currentUser.uid);

    const updatePresence = async (isOnline: boolean) => {
      try {
        await updateDoc(userRef, {
          isOnline,
          lastSeen: Date.now()
        });
      } catch (error) {
        console.error('Failed to update presence:', error);
      }
    };

    // Periodic heartbeat to keep presence fresh
    const interval = setInterval(() => {
      if (!document.hidden) {
        updatePresence(true);
      }
    }, HEARTBEAT_INTERVAL);

    // Handle visibility changes (switching tabs)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // We consider them offline if they hide the tab, or we can just let it timeout
        // For a tighter presence, we'll mark them offline when the tab is hidden
        updatePresence(false);
      } else {
        updatePresence(true);
      }
    };

    // Handle window closing
    const handleBeforeUnload = () => {
      updatePresence(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Set online immediately when the hook mounts
    updatePresence(true);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Try to set offline on unmount (note: async calls in unmount aren't guaranteed to finish)
      updatePresence(false);
    };
  }, [currentUser]);
};
