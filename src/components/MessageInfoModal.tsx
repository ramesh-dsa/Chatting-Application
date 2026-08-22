import { useEffect, useState } from 'react';
import { X, CheckCheck, Check, Clock } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { format } from 'date-fns';
import { db } from '../lib/firebase';
import type { Message, UserProfile } from '../types';
import { Avatar } from './ui/Avatar';

interface MessageInfoModalProps {
  messageId: string;
  conversationId: string;
  usersMap: Record<string, UserProfile>;
  participants: string[];
  currentUserId: string;
  onClose: () => void;
}

export default function MessageInfoModal({
  messageId,
  conversationId,
  usersMap,
  participants,
  currentUserId,
  onClose
}: MessageInfoModalProps) {
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    const msgRef = ref(db, `conversations/${conversationId}/messages/${messageId}`);
    const unsubscribe = onValue(msgRef, (snap) => {
      if (snap.exists()) {
        setMessage({ id: snap.key, ...snap.val() } as Message);
      } else {
        onClose(); // Message deleted
      }
    });
    return () => unsubscribe();
  }, [conversationId, messageId, onClose]);

  if (!message) return null;

  // Filter out the current user (sender)
  const otherParticipants = participants.filter(id => id !== currentUserId);

  const getReadInfo = (uid: string) => {
    if (!message.readBy) return null;
    if (Array.isArray(message.readBy)) {
      return message.readBy.find((r: any) => typeof r === 'string' ? r === uid : r.uid === uid);
    }
    if (typeof message.readBy === 'object' && uid in message.readBy) {
      return { uid, timestamp: (message.readBy as any)[uid] };
    }
    return null;
  };

  const getDeliveredInfo = (uid: string) => {
    if (!message.deliveredTo) return null;
    if (Array.isArray(message.deliveredTo)) {
      return message.deliveredTo.find((d: any) => typeof d === 'string' ? d === uid : d.uid === uid);
    }
    if (typeof message.deliveredTo === 'object' && uid in message.deliveredTo) {
      return { uid, timestamp: (message.deliveredTo as any)[uid] };
    }
    return null;
  };

  const readUsers = otherParticipants.filter(uid => getReadInfo(uid));
  const deliveredUsers = otherParticipants.filter(uid => !getReadInfo(uid) && getDeliveredInfo(uid));
  const sentUsers = otherParticipants.filter(uid => !getReadInfo(uid) && !getDeliveredInfo(uid));

  const renderUserList = (uids: string[], status: 'read' | 'delivered' | 'sent') => {
    if (uids.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 px-4 mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {status === 'read' && <CheckCheck className="w-4 h-4 text-blue-500" />}
          {status === 'delivered' && <CheckCheck className="w-4 h-4 text-muted-foreground" />}
          {status === 'sent' && <Check className="w-4 h-4 text-muted-foreground" />}
          <span>
            {status === 'read' ? 'Read by' : status === 'delivered' ? 'Delivered to' : 'Sent to'}
          </span>
        </div>
        <ul className="space-y-1">
          {uids.map(uid => {
            const user = usersMap[uid];
            if (!user) return null;
            
            let timeStr = 'Status unavailable';
            if (status === 'read') {
              const info = getReadInfo(uid);
              if (info && typeof info === 'object' && info.timestamp) {
                timeStr = format(info.timestamp, 'MMM d, h:mm a');
              }
            } else if (status === 'delivered') {
              const info = getDeliveredInfo(uid);
              if (info && typeof info === 'object' && info.timestamp) {
                timeStr = format(info.timestamp, 'MMM d, h:mm a');
              }
            } else {
              timeStr = format(message.timestamp, 'MMM d, h:mm a'); // Sent time
            }

            return (
              <li key={uid} className="flex items-center justify-between px-4 py-2 hover:bg-surface transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar src={user.photoURL} alt={user.displayName} className="w-10 h-10" />
                  <span className="font-medium text-foreground">{user.displayName}</span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeStr}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-bg-app w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface">
          <h2 className="text-lg font-bold text-foreground">Message Info</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-hover text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Preview */}
        <div className="p-4 border-b border-border bg-black/5">
          <div className="px-[9px] pt-[6px] pb-[8px] bg-bg-msg-sent text-foreground rounded-2xl rounded-tr-sm self-end inline-block max-w-[85%] relative shadow-sm">
            {message.type === 'text' && message.text && (
              <p className="text-[14.2px] whitespace-pre-wrap break-words leading-[19px]">
                {message.text}
              </p>
            )}
            {message.type === 'image' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="opacity-80">📷 Image</span>
              </div>
            )}
            {message.type === 'video' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="opacity-80">🎥 Video</span>
              </div>
            )}
            {message.type === 'voice' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="opacity-80">🎤 Voice message</span>
              </div>
            )}
            {message.type === 'document' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="opacity-80">📄 Document</span>
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-2 px-1">
            Sent • {format(message.timestamp, 'MMM d, h:mm a')}
          </div>
        </div>

        {/* Receipts List */}
        <div className="flex-1 overflow-y-auto py-4 bg-bg-app">
          {renderUserList(readUsers, 'read')}
          {renderUserList(deliveredUsers, 'delivered')}
          {renderUserList(sentUsers, 'sent')}
        </div>
      </div>
    </div>
  );
}
