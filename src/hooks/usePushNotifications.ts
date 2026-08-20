import { useEffect, useRef, useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { getFcmToken, onForegroundMessage, onTokenRefresh, isPushSupported } from '../lib/messaging';

interface BannerState {
  title: string;
  body: string;
}

export function usePushNotifications() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [banner, setBanner] = useState<BannerState | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!uid || !isPushSupported()) return;
    let cancelled = false;
    let unsubMessage: (() => void) | null = null;
    let unsubRefresh: (() => void) | null = null;
    const userRef = doc(db, 'users', uid);

    (async () => {
      const token = await getFcmToken();
      if (cancelled || !token) return;
      tokenRef.current = token;
      await updateDoc(userRef, { fcmTokens: arrayUnion(token) }).catch(console.error);

      if (cancelled) return;
      unsubMessage = onForegroundMessage((payload) => {
        const title = payload.notification?.title || 'New message';
        const body = payload.notification?.body || '';
        setBanner({ title, body });
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), 5000);
      });

      unsubRefresh = onTokenRefresh(async (newToken) => {
        if (cancelled) return;
        await updateDoc(userRef, { fcmTokens: arrayRemove(token), fcmTokens: arrayUnion(newToken) }).catch(console.error);
        tokenRef.current = newToken;
      });
    })();

    return () => {
      cancelled = true;
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      unsubMessage?.();
      unsubRefresh?.();
      const t = tokenRef.current;
      if (t) {
        tokenRef.current = null;
        updateDoc(userRef, { fcmTokens: arrayRemove(t) }).catch(() => {});
      }
    };
  }, [uid]);

  const dismissBanner = () => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner(null);
  };

  return { banner, dismissBanner };
}