import { getMessaging, getToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { app } from './firebase';

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

let messaging: ReturnType<typeof getMessaging> | null = null;

function getMessagingInstance() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch (err) {
      console.error('FCM messaging unavailable:', err);
      return null;
    }
  }
  return messaging;
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && !!vapidKey;
}

export async function getFcmToken(): Promise<string | null> {
  const m = getMessagingInstance();
  if (!m || !vapidKey) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    return await getToken(m, { vapidKey });
  } catch (err) {
    console.error('Failed to get FCM token:', err);
    return null;
  }
}

export function onForegroundMessage(handler: (payload: MessagePayload) => void): (() => void) | null {
  const m = getMessagingInstance();
  if (!m) return null;
  return onMessage(m, handler);
}
