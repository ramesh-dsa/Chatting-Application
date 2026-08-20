importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js');

// __FIREBASE_CONFIG__ is replaced at build time by vite.config.ts (inject-fcm-sw plugin)
firebase.initializeApp(__FIREBASE_CONFIG__);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || 'New message', {
    body: notification.body || '',
    icon: notification.icon || '/favicon.svg',
    badge: '/favicon.svg',
    data: payload.data || {}
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      return clients.openWindow('/');
    })
  );
});