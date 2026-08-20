const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

const ATTACHMENT_LABELS = {
  image: '📷 Photo',
  video: '🎥 Video',
  voice: '🎤 Voice message',
  file: '📎 Attachment',
};

// Fires when a message is created in any conversation.
// Sends an FCM push to every participant (except the sender) via their stored fcmTokens.
exports.sendMessageNotification = onDocumentCreated(
  { document: 'conversations/{conversationId}/messages/{messageId}' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const message = snap.data();
    const conversationId = event.params.conversationId;

    const convoDoc = await db.doc(`conversations/${conversationId}`).get();
    if (!convoDoc.exists) return;

    const participants = convoDoc.data().participants || [];

    const tokens = [];
    await Promise.all(
      participants.map(async (uid) => {
        if (uid === message.senderId) return;
        const userDoc = await db.doc(`users/${uid}`).get();
        if (userDoc.exists) {
          tokens.push(...(userDoc.data().fcmTokens || []));
        }
      })
    );

    if (!tokens.length) return;

    const sender = message.senderName || 'Someone';
    const body = message.text
      || ATTACHMENT_LABELS[message.attachmentType]
      || 'New message';

    await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: sender, body },
      data: { conversationId, clickAction: '/' },
    });
  }
);