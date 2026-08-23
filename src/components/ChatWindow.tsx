import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue,update, push, query, orderByChild, limitToLast, serverTimestamp, increment } from 'firebase/database';
import { MoreVertical, Phone, Video, ArrowLeft, Search, ChevronUp, ChevronDown, X, Forward, CheckSquare, Image as ImageIcon, Trash2, Star, Download, MessageSquare } from 'lucide-react';
import MessageInfoModal from "./MessageInfoModal";
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import type { Message, Conversation, UserProfile, PollData } from '../types';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import GroupInfoPanel from './GroupInfoPanel';
import ForwardModal from './ForwardModal';
import MediaGalleryModal from './MediaGalleryModal';
import ImagePreviewModal from './ImagePreviewModal';
import { Avatar } from './ui/Avatar';
import { copyImageToClipboard } from '../lib/clipboard';
import { isToday, isYesterday, isSameYear, format, isSameDay } from 'date-fns';
import { formatLastSeen } from '../utils/formatLastSeen';

function getDateSeparatorLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isSameYear(date, new Date())) return format(date, 'd MMMM'); // e.g. "16 August"
  return format(date, 'd MMMM yyyy'); // e.g. "16 August 2025"
}

const DateSeparator = React.memo(function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-4 sticky top-2 z-10">
      <span className="bg-[#e9eff3] shadow-sm text-[#5b6b73] text-xs font-medium px-3 py-1.5 rounded-lg">
        {label}
      </span>
    </div>
  );
});

interface ChatWindowProps {
  conversationId: string;
  onBack?: () => void;
  initialHighlightId?: string | null;
  usersMap: Record<string, UserProfile>;
}

export default function ChatWindow({ conversationId, onBack, initialHighlightId, usersMap }: ChatWindowProps) {
  const { currentUser } = useAuth();
  const { initiateCall } = useCall();
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleBackOnAccessError = () => {
    if (navTimerRef.current) return;
    setToastMessage("You no longer have access to this conversation");
    navTimerRef.current = setTimeout(() => {
      navTimerRef.current = null;
      onBackRef.current?.();
    }, 1500);
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver refs for read receipts
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleUnreadMsgIds = useRef<Set<string>>(new Set());
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [messageLimit, setMessageLimit] = useState(50);
  const isFetchingOlderRef = useRef(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);

  const hasInitiallyScrolledRef = useRef(false);
  const [unreadScrollCount, setUnreadScrollCount] = useState(0);
  const lastScrollHeightRef = useRef<number>(0);
  const lastMessageCountRef = useRef<number>(0);

  const isNearBottom = useCallback(() => {
    if (!scrollContainerRef.current) return false;
    const container = scrollContainerRef.current;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 150;
  }, []);

  useEffect(() => {
    if (!messagesLoaded || messages.length === 0) return;

    if (isFetchingOlderRef.current) {
      // Pagination logic: maintain scroll position
      if (scrollContainerRef.current && lastScrollHeightRef.current > 0) {
        const container = scrollContainerRef.current;
        container.scrollTop += (container.scrollHeight - lastScrollHeightRef.current);
      }
      isFetchingOlderRef.current = false;
    } else {
      // New messages logic
      const isInitialLoad = !hasInitiallyScrolledRef.current;
      const countDiff = messages.length - lastMessageCountRef.current;
      
      if (isInitialLoad) {
        hasInitiallyScrolledRef.current = true;
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      } else if (countDiff > 0) {
        const latestMessage = messages[messages.length - 1];
        const isOwnMessage = latestMessage?.senderId === currentUser?.uid;
        
        if (isOwnMessage || isNearBottom()) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          if (!isOwnMessage) {
            setUnreadScrollCount(0);
          }
        } else {
          // User is scrolled up and received new messages
          setUnreadScrollCount(prev => prev + countDiff);
        }
      }
    }
    
    lastMessageCountRef.current = messages.length;
  }, [messages, messagesLoaded, currentUser?.uid, isNearBottom]);
  
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; senderName: string; timestamp: number; name: string } | null>(null);

  // Search states
  const [isSearching, setIsSearching] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Forward state
  const [forwardSelectionMode, setForwardSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleBulkDelete = useCallback(async (mode: 'me' | 'everyone') => {
    if (!currentUser) return;
    const updates: Record<string, any> = {};
    selectedMessageIds.forEach(id => {
      if (mode === 'everyone') {
        updates[`conversations/${conversationId}/messages/${id}/deletedForEveryone`] = true;
        updates[`conversations/${conversationId}/messages/${id}/text`] = '';
        updates[`conversations/${conversationId}/messages/${id}/attachmentUrl`] = '';
        updates[`conversations/${conversationId}/messages/${id}/attachmentType`] = '';
        updates[`conversations/${conversationId}/messages/${id}/attachmentName`] = '';
      } else {
        updates[`conversations/${conversationId}/messages/${id}/deletedFor/${currentUser.uid}`] = true;
      }
    });
    try {
      await update(ref(db), updates);
      setForwardSelectionMode(false);
      setSelectedMessageIds(new Set());
      setShowDeleteConfirm(false);
      setToastMessage(`Deleted ${selectedMessageIds.size} messages`);
    } catch (err) {
      console.error("Bulk delete failed:", err);
      setToastMessage("Failed to delete messages");
    }
  }, [currentUser, conversationId, selectedMessageIds]);

  const handleBulkStar = useCallback(async () => {
    if (!currentUser) return;
    const updates: Record<string, any> = {};
    let starredCount = 0;
    let unstarredCount = 0;
    
    // First, determine the action. If ALL are starred, unstar all. Otherwise, star all.
    const selectedMsgs = messages.filter(m => selectedMessageIds.has(m.id));
    const allStarred = selectedMsgs.every(m => m.starredBy && Object.keys(m.starredBy).includes(currentUser.uid));
    
    selectedMessageIds.forEach(id => {
      if (allStarred) {
        updates[`conversations/${conversationId}/messages/${id}/starredBy/${currentUser.uid}`] = null;
        unstarredCount++;
      } else {
        updates[`conversations/${conversationId}/messages/${id}/starredBy/${currentUser.uid}`] = true;
        starredCount++;
      }
    });
    try {
      await update(ref(db), updates);
      setForwardSelectionMode(false);
      setSelectedMessageIds(new Set());
      setToastMessage(allStarred ? `Unstarred ${unstarredCount} messages` : `Starred ${starredCount} messages`);
    } catch (err) {
      console.error("Bulk star failed:", err);
      setToastMessage("Failed to star messages");
    }
  }, [currentUser, conversationId, selectedMessageIds, messages]);

  const handleBulkDownload = useCallback(async () => {
    const selectedMsgs = messages.filter(m => selectedMessageIds.has(m.id));
    
    const mediaMsgs = selectedMsgs.filter(m => m.attachmentUrl);
    const textMsgs = selectedMsgs.filter(m => !m.attachmentUrl && m.text);
    
    let downloadedCount = 0;
    
    for (const msg of mediaMsgs) {
      try {
        const response = await fetch(msg.attachmentUrl!);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = msg.attachmentName || `download-${msg.id}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        downloadedCount++;
      } catch (err) {
        console.error("Failed to download media:", err);
      }
    }
    
    if (textMsgs.length > 0) {
      try {
        const textContent = textMsgs.map(m => `[${new Date(m.timestamp).toLocaleString()}] ${usersMap[m.senderId || '']?.displayName || 'Unknown'}: ${m.text}`).join('\n\n');
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `chat-export-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        downloadedCount++;
      } catch (err) {
        console.error("Failed to download text:", err);
      }
    }
    
    if (downloadedCount > 0) {
      setForwardSelectionMode(false);
      setSelectedMessageIds(new Set());
      setToastMessage("Download started");
    } else {
      setToastMessage("Nothing to download");
    }
  }, [messages, selectedMessageIds, usersMap]);

  const handleCopyClick = useCallback(async (message: Message) => {
    try {
      if (message.type === 'text') {
        await navigator.clipboard.writeText(message.text || '');
        setToastMessage('Copied to clipboard');
      } else if (message.type === 'image') {
        if (!message.attachmentUrl) throw new Error('No image URL');
        await copyImageToClipboard(message.attachmentUrl);
        setToastMessage('Copied to clipboard');
      } else {
        // Fallback for video/document
        if (message.text) {
          await navigator.clipboard.writeText(message.text);
          setToastMessage('Copied to clipboard');
        } else if (message.attachmentUrl) {
          await navigator.clipboard.writeText(message.attachmentUrl);
          setToastMessage('Copied to clipboard');
        }
      }
    } catch (error) {
      console.error('Copy failed:', error);
      setToastMessage('Failed to copy');
    }
  }, []);

  const handleForwardClick = useCallback((message: Message) => {
    setForwardSelectionMode(true);
    setSelectedMessageIds(new Set([message.id]));
  }, []);

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [infoMessageId, setInfoMessageId] = useState<string | null>(null);
  const [, setTypingTick] = useState(0);
  const [showMediaGallery, setShowMediaGallery] = useState(false);

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    try {
      const updates: Record<string, any> = {};
      const alreadyReactedToThis = (msg.reactions?.[emoji] || []).includes(currentUser.uid);

      // Remove from all emojis first to enforce one reaction per user
      if (msg.reactions) {
        Object.keys(msg.reactions).forEach(e => {
          if (msg.reactions![e].includes(currentUser.uid)) {
            updates[`conversations/${conversationId}/messages/${messageId}/reactions/${e}/${currentUser.uid}`] = null;
          }
        });
      }

      // If they clicked a new emoji (or one they hadn't selected), add it
      if (!alreadyReactedToThis) {
        updates[`conversations/${conversationId}/messages/${messageId}/reactions/${emoji}/${currentUser.uid}`] = true;
      }

      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
      }
    } catch (err) {
      console.error("Failed to update reaction:", err);
    }
  }, [currentUser, conversationId, messages]);

  const handleReply = useCallback((message: Message) => {
    setReplyingTo(message);
  }, []);

  const handleEditMessage = useCallback(async (messageId: string, newText: string) => {
    if (!currentUser) return;
    const trimmed = newText.trim();
    if (!trimmed) return;
    try {
      await update(ref(db, `conversations/${conversationId}/messages/${messageId}`), { text: trimmed, edited: true, editedAt: Date.now() });
    } catch (err) {
      console.error("Failed to edit message:", err);
    }
  }, [currentUser, conversationId]);

  const handleDeleteMessage = useCallback(async (messageId: string, mode: 'me' | 'everyone') => {
    if (!currentUser) return;
    try {
      if (mode === 'everyone') {
        await update(ref(db, `conversations/${conversationId}/messages/${messageId}`), {
          deletedForEveryone: true,
          text: '',
          attachmentUrl: '',
          attachmentType: '',
          attachmentName: ''
        });
      } else {
        await update(ref(db, `conversations/${conversationId}/messages/${messageId}/deletedFor`), {
          [currentUser.uid]: true
        });
      }
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  }, [currentUser, conversationId]);

  const handleTyping = useCallback(() => {
    if (!currentUser || !conversationId) return;
    update(ref(db, `conversations/${conversationId}/typing`), {
      [currentUser.uid]: Date.now()
    }).catch(console.error);
  }, [currentUser, conversationId]);

  const handleStopTyping = useCallback(() => {
    if (!currentUser || !conversationId) return;
    update(ref(db, `conversations/${conversationId}/typing`), {
      [currentUser.uid]: null
    }).catch(console.error);
  }, [currentUser, conversationId]);

  useEffect(() => {
    setReplyingTo(null);
  }, [conversationId]);

  // Re-evaluate the typing indicator's 3s expiry even without new snapshots
  useEffect(() => {
    if (!conversation?.typing) return;
    const id = setInterval(() => setTypingTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, [conversation?.typing]);

  const handleToggleSelect = useCallback((messageId: string) => {
    setSelectedMessageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
        if (newSet.size === 0) setForwardSelectionMode(false);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  const handleSelectModeClick = useCallback((msg: Message) => {
    setSelectedMessageIds(new Set([msg.id]));
    setForwardSelectionMode(true);
  }, []);

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

  // Fetch conversation details
  useEffect(() => {
    if (!conversationId) return;

    const unsubConvo = onValue(ref(db, `conversations/${conversationId}`), (snapshot) => {
      if (snapshot.exists()) {
        const convoData = snapshot.val() as Omit<Conversation, 'id'>;
        setConversation({ ...convoData, id: snapshot.key } as Conversation);
      }
    }, (error) => {
      console.error("Conversation listener error:", error);
      scheduleBackOnAccessError();
    });

    return () => {
      unsubConvo();
      if (navTimerRef.current) {
        clearTimeout(navTimerRef.current);
        navTimerRef.current = null;
      }
    };
  }, [conversationId]);

  // Reset loaded state when conversation changes
  useEffect(() => {
    setMessagesLoaded(false);
    hasInitiallyScrolledRef.current = false;
    setUnreadScrollCount(0);
    lastMessageCountRef.current = 0;
    lastScrollHeightRef.current = 0;
  }, [conversationId]);

  // Read receipt intersection observer setup
  useEffect(() => {
    if (!currentUser || !conversationId || !scrollContainerRef.current) return;

    const handleReadBatch = () => {
      if (visibleUnreadMsgIds.current.size === 0) return;
      
      const updates: Record<string, any> = {};
      visibleUnreadMsgIds.current.forEach(id => {
        updates[`conversations/${conversationId}/messages/${id}/readBy/${currentUser.uid}`] = true;
      });
      
      update(ref(db), updates).catch(console.error);
      visibleUnreadMsgIds.current.clear();
    };

    observerRef.current = new IntersectionObserver((entries) => {
      let hasNewRead = false;
      
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          const msgId = entry.target.getAttribute('data-message-id');
          const isUnread = entry.target.getAttribute('data-is-unread') === 'true';
          
          if (msgId && isUnread) {
            visibleUnreadMsgIds.current.add(msgId);
            hasNewRead = true;
            observerRef.current?.unobserve(entry.target);
            // Optimistically update DOM attribute to prevent re-triggering before React re-renders
            entry.target.setAttribute('data-is-unread', 'false');
          }
        }
      });
      
      if (hasNewRead) {
        if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = setTimeout(handleReadBatch, 300);
      }
    }, {
      root: scrollContainerRef.current,
      threshold: 0.5
    });

    return () => {
      observerRef.current?.disconnect();
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
      handleReadBatch(); // flush any pending writes on unmount
    };
  }, [currentUser, conversationId]);

  // Observe newly added message elements when messages update
  useEffect(() => {
    if (!observerRef.current || !scrollContainerRef.current) return;
    
    // Select all unread messages
    const unreadElements = scrollContainerRef.current.querySelectorAll('[data-is-unread="true"]');
    unreadElements.forEach(el => observerRef.current?.observe(el));
  }, [messages]);

  // Fetch messages
  useEffect(() => {
    if (!conversationId) return;

    const q = query(
      ref(db, `conversations/${conversationId}/messages`),
      orderByChild('timestamp'),
      limitToLast(messageLimit)
    );

    const unsubMessages = onValue(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((childSnapshot) => {
        const d = childSnapshot.val();
        
        // Robust mapper for mixed RTDB arrays/objects
        const mapToUids = (data: any): string[] => {
          if (!data) return [];
          if (Array.isArray(data)) {
            return data.map(item => {
              if (typeof item === 'string') return item;
              if (item && typeof item === 'object' && item.uid) return item.uid;
              return '';
            }).filter(Boolean);
          }
          if (typeof data === 'object') {
            return Object.keys(data).reduce((acc: string[], key) => {
              const val = data[key];
              if (val === true) acc.push(key);
              else if (typeof val === 'string') acc.push(val);
              else if (val && typeof val === 'object' && val.uid) acc.push(val.uid);
              return acc;
            }, []);
          }
          return [];
        };

        const mappedReadBy = mapToUids(d.readBy);
        const mappedDeliveredTo = mapToUids(d.deliveredTo);
        const mappedStarredBy = mapToUids(d.starredBy);
        const mappedDeletedFor = mapToUids(d.deletedFor);
        
        let mappedReactions = d.reactions;
        if (d.reactions) {
          mappedReactions = {};
          Object.keys(d.reactions).forEach(emoji => {
            mappedReactions[emoji] = Object.keys(d.reactions[emoji]);
          });
        }
        
        msgs.push({ 
          ...d, 
          id: childSnapshot.key,
          readBy: mappedReadBy,
          deliveredTo: mappedDeliveredTo,
          starredBy: mappedStarredBy,
          deletedFor: mappedDeletedFor,
          reactions: mappedReactions
        } as Message);
      });
      
      setMessages(msgs);
      setMessagesLoaded(true);

      // Reset unread count immediately upon opening the chat, and mark delivered
      if (currentUser && msgs.length > 0) {
        const updates: Record<string, any> = {};
        let hasUpdates = false;

        // Ensure unread badge clears
        updates[`conversations/${conversationId}/unreadCounts/${currentUser.uid}`] = 0;
        hasUpdates = true;

        // Check if any messages are just undelivered and mark them delivered
        const undeliveredMsgs = msgs.filter(m => m.type !== 'system' && m.senderId !== currentUser.uid && !m.deliveredTo?.includes(currentUser.uid));
        undeliveredMsgs.forEach(m => {
          updates[`conversations/${conversationId}/messages/${m.id}/deliveredTo/${currentUser.uid}`] = true;
          hasUpdates = true;
        });

        if (hasUpdates) {
          update(ref(db), updates).catch(console.error);
        }
      }
    }, (error) => {
      console.error("Messages listener error:", error);
      scheduleBackOnAccessError();
    });

    return () => {
      unsubMessages();
      if (navTimerRef.current) {
        clearTimeout(navTimerRef.current);
        navTimerRef.current = null;
      }
    };
  }, [conversationId, messageLimit, currentUser?.uid]);

  const handleImageClick = useCallback((msg: Message) => {
    const isOwn = msg.senderId === currentUser?.uid;
    setPreviewImage({ 
      url: msg.attachmentUrl || '', 
      senderName: isOwn ? 'You' : (msg.senderId ? usersMap[msg.senderId]?.displayName : 'User') || 'User', 
      timestamp: msg.timestamp,
      name: msg.attachmentName || ''
    });
  }, [currentUser?.uid, usersMap]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && messages.length >= messageLimit) {
      isFetchingOlderRef.current = true;
      if (scrollContainerRef.current) {
        lastScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
      }
      setMessageLimit(prev => prev + 50);
    }

    if (isNearBottom()) {
      setUnreadScrollCount(0);
    }
  };

  const handleSendMessage = async (text: string, file?: File | Blob | null, duration?: number, replyToMessage?: Message | null) => {
    if (!currentUser || !conversationId) return;

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
        
        // Use raw upload for documents, auto for images/videos/audio
        const resourceType = file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/') ? 'auto' : 'raw';
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

        if (duration !== undefined && file.type.startsWith('audio/')) {
          attachmentType = 'voice';
          // Name isn't crucial for voice, but let's give it a timestamp
          attachmentName = `Voice message ${format(Date.now(), 'HH:mm')}`;
        } else if (file.type.startsWith('image/')) {
          attachmentType = 'image';
          attachmentName = (file as File).name || 'Image';
        } else if (file.type.startsWith('video/')) {
          attachmentType = 'video';
          attachmentName = (file as File).name || 'Video';
        } else {
          attachmentType = 'document';
          attachmentName = (file as File).name || 'Document';
        }
        
        attachmentSize = file.size;
        setUploadProgress(null);
      }

      const msgData: any = {
        senderId: currentUser.uid,
        text: text.trim(),
        timestamp: Date.now(),
        readBy: { [currentUser.uid]: true },
        deliveredTo: { [currentUser.uid]: true },
        type: attachmentType ? attachmentType : 'text'
      };

      if (attachmentUrl) {
        msgData.attachmentUrl = attachmentUrl;
        msgData.attachmentType = attachmentType;
        msgData.attachmentName = attachmentName;
        msgData.attachmentSize = attachmentSize;
        if (duration !== undefined) {
          msgData.duration = duration;
        }
      }

      if (replyToMessage) {
        msgData.replyTo = replyToMessage.id;
        msgData.replyToText = replyToMessage.attachmentUrl
          ? `[${replyToMessage.attachmentType === 'image' ? 'Photo' : replyToMessage.attachmentType === 'video' ? 'Video' : replyToMessage.attachmentType === 'voice' ? 'Voice Message' : 'Document'}]`
          : (replyToMessage.text || '');
        msgData.replyToSenderName = replyToMessage.senderId === currentUser.uid
          ? 'You'
          : (replyToMessage.senderId ? usersMap[replyToMessage.senderId]?.displayName : undefined);
      }

      const newMsgRef = push(ref(db, `conversations/${conversationId}/messages`));
      const msgId = newMsgRef.key;
      
      const updates: Record<string, any> = {};
      updates[`conversations/${conversationId}/messages/${msgId}`] = msgData;

      // Prepare unread counts increment for other participants
      if (conversation?.participants) {
        const participantKeys = conversation?.participants ? Object.keys(conversation.participants) : [];
        participantKeys.forEach(uid => {
          if (uid !== currentUser.uid) {
            updates[`conversations/${conversationId}/unreadCounts/${uid}`] = increment(1);
          }
        });
      }

      // Update the conversation's last message
      updates[`conversations/${conversationId}/lastMessage`] = attachmentType ? `[${attachmentType === 'image' ? 'Photo' : attachmentType === 'video' ? 'Video' : attachmentType === 'voice' ? 'Voice Message' : 'Document'}] ${text.trim()}` : text.trim();
      updates[`conversations/${conversationId}/lastMessageTimestamp`] = serverTimestamp();
      updates[`conversations/${conversationId}/updatedAt`] = serverTimestamp();

      await update(ref(db), updates);

      setReplyingTo(null);
    } catch (error: any) {
      setUploadProgress(null);
      setToastMessage(error.message || "Failed to send message/file");
      console.error("Error sending message:", error);
      throw error;
    }
  };

  const handleSendPoll = async (pollData: PollData) => {
    if (!currentUser || !conversationId) return;

    try {
      const msgData: any = {
        senderId: currentUser.uid,
        text: '',
        timestamp: Date.now(),
        readBy: { [currentUser.uid]: true },
        deliveredTo: { [currentUser.uid]: true },
        type: 'poll',
        pollData: {
          ...pollData,
          isClosed: false
        }
      };

      const newMsgRef = push(ref(db, `conversations/${conversationId}/messages`));
      const msgId = newMsgRef.key;
      
      const updates: Record<string, any> = {};
      updates[`conversations/${conversationId}/messages/${msgId}`] = msgData;

      // Prepare unread counts increment for other participants
      if (conversation?.participants) {
        const participantKeys = conversation?.participants ? Object.keys(conversation.participants) : [];
        participantKeys.forEach(uid => {
          if (uid !== currentUser.uid) {
            updates[`conversations/${conversationId}/unreadCounts/${uid}`] = increment(1);
          }
        });
      }

      // Update the conversation's last message
      updates[`conversations/${conversationId}/lastMessage`] = '📊 Poll';
      updates[`conversations/${conversationId}/lastMessageTimestamp`] = serverTimestamp();
      updates[`conversations/${conversationId}/updatedAt`] = serverTimestamp();

      await update(ref(db), updates);
    } catch (error: any) {
      setToastMessage(error.message || "Failed to send poll");
      console.error("Error sending poll:", error);
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
    const participantKeys = conversation?.participants ? Object.keys(conversation.participants) : [];
    const otherUid = participantKeys.find(uid => uid !== currentUser?.uid);
    const otherUser = otherUid ? usersMap[otherUid] : null;
    chatTitle = otherUser?.displayName || 'User';
    
    if (otherUser?.isOnline) {
      chatStatus = 'Online';
    } else {
      const lastSeenStr = formatLastSeen(otherUser?.lastSeen);
      chatStatus = lastSeenStr ? lastSeenStr : (otherUser?.statusMessage || 'Hey there! I am using Chat.');
    }
    
    chatAvatar = otherUser?.photoURL || 'https://api.dicebear.com/7.x/initials/svg?seed=U';
  }

  // Typing indicator (other participants who typed within the last 3 seconds)
  const typingUids = conversation.typing
    ? Object.keys(conversation.typing).filter(uid => {
        const ts = conversation.typing?.[uid];
        return uid !== currentUser?.uid && typeof ts === 'number' && Date.now() - ts < 3000;
      })
    : [];
  if (typingUids.length > 0) {
    if (conversation.type === 'direct') {
      chatStatus = 'typing...';
    } else {
      const names = typingUids.map(uid => usersMap[uid]?.displayName || 'Someone');
      chatStatus = `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} typing...`;
    }
  }

  return (
    <div className="flex-1 flex w-full h-full relative overflow-hidden">
      <div className="flex-1 flex flex-col w-full h-full bg-bg-chat relative">
        {/* Forward Selection Header */}
        {forwardSelectionMode && (
          <div className="absolute top-0 left-0 right-0 h-[60px] bg-bg-sidebar border-b border-border z-20 flex items-center justify-between px-3 sm:px-4 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setForwardSelectionMode(false);
                  setSelectedMessageIds(new Set());
                }}
                className="p-2 hover:bg-black/5 rounded-full transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="font-medium text-foreground text-sm sm:text-base">
                {selectedMessageIds.size} selected
              </span>
            </div>
            <div className="flex items-center space-x-0 sm:space-x-1">
              <button 
                onClick={handleBulkStar}
                disabled={selectedMessageIds.size === 0}
                className="p-2 hover:bg-black/5 hover:text-foreground rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground text-muted-foreground"
                title="Star"
              >
                <Star className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedMessageIds.size === 0}
                className="p-2 hover:bg-black/5 hover:text-foreground rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground text-muted-foreground"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setShowForwardModal(true)}
                disabled={selectedMessageIds.size === 0}
                className="p-2 hover:bg-black/5 hover:text-foreground rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground text-muted-foreground"
                title="Forward"
              >
                <Forward className="w-5 h-5" />
              </button>
              <button 
                onClick={handleBulkDownload}
                disabled={selectedMessageIds.size === 0}
                className="p-2 hover:bg-black/5 hover:text-foreground rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground text-muted-foreground"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="h-14 border-b border-border bg-bg-sidebar flex-shrink-0 flex items-center justify-between px-4 z-10">
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
            <div className="flex items-center gap-2 min-w-0 flex-1">
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
                className={`flex items-center gap-2 text-left min-w-0 flex-1 ${conversation.type === 'group' ? 'cursor-pointer hover:bg-background rounded-lg p-1 -m-1 transition-colors' : ''}`}
              >
                <div className="relative flex-shrink-0 w-10 h-10">
                  {chatAvatar ? (
                    <Avatar src={chatAvatar} alt={chatTitle} className="w-10 h-10" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold flex-shrink-0">
                      {chatTitle.charAt(0)}
                    </div>
                  )}
                  {conversation.type === 'direct' && chatStatus === 'Online' && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent border-2 border-surface rounded-full"></div>
                  )}
                </div>
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <h2 className="text-sm font-medium text-foreground truncate">{chatTitle}</h2>
                  <p className="text-xs text-muted-foreground truncate">{chatStatus}</p>
                </div>
              </button>
            </div>
          )}

          {!isSearching && (
            <div className="flex items-center gap-3 relative flex-shrink-0">
              <button 
                onClick={() => setShowMediaGallery(true)}
                className="p-2 text-muted-foreground hover:bg-black/5 hover:text-foreground rounded-full transition-colors"
                title="Media"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <button 
                onClick={() => {
                  if (conversation.type === 'direct') {
                    const participantKeys = conversation?.participants ? Object.keys(conversation.participants) : [];
                    const otherUid = participantKeys.find(uid => uid !== currentUser?.uid);
                    if (otherUid) {
                      initiateCall(otherUid, chatTitle, chatAvatar, 'voice', conversationId);
                    }
                  } else {
                    setToastMessage("Group calls aren't available yet");
                  }
                }}
                className="p-2 text-muted-foreground hover:bg-black/5 hover:text-foreground rounded-full transition-colors"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button 
                onClick={() => {
                  if (conversation.type === 'direct') {
                    const participantKeys = conversation?.participants ? Object.keys(conversation.participants) : [];
                    const otherUid = participantKeys.find(uid => uid !== currentUser?.uid);
                    if (otherUid) {
                      initiateCall(otherUid, chatTitle, chatAvatar, 'video', conversationId);
                    }
                  } else {
                    setToastMessage("Group calls aren't available yet");
                  }
                }}
                className="p-2 text-muted-foreground hover:bg-black/5 hover:text-foreground rounded-full transition-colors"
              >
                <Video className="w-5 h-5" />
              </button>
              <div className="relative" ref={menuRef}>
                <button 
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-black/5 transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-2">
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-black/5 flex items-center space-x-3 transition-colors"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsSearching(true);
                        setShowMenu(false);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSearching(true);
                        setShowMenu(false);
                      }}
                    >
                      <Search className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Search</span>
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-black/5 flex items-center space-x-3 transition-colors"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setForwardSelectionMode(true);
                        setShowMenu(false);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setForwardSelectionMode(true);
                        setShowMenu(false);
                      }}
                    >
                      <CheckSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Select Messages</span>
                    </button>
                  </div>
                )}
              </div>
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
      <div className="flex-1 relative min-h-0 flex flex-col">
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 w-full overflow-y-auto overflow-x-hidden px-4 sm:px-6 pt-6 pb-2 scroll-smooth relative bg-bg-chat"
        >
        {messagesLoaded && messages.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="bg-surface/80 backdrop-blur-sm px-6 py-8 rounded-2xl flex flex-col items-center max-w-[280px] shadow-sm border border-border text-center">
              <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-foreground font-semibold mb-2">No messages yet</h3>
              <p className="text-muted-foreground text-sm">Say hello and start the conversation!</p>
            </div>
          </div>
        )}
        
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
                  isHighlighted={highlightedMessageId === msg.id}
                  isGroupChat={conversation.type === 'group'}
                  participantCount={conversation?.participants ? Object.keys(conversation.participants).length : 0}
                  conversationId={conversationId}
                  currentUserId={currentUser?.uid || ''}
                  usersMap={usersMap}
                />
              </React.Fragment>
            );
          }

          const isOwn = msg.senderId === currentUser?.uid;
          
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
                senderProfile={isOwn ? undefined : (msg.senderId ? usersMap[msg.senderId] : undefined)}
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={isLastInGroup}
                isGroupChat={conversation.type === 'group'}
                isHighlighted={highlightedMessageId === msg.id}
                participantCount={conversation?.participants ? Object.keys(conversation.participants).length : 0}
                usersMap={usersMap}
                onImageClick={handleImageClick}
                selectionMode={forwardSelectionMode}
                isSelected={selectedMessageIds.has(msg.id)}
                onToggleSelect={handleToggleSelect}
                onForward={handleForwardClick}
                onCopy={handleCopyClick}
                onSelectMode={handleSelectModeClick}
                onReact={handleReact}
                onInfo={setInfoMessageId}
                onReply={handleReply}
                onEdit={handleEditMessage}
                onDelete={handleDeleteMessage}
                conversationId={conversationId}
                currentUserId={currentUser?.uid || ''}
              />
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
        </div>
        
        {/* Floating Scroll Button */}
        {unreadScrollCount > 0 && (
          <button
            onClick={() => {
              setUnreadScrollCount(0);
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="absolute right-6 bottom-4 z-20 flex items-center justify-center w-10 h-10 bg-accent text-white rounded-full shadow-lg hover:bg-accent/90 transition-transform active:scale-95"
          >
            <ChevronDown className="w-6 h-6" />
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900">
              {unreadScrollCount > 99 ? '99+' : unreadScrollCount}
            </div>
          </button>
        )}
      </div>

      {/* Input Area */}
      <MessageInput 
        conversationId={conversationId}
        onSendMessage={handleSendMessage} 
        onSendPoll={handleSendPoll}
        uploadProgress={uploadProgress} 
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onTyping={handleTyping}
        onStopTyping={handleStopTyping}
      />
    </div>

    {/* Modals & Panels */}
      {infoMessageId && (
        <MessageInfoModal
          messageId={infoMessageId}
          conversationId={conversationId}
          usersMap={usersMap}
          participants={conversation?.participants ? Object.keys(conversation.participants) : []}
          currentUserId={currentUser?.uid || ''}
          onClose={() => setInfoMessageId(null)}
        />
      )}

      {showForwardModal && (
        <ForwardModal 
          selectedMessages={messages.filter(m => selectedMessageIds.has(m.id))}
          usersMap={usersMap}
          onClose={() => setShowForwardModal(false)}
          onForwardComplete={(count) => {
            setShowForwardModal(false);
            setForwardSelectionMode(false);
            setSelectedMessageIds(new Set());
            setToastMessage(`Forwarded to ${count} chat${count !== 1 ? 's' : ''}`);
          }}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-in fade-in">
          <div className="bg-surface rounded-2xl w-full max-w-sm shadow-xl border border-border animate-in zoom-in-95 overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">Delete {selectedMessageIds.size} messages?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete {selectedMessageIds.size} selected message{selectedMessageIds.size !== 1 ? 's' : ''}?
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleBulkDelete('everyone')}
                  className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-xl transition-colors"
                >
                  Delete for everyone
                </button>
                <button
                  onClick={() => handleBulkDelete('me')}
                  className="w-full py-3 px-4 bg-black/5 hover:bg-black/10 text-foreground font-medium rounded-xl transition-colors"
                >
                  Delete for me
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-3 px-4 hover:bg-black/5 text-foreground font-medium rounded-xl transition-colors mt-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    {/* Group Info Panel */}
    {showGroupInfo && conversation.type === 'group' && (
      <GroupInfoPanel 
        conversation={conversation}
        usersMap={usersMap}
        onClose={() => setShowGroupInfo(false)}
        onLeave={() => {
          setShowGroupInfo(false);
          if (onBack) onBack();
        }}
      />
    )}

    {/* Media Gallery Modal */}
      {showMediaGallery && (
        <MediaGalleryModal
          conversationId={conversationId}
          currentUserId={currentUser?.uid || ''}
          onClose={() => setShowMediaGallery(false)}
        />
      )}

    {/* Image Preview Modal */}
    {previewImage && (
      <ImagePreviewModal
        url={previewImage.url}
        senderName={previewImage.senderName}
        timestamp={previewImage.timestamp}
        originalFileName={previewImage.name}
        onClose={() => setPreviewImage(null)}
      />
    )}
    </div>
  );
}
