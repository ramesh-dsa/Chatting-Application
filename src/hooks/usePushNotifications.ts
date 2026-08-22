import { useEffect, useRef, useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { getFcmToken, onForegroundMessage, isPushSupported } from '../lib/messaging';

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
    const userRef = ref(db, `users/${uid}`);

    (async () => {
      const token = await getFcmToken();
      if (cancelled || !token) return;
      tokenRef.current = token;
      await update(userRef, { [`fcmTokens/${token}`]: true }).catch(console.error);

      if (cancelled) return;
      unsubMessage = onForegroundMessage((payload) => {
        const title = payload.notification?.title || 'New message';
        const body = payload.notification?.body || '';
        setBanner({ title, body });
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), 5000);
      });
    })();

    return () => {
      cancelled = true;
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      unsubMessage?.();
      const t = tokenRef.current;
      if (t) {
        tokenRef.current = null;
        update(userRef, { [`fcmTokens/${t}`]: null }).catch(() => {});
      }
    };
  }, [uid]);

  const dismissBanner = () => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner(null);
  };

  return { banner, dismissBanner };
}