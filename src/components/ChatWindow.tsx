import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, getDoc, increment, writeBatch } from 'firebase/firestore';
import { ref } from 'firebase/storage';
import { MoreVertical, Phone, Video, ArrowLeft, Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { db, storage } from '../lib/firebase';
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
  initialHighlightId?: string | null;
}

export default function ChatWindow({ conversationId, onBack, initialHighlightId }: ChatWindowProps) {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [participants, setParticipants] = useState<Record<string, UserProfile>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Search states
  const [isSearching, setIsSearching] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Clear toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Search logic
  useEffect(() => {
    if (!isSearching || !chatSearchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }
    const queryLower = chatSearchQuery.toLowerCase();
    const results = messages
      .filter(m => m.type !== 'system' && (m.text || '').toLowerCase().includes(queryLower))
      .map(m => m.id);
    
    setSearchResults(results);
    if (results.length > 0) {
      setCurrentSearchIndex(results.length - 1); // Start at most recent match
    } else {
      setCurrentSearchIndex(-1);
    }
  }, [chatSearchQuery, messages, isSearching]);

  // Jump to highlighted message
  useEffect(() => {
    if (currentSearchIndex >= 0 && searchResults[currentSearchIndex]) {
      const msgId = searchResults[currentSearchIndex];
      const el = document.getElementById(`msg-${msgId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(msgId);
        
        // Remove highlight after a delay
        const timer = setTimeout(() => {
          setHighlightedMessageId(prev => prev === msgId ? null : prev);
        }, 1500);
        return () => {
          clearTimeout(timer);
          setHighlightedMessageId(prev => prev === msgId ? null : prev);
        };
      }
    } else {
      setHighlightedMessageId(null);
    }
  }, [currentSearchIndex, searchResults]);

  // Handle external highlight request (from Sidebar search)
  useEffect(() => {
    if (initialHighlightId && messages.length > 0) {
      // Check if the message is actually loaded
      const msgExists = messages.some(m => m.id === initialHighlightId);
      if (msgExists) {
        const el = document.getElementById(`msg-${initialHighlightId}`);
        if (el) {
          // Delay scrolling slightly to ensure rendering is complete
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedMessageId(initialHighlightId);
            
            setTimeout(() => {
              setHighlightedMessageId(prev => prev === initialHighlightId ? null : prev);
            }, 1500);
          }, 100);
        }
      }
    }
  }, [initialHighlightId, messages.length]);

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

      // Handle Read Receipts (Mark all unread messages from others as read & delivered)
      if (userProfile && msgs.length > 0) {
        const unreadMsgs = msgs.filter(m => m.type !== 'system' && m.senderId !== userProfile.uid && !m.readBy.includes(userProfile.uid));
        
        if (unreadMsgs.length > 0) {
          const batch = writeBatch(db);
          unreadMsgs.forEach(m => {
            const msgRef = doc(db, `conversations/${conversationId}/messages`, m.id);
            const updatedReadBy = m.readBy.includes(userProfile.uid) ? m.readBy : [...m.readBy, userProfile.uid];
            const updatedDeliveredTo = m.deliveredTo?.includes(userProfile.uid) ? m.deliveredTo : [...(m.deliveredTo || []), userProfile.uid];
            
            batch.update(msgRef, {
              readBy: updatedReadBy,
              deliveredTo: updatedDeliveredTo
            });
          });
          
          // Also reset unread count for current user
          const convoRef = doc(db, 'conversations', conversationId);
          batch.update(convoRef, {
            [`unreadCounts.${userProfile.uid}`]: 0
          });
          
          batch.commit().catch(console.error);
        } else {
          // Check if any messages are just undelivered and mark them delivered
          const undeliveredMsgs = msgs.filter(m => m.type !== 'system' && m.senderId !== userProfile.uid && !m.deliveredTo?.includes(userProfile.uid));
          if (undeliveredMsgs.length > 0) {
            const batch = writeBatch(db);
            undeliveredMsgs.forEach(m => {
              const msgRef = doc(db, `conversations/${conversationId}/messages`, m.id);
              batch.update(msgRef, {
                deliveredTo: [...(m.deliveredTo || []), userProfile.uid]
              });
            });
            batch.commit().catch(console.error);
          }
        }
      }
    });

    return () => unsubMessages();
  }, [conversationId, userProfile]);

  const handleSendMessage = async (text: string, file?: File | null) => {
    if (!userProfile || !conversationId) return;

    try {
      let attachmentUrl = '';
      let attachmentType = '';
      let attachmentName = '';
      let attachmentSize = 0;

      if (file) {
        setUploadProgress(0);
        
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
        
        if (!cloudName || !uploadPreset) {
          throw new Error("Cloudinary configuration missing in .env.local");
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        
        // Use raw upload for documents, auto for images/videos
        const resourceType = file.type.startsWith('image/') || file.type.startsWith('video/') ? 'auto' : 'raw';
        const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', uploadUrl, true);
          
          let timeoutId = setTimeout(() => {
            if (xhr.readyState !== 4) {
              xhr.abort();
              reject(new Error("Upload timed out."));
            }
          }, 60000); // 60s timeout for file upload
          
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = (e.loaded / e.total) * 100;
              setUploadProgress(progress);
            }
          };

          xhr.onload = () => {
            clearTimeout(timeoutId);
            if (xhr.status === 200) {
              const response = JSON.parse(xhr.responseText);
              attachmentUrl = response.secure_url;
              resolve();
            } else {
              reject(new Error("Cloudinary upload failed: " + xhr.responseText));
            }
          };

          xhr.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error("Network error during Cloudinary upload"));
          };

          xhr.send(formData);
        });

        if (file.type.startsWith('image/')) attachmentType = 'image';
        else if (file.type.startsWith('video/')) attachmentType = 'video';
        else attachmentType = 'document';
        
        attachmentName = file.name;
        attachmentSize = file.size;
        setUploadProgress(null);
      }

      const msgData: any = {
        senderId: userProfile.uid,
        text: text.trim(),
        timestamp: Date.now(),
        readBy: [userProfile.uid],
        type: attachmentType ? attachmentType : 'text'
      };

      if (attachmentUrl) {
        msgData.attachmentUrl = attachmentUrl;
        msgData.attachmentType = attachmentType;
        msgData.attachmentName = attachmentName;
        msgData.attachmentSize = attachmentSize;
      }

      await addDoc(collection(db, `conversations/${conversationId}/messages`), msgData);

      // Prepare unread counts increment for other participants
      const unreadUpdates: Record<string, any> = {};
      if (conversation?.participants) {
        conversation.participants.forEach(uid => {
          if (uid !== userProfile.uid) {
            unreadUpdates[`unreadCounts.${uid}`] = increment(1);
          }
        });
      }

      // Update the conversation's last message and unread counts
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: attachmentType ? `[${attachmentType === 'image' ? 'Photo' : attachmentType === 'video' ? 'Video' : 'Document'}] ${text.trim()}` : text.trim(),
        lastMessageTimestamp: Date.now(),
        updatedAt: Date.now(),
        ...unreadUpdates
      });
    } catch (error: any) {
      setUploadProgress(null);
      setToastMessage(error.message || "Failed to send message/file");
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
          {isSearching ? (
            <div className="flex-1 flex items-center bg-background rounded-xl px-3 py-1 mr-4 border border-accent/20">
              <button 
                onClick={() => {
                  setIsSearching(false);
                  setChatSearchQuery('');
                }} 
                className="p-1 mr-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
              <input
                autoFocus
                type="text"
                placeholder="Search messages..."
                value={chatSearchQuery}
                onChange={e => setChatSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-sm py-1"
              />
              <div className="flex items-center space-x-1 ml-2 text-muted-foreground">
                <span className="text-xs mr-2">
                  {searchResults.length > 0 ? `${currentSearchIndex + 1} of ${searchResults.length}` : (chatSearchQuery.trim() ? '0 results' : '')}
                </span>
                <button 
                  disabled={searchResults.length === 0 || currentSearchIndex <= 0}
                  onClick={() => setCurrentSearchIndex(prev => prev - 1)}
                  className="p-1 hover:bg-surface rounded-md disabled:opacity-30"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button 
                  disabled={searchResults.length === 0 || currentSearchIndex >= searchResults.length - 1}
                  onClick={() => setCurrentSearchIndex(prev => prev + 1)}
                  className="p-1 hover:bg-surface rounded-md disabled:opacity-30"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
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
          )}

          {!isSearching && (
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
              <button 
                onClick={() => setIsSearching(true)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-surface transition-colors"
              >
                <Search className="w-5 h-5" />
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
          )}
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
                  participantCount={conversation.participants.length}
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
                isHighlighted={highlightedMessageId === msg.id}
                participantCount={conversation.participants.length}
              />
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <MessageInput onSendMessage={handleSendMessage} uploadProgress={uploadProgress} />
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
