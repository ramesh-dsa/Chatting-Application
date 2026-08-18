import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { MoreVertical, Phone, Video, ArrowLeft } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Message, Conversation, UserProfile } from '../types';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import GroupInfoPanel from './GroupInfoPanel';
import { isToday, isYesterday, isSameYear, format, isSameDay } from 'date-fns';

function getDateSeparatorLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isSameYear(date, new Date())) return format(date, 'd MMMM'); // e.g. "16 August"
  return format(date, 'd MMMM yyyy'); // e.g. "16 August 2025"
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-4 sticky top-2 z-10">
      <span className="bg-surface shadow-sm text-muted-foreground text-xs font-medium px-3 py-1.5 rounded-lg border border-border">
        {label}
      </span>
    </div>
  );
}

interface ChatWindowProps {
  conversationId: string;
  onBack?: () => void;
}

export default function ChatWindow({ conversationId, onBack }: ChatWindowProps) {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [participants, setParticipants] = useState<Record<string, UserProfile>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // Clear toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Fetch conversation details and participants
  useEffect(() => {
    if (!conversationId) return;

    const unsubConvo = onSnapshot(doc(db, 'conversations', conversationId), async (snapshot) => {
      if (snapshot.exists()) {
        const convoData = snapshot.data() as Omit<Conversation, 'id'>;
        setConversation({ ...convoData, id: snapshot.id } as Conversation);

        // Fetch participant profiles (in a real app, you might want to cache this or use a cloud function)
        const participantProfiles: Record<string, UserProfile> = {};
        for (const uid of convoData.participants) {
          if (!participants[uid]) {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
              participantProfiles[uid] = userSnap.data() as UserProfile;
            }
          }
        }
        setParticipants(prev => ({ ...prev, ...participantProfiles }));
      }
    });

    return () => unsubConvo();
  }, [conversationId]);

  // Fetch messages
  useEffect(() => {
    if (!conversationId) return;

    const q = query(
      collection(db, `conversations/${conversationId}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubMessages = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((d) => {
        msgs.push({ id: d.id, ...d.data() } as Message);
      });
      setMessages(msgs);
      
      // Auto-scroll
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // Handle Read Receipts (MVP: just update the readBy array if our uid isn't in it)
      if (userProfile && msgs.length > 0) {
        const lastMsg = msgs.slice().reverse().find(m => m.type !== 'system');
        if (lastMsg && lastMsg.senderId !== userProfile.uid && !lastMsg.readBy.includes(userProfile.uid)) {
          updateDoc(doc(db, `conversations/${conversationId}/messages`, lastMsg.id), {
            readBy: [...lastMsg.readBy, userProfile.uid]
          }).catch(console.error);
        }
      }
    });

    return () => unsubMessages();
  }, [conversationId, userProfile]);

  const handleSendMessage = async (text: string) => {
    if (!userProfile || !conversationId) return;

    try {
      const msgData = {
        senderId: userProfile.uid,
        text: text.trim(),
        timestamp: Date.now(),
        readBy: [userProfile.uid],
        type: 'text'
      };

      await addDoc(collection(db, `conversations/${conversationId}/messages`), msgData);

      // Update the conversation's last message
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: text.trim(),
        lastMessageTimestamp: Date.now(),
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Derive Chat Title and Status
  let chatTitle = conversation.groupName || 'Group Chat';
  let chatStatus = `${conversation.participants.length} members`;
  let chatAvatar = conversation.groupPhoto || '';

  if (conversation.type === 'direct') {
    const otherUid = conversation.participants.find(uid => uid !== userProfile?.uid);
    const otherUser = otherUid ? participants[otherUid] : null;
    chatTitle = otherUser?.displayName || 'User';
    chatStatus = otherUser?.isOnline ? 'Online' : (otherUser?.lastSeen ? 'Offline' : '');
    chatAvatar = otherUser?.photoURL || 'https://api.dicebear.com/7.x/initials/svg?seed=U';
  }

  return (
    <div className="flex-1 flex w-full h-full relative overflow-hidden">
      <div className="flex-1 flex flex-col w-full h-full bg-chat-bg relative">
        {/* Header */}
        <div className="h-16 border-b border-border bg-surface flex-shrink-0 flex items-center justify-between px-4 sm:px-6 z-10">
          <div className="flex items-center space-x-3 sm:space-x-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-surface transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={() => conversation.type === 'group' && setShowGroupInfo(true)}
            className={`flex items-center space-x-3 text-left ${conversation.type === 'group' ? 'cursor-pointer hover:bg-background rounded-lg p-1 -m-1 transition-colors' : ''}`}
          >
            <div className="relative">
              {chatAvatar ? (
                <img src={chatAvatar} alt={chatTitle} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold">
                  {chatTitle.charAt(0)}
                </div>
              )}
              {conversation.type === 'direct' && chatStatus === 'Online' && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent border-2 border-surface rounded-full"></div>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{chatTitle}</h2>
              <p className="text-xs text-muted-foreground">{chatStatus}</p>
            </div>
          </button>
        </div>
        <div className="flex items-center space-x-2 relative">
          <button 
            onClick={() => setToastMessage("Voice calling isn't available yet")}
            className="p-2 text-muted-foreground opacity-60 cursor-not-allowed hover:bg-surface rounded-full transition-colors"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setToastMessage("Video calling isn't available yet")}
            className="p-2 text-muted-foreground opacity-60 cursor-not-allowed hover:bg-surface rounded-full transition-colors"
          >
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-surface transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
          
          {/* Simple Toast */}
          {toastMessage && (
            <div className="absolute top-full right-0 mt-2 whitespace-nowrap bg-surface border border-border shadow-lg rounded-lg px-4 py-2 text-sm text-foreground animate-in slide-in-from-top-2 fade-in z-50">
              {toastMessage}
            </div>
          )}
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 w-full overflow-y-auto p-6 scroll-smooth relative">
        {messages.map((msg, index) => {
          const currentDate = new Date(msg.timestamp);
          const previousDate = index > 0 ? new Date(messages[index - 1].timestamp) : null;
          const showDateSeparator = !previousDate || !isSameDay(currentDate, previousDate);

          const dateSeparatorElement = showDateSeparator ? (
            <DateSeparator key={`date-${msg.id}`} label={getDateSeparatorLabel(currentDate)} />
          ) : null;

          if (msg.type === 'system') {
            return (
              <React.Fragment key={msg.id}>
                {dateSeparatorElement}
                <MessageBubble 
                  message={msg} 
                  isOwnMessage={false} 
                  isFirstInGroup={false}
                  isLastInGroup={false}
                  isGroupChat={conversation.type === 'group'}
                />
              </React.Fragment>
            );
          }

          const isOwn = msg.senderId === userProfile?.uid;
          
          let prevMsg;
          for (let i = index - 1; i >= 0; i--) {
            if (messages[i].type !== 'system') { prevMsg = messages[i]; break; }
          }
          let nextMsg;
          for (let i = index + 1; i < messages.length; i++) {
            if (messages[i].type !== 'system') { nextMsg = messages[i]; break; }
          }
          
          const isFirstInGroup = !prevMsg || 
            prevMsg.senderId !== msg.senderId || 
            (msg.timestamp - prevMsg.timestamp) > 5 * 60 * 1000 ||
            !isSameDay(msg.timestamp, prevMsg.timestamp);

          const isLastInGroup = !nextMsg || 
            nextMsg.senderId !== msg.senderId || 
            (nextMsg.timestamp - msg.timestamp) > 5 * 60 * 1000 ||
            !isSameDay(msg.timestamp, nextMsg.timestamp);

          return (
            <React.Fragment key={msg.id}>
              {dateSeparatorElement}
              <MessageBubble 
                message={msg} 
                isOwnMessage={isOwn} 
                senderProfile={participants[msg.senderId]}
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={isLastInGroup}
                isGroupChat={conversation.type === 'group'}
              />
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <MessageInput onSendMessage={handleSendMessage} />
    </div>

    {/* Group Info Panel */}
    {showGroupInfo && conversation.type === 'group' && (
      <GroupInfoPanel 
        conversation={conversation}
        participants={participants}
        onClose={() => setShowGroupInfo(false)}
        onLeave={() => {
          setShowGroupInfo(false);
          if (onBack) onBack();
        }}
      />
    )}
    </div>
  );
}
