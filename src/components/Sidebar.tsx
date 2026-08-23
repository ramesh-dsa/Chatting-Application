import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, get, update } from 'firebase/database';
import { Plus, Search, MessageSquare, LogOut, Users, Star, Trash2 } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Conversation, UserProfile, Message } from '../types';
import { format, isToday, isYesterday } from 'date-fns';
import { stripHTML } from '../utils/sanitize';
import NewChatModal from './NewChatModal';
import MyProfilePanel from './MyProfilePanel';
import { Avatar } from './ui/Avatar';

function formatSidebarTime(timestamp: number) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd/MM/yyyy');
}

interface SidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string, searchMessageId?: string) => void;
  usersMap: Record<string, UserProfile>;
  isUsersLoaded: boolean;
  showMyProfile: boolean;
  setShowMyProfile: (show: boolean) => void;
}

export default function Sidebar({ activeConversationId, onSelectConversation, usersMap, isUsersLoaded, showMyProfile, setShowMyProfile }: SidebarProps) {
  const { userProfile, currentUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({});

  type FilterTab = 'all' | 'unread' | 'groups' | 'favorites';
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  
  const [contextMenuConvoId, setContextMenuConvoId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number, y: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenuConvoId) {
        setContextMenuConvoId(null);
        setContextMenuPos(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [contextMenuConvoId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        setHasNotificationPermission(permission === 'granted');
      });
    }


  }, []);

  const activeConversationIdRef = useRef(activeConversationId);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const lastMsgTsRef = useRef<Record<string, number>>({});

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const conversationIds = conversations.map(c => c.id).sort().join(',');

  const hasNotificationPermissionRef = useRef(hasNotificationPermission);
  useEffect(() => {
    hasNotificationPermissionRef.current = hasNotificationPermission;
  }, [hasNotificationPermission]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const indexRef = ref(db, `userConversations/${currentUser.uid}`);
    let convoUnsubs: Record<string, () => void> = {};
    
    const unsubIndex = onValue(indexRef, (indexSnap) => {
      if (!indexSnap.exists()) {
        setConversations([]);
        setIsLoading(false);
        Object.values(convoUnsubs).forEach(unsub => unsub());
        convoUnsubs = {};
        return;
      }
      
      const newConvoIds = Object.keys(indexSnap.val());
      
      Object.keys(convoUnsubs).forEach(id => {
        if (!newConvoIds.includes(id)) {
          convoUnsubs[id]();
          delete convoUnsubs[id];
          setConversations(prev => prev.filter(c => c.id !== id));
        }
      });
      
      setIsLoading(false);
      
      newConvoIds.forEach(id => {
        if (!convoUnsubs[id]) {
          const convoRef = ref(db, `conversations/${id}`);
          convoUnsubs[id] = onValue(convoRef, (convoSnap) => {
            if (convoSnap.exists()) {
              const convo = { id: convoSnap.key, ...convoSnap.val() } as Conversation;
              
              setConversations(prev => {
                const newConvos = [...prev.filter(c => c.id !== id), convo];
                return newConvos.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
              });

              const isCurrentlyActive = activeConversationIdRef.current === convo.id && document.hasFocus();
              const isNewMessage = convo.lastMessageTimestamp && convo.lastMessageTimestamp !== lastMsgTsRef.current[convo.id];
              
              if (isNewMessage) {
                 if (!isCurrentlyActive && hasNotificationPermissionRef.current && lastMsgTsRef.current[convo.id] !== undefined) {
                    new Notification('New Message', {
                      body: convo.lastMessage || 'You received a new message',
                      icon: '/favicon.svg'
                    });
                 }
              }
              lastMsgTsRef.current[convo.id] = convo.lastMessageTimestamp || 0;
            } else {
              setConversations(prev => prev.filter(c => c.id !== id));
            }
          });
        }
      });
    }, (error) => {
      console.error("Index query error:", error);
      setIsLoading(false);
    });

    return () => {
      unsubIndex();
      Object.values(convoUnsubs).forEach(unsub => unsub());
    };
  }, [currentUser?.uid]);

  // Keep a local cache of the last 50 messages for each conversation to support client-side search
  // and handle message delivery receipts (double gray ticks)
  useEffect(() => {
    if (!currentUser?.uid) return;

    const convoList = conversationsRef.current;
    const unsubscribes = convoList.map(convo => {
      const messagesRef = ref(db, `conversations/${convo.id}/messages`);
      // Since RTDB doesn't easily limit to last 50 client-side without order by, we just fetch all or we use limitToLast(50) with query(ref, orderByChild('timestamp'), limitToLast(50)). But for simplicity in RTDB we can just use onValue and process in JS if it's small, or use RTDB queries:
      // import { query as rtdbQuery, orderByChild, limitToLast } from 'firebase/database';
      // Wait, we didn't import those, let's just fetch all for now or do we need them? I will just fetch all since it's a small app, or add import manually?
      // I'll add a separate call to fix imports if I need to. Let's just fetch all and slice for now:
      return onValue(messagesRef, (snapshot) => {
        const msgs: Message[] = [];
        if (snapshot.exists()) {
          snapshot.forEach(child => {
            msgs.push({ id: child.key, ...child.val() } as Message);
          });
        }
        // sort descending
        msgs.sort((a, b) => b.timestamp - a.timestamp);
        const top50 = msgs.slice(0, 50);
        
        setMessagesCache(prev => ({ ...prev, [convo.id]: top50 }));

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

        // Process delivery receipts
        const undeliveredMsgs = top50.filter(m => {
          if (m.type === 'system' || m.senderId === currentUser.uid) return false;
          const deliveredToUids = mapToUids(m.deliveredTo);
          return !deliveredToUids.includes(currentUser.uid);
        });

        if (undeliveredMsgs.length > 0) {
          const updates: Record<string, any> = {};
          undeliveredMsgs.forEach(m => {
            updates[`conversations/${convo.id}/messages/${m.id}/deliveredTo/${currentUser.uid}`] = true;
          });
          update(ref(db), updates).catch(console.error);
        }
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [conversationIds, currentUser?.uid]);

  const handleLogout = () => {
    auth.signOut();
  };

  const filteredConversations = conversations.filter(c => {
    if (currentUser && c.deletedFor?.[currentUser.uid]) {
      const lastActive = Math.max(c.updatedAt || 0, c.lastMessageTimestamp || 0);
      if (lastActive <= c.deletedFor[currentUser.uid]) return false;
    }

    if (activeTab === 'unread') {
      const unreadCount = (currentUser && c.unreadCounts?.[currentUser.uid]) || 0;
      if (unreadCount === 0) return false;
    } else if (activeTab === 'groups') {
      if (c.type !== 'group') return false;
    } else if (activeTab === 'favorites') {
      if (!currentUser || !c.favoritedBy?.[currentUser.uid]) return false;
    }

    if (debouncedSearchQuery.trim() === '') return true;
    
    let name = '';
    if (c.type === 'group') {
      name = c.groupName || '';
    } else {
      const otherUserId = Object.keys(c.participants || {}).find(id => id !== currentUser?.uid);
      name = (otherUserId && usersMap[otherUserId]?.displayName) || 'Direct Message';
    }
    
    return name.toLowerCase().includes(debouncedSearchQuery.trim().toLowerCase());
  });

  const existingDirectContactIds = new Set(
    conversations
      .filter(c => c.type === 'direct')
      .flatMap(c => Object.keys(c.participants || {}))
  );

  const filteredContacts = debouncedSearchQuery.trim() === '' ? [] : Object.values(usersMap).filter(user => {
    if (user.uid === currentUser?.uid) return false;
    if (existingDirectContactIds.has(user.uid)) return false;
    return user.displayName.toLowerCase().includes(debouncedSearchQuery.trim().toLowerCase());
  });

  const handleStartDirectChat = async (otherUser: UserProfile) => {
    if (!currentUser?.uid) return;
    
    const existingConvo = conversations.find(c => 
      c.type === 'direct' && c.participants && c.participants[otherUser.uid]
    );

    if (existingConvo) {
      onSelectConversation(existingConvo.id);
      setSearchQuery('');
      return;
    }

    try {
      const directConversationId = [currentUser.uid, otherUser.uid].sort().join('_');
      const convoRef = ref(db, `conversations/${directConversationId}`);
      const convoSnap = await get(convoRef);

      if (!convoSnap.exists()) {
        const updates: Record<string, any> = {};
        updates[`conversations/${directConversationId}`] = {
          type: 'direct',
          participants: { [currentUser.uid]: true, [otherUser.uid]: true },
          updatedAt: Date.now(),
          lastMessage: '',
        };
        updates[`userConversations/${currentUser.uid}/${directConversationId}`] = true;
        updates[`userConversations/${otherUser.uid}/${directConversationId}`] = true;
        await update(ref(db), updates);
      }
      
      onSelectConversation(directConversationId);
      setSearchQuery('');
    } catch (err) {
      console.error("Error creating direct chat:", err);
    }
  };

  const filteredMessages = Object.entries(messagesCache).flatMap(([convoId, msgs]) => {
    if (debouncedSearchQuery.trim() === '') return [];
    
    const convo = conversations.find(c => c.id === convoId);
    if (!convo) return [];

    return msgs
      .filter(m => m.type !== 'system' && (m.text || '').toLowerCase().includes(debouncedSearchQuery.trim().toLowerCase()))
      .map(m => ({
        message: m,
        conversationId: convoId,
        conversation: convo
      }));
  }).sort((a, b) => b.message.timestamp - a.message.timestamp);

  const getConvoDisplayInfo = (convo: Conversation) => {
    const isGroup = convo.type === 'group';
    let displayName = 'Direct Message';
    let photoURL = '';

    if (isGroup) {
      displayName = convo.groupName || 'Group';
      photoURL = convo.groupPhoto || '';
    } else {
      const otherUserId = Object.keys(convo.participants || {}).find(id => id !== currentUser?.uid);
      if (otherUserId && usersMap[otherUserId]) {
        displayName = usersMap[otherUserId].displayName;
        photoURL = usersMap[otherUserId].photoURL;
      }
    }
    return { displayName, photoURL, isGroup };
  };

  if (showMyProfile) {
    return <MyProfilePanel onClose={() => setShowMyProfile(false)} />;
  }

  const handleToggleFavorite = async (convoId: string, currentStatus: boolean) => {
    if (!currentUser) return;
    try {
      const updates: Record<string, any> = {};
      if (currentStatus) {
        updates[`conversations/${convoId}/favoritedBy/${currentUser.uid}`] = null;
      } else {
        updates[`conversations/${convoId}/favoritedBy/${currentUser.uid}`] = true;
      }
      await update(ref(db), updates);
    } catch (e) {
      console.error("Failed to toggle favorite:", e);
    }
    setContextMenuConvoId(null);
  };

  const handleDeleteChat = async (convoId: string) => {
    if (!currentUser) return;
    if (!window.confirm("Delete this chat? This cannot be undone.")) {
      setContextMenuConvoId(null);
      return;
    }
    try {
      const updates: Record<string, any> = {};
      updates[`conversations/${convoId}/deletedFor/${currentUser.uid}`] = Date.now();
      await update(ref(db), updates);
    } catch (e) {
      console.error("Failed to delete chat:", e);
    }
    setContextMenuConvoId(null);
    if (activeConversationId === convoId) {
      onSelectConversation(''); 
    }
  };

  const handleTouchStart = (e: React.TouchEvent, convoId: string) => {
    isLongPressTriggeredRef.current = false;
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setContextMenuConvoId(convoId);
      setContextMenuPos({ x, y });
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, convoId: string) => {
    e.preventDefault();
    setContextMenuConvoId(convoId);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };  return (
    <div className="w-full h-full flex flex-col bg-bg-sidebar border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Chats</h1>
        <div className="flex space-x-1">
          <button 
            onClick={() => setIsNewChatModalOpen(true)}
            className="hidden md:block p-2 rounded-full hover:bg-surface-hover text-muted-foreground transition-colors"
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-surface-hover text-muted-foreground hover:text-destructive transition-colors"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search messages"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value.slice(0, 100);
              setSearchQuery(stripHTML(val));
            }}
            className="w-full pl-9 pr-4 py-2 bg-bg-app border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
          />
        </div>
        {searchQuery.trim().length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-2 px-1 text-center">
            Searching recent messages only
          </p>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="px-4 pb-2 flex space-x-2 overflow-x-auto scrollbar-none">
        {(['all', 'unread', 'favorites', 'groups'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-accent/10 text-accent'
                : 'hover:bg-black/5 text-muted-foreground bg-bg-app'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {isLoading || !isUsersLoaded ? (
          <div className="p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-12 h-12 bg-border rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="h-4 bg-border rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-border rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 && filteredContacts.length === 0 && filteredMessages.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
            {debouncedSearchQuery ? (
              <p className="text-sm">No results found.</p>
            ) : (
              <>
                <MessageSquare className="w-8 h-8 mb-3 opacity-20" />
                <p className="text-sm">
                  {activeTab === 'unread' ? "No unread chats." :
                   activeTab === 'favorites' ? "No favorite chats yet." :
                   activeTab === 'groups' ? "No group chats." :
                   "No conversations yet."}
                </p>
                {activeTab === 'all' && <p className="text-xs mt-1">Click the + button to start one.</p>}
              </>
            )}
          </div>
        ) : (
          <div className="px-2 pb-40">
            {filteredConversations.length > 0 && (
              <div className="mb-4">
                {debouncedSearchQuery && <div className="px-3 mb-2 text-xs font-semibold text-muted uppercase tracking-wider">Chats</div>}
                <ul className="space-y-1">
                  {filteredConversations.map((convo) => {
                    const isActive = convo.id === activeConversationId;
                    const { displayName, photoURL, isGroup } = getConvoDisplayInfo(convo);
                    const unreadCount = (userProfile && convo.unreadCounts?.[userProfile.uid]) || 0;
                    
                    return (
                      <li key={convo.id}>
                        <button
                          onClick={() => {
                            if (isLongPressTriggeredRef.current) {
                              isLongPressTriggeredRef.current = false;
                              return;
                            }
                            onSelectConversation(convo.id);
                          }}
                          onTouchStart={(e) => handleTouchStart(e, convo.id)}
                          onTouchEnd={handleTouchEnd}
                          onTouchMove={handleTouchEnd}
                          onContextMenu={(e) => handleContextMenu(e, convo.id)}
                          className={`w-full flex items-center p-3 rounded-xl transition-all ${
                            isActive 
                              ? 'bg-accent/10 text-foreground' 
                              : 'hover:bg-black/5 text-muted-foreground'
                          }`}
                        >
                          <div className="relative flex-shrink-0">
                            {isGroup && !photoURL ? (
                              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                                <Users className="w-6 h-6" />
                              </div>
                            ) : photoURL ? (
                              <Avatar src={photoURL} alt={displayName} className="w-12 h-12" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 opacity-50" />
                              </div>
                            )}
                          </div>
                          
                          <div className="ml-4 flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className={`flex-1 min-w-0 pr-2 text-sm truncate ${unreadCount > 0 ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>
                                {displayName}
                              </h3>
                              {convo.updatedAt && (
                                <span className={`flex-shrink-0 text-xs ${unreadCount > 0 ? 'text-accent font-medium' : 'text-muted'}`}>
                                  {formatSidebarTime(convo.updatedAt)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <p className={`text-xs truncate mr-2 ${unreadCount > 0 ? 'text-foreground font-bold' : 'text-muted'}`}>
                                {convo.lastMessage || 'No messages yet'}
                              </p>
                              {unreadCount > 0 && (
                                <div className="bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center min-w-[20px] h-5">
                                  {unreadCount > 99 ? '99+' : unreadCount}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {filteredContacts.length > 0 && (
              <div className="mb-4">
                <div className="px-3 mb-2 text-xs font-semibold text-muted uppercase tracking-wider">Contacts</div>
                <ul className="space-y-1">
                  {filteredContacts.map(user => (
                    <li key={user.uid}>
                      <button
                        onClick={() => handleStartDirectChat(user)}
                        className="w-full flex items-center p-3 rounded-xl transition-all hover:bg-black/5 text-muted-foreground"
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar src={user.photoURL} alt={user.displayName} className="w-12 h-12" />
                        </div>
                        <div className="ml-4 flex-1 min-w-0 text-left">
                          <h3 className="text-sm font-medium truncate text-foreground">
                            {user.displayName}
                          </h3>
                          <p className="text-xs truncate text-muted">
                            {user.statusMessage || 'Available'}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {filteredMessages.length > 0 && (
              <div className="mb-4">
                <div className="px-3 mb-2 text-xs font-semibold text-muted uppercase tracking-wider">Messages</div>
                <ul className="space-y-1">
                  {filteredMessages.map(({ message, conversationId, conversation }) => {
                    const { displayName, photoURL, isGroup } = getConvoDisplayInfo(conversation);
                    const senderName = message.senderId === userProfile?.uid 
                      ? 'You' 
                      : (message.senderId ? (usersMap[message.senderId]?.displayName || 'Unknown') : 'Unknown');

                    return (
                      <li key={message.id}>
                        <button
                          onClick={() => onSelectConversation(conversationId, message.id)}
                          className="w-full flex items-center p-3 rounded-xl transition-all hover:bg-black/5 text-muted-foreground"
                        >
                          <div className="relative flex-shrink-0">
                            {isGroup ? (
                              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                                <Users className="w-6 h-6" />
                              </div>
                            ) : photoURL ? (
                              <Avatar src={photoURL} alt={displayName} className="w-12 h-12" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 opacity-50" />
                              </div>
                            )}
                          </div>
                          <div className="ml-4 flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="flex-1 min-w-0 pr-2 text-sm font-medium truncate text-foreground">
                                {displayName}
                              </h3>
                              {message.timestamp && (
                                <span className="flex-shrink-0 text-xs text-muted">
                                  {formatSidebarTime(message.timestamp)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs truncate text-muted">
                              <span className="font-medium mr-1">{senderName}:</span>
                              {message.text}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB - mobile only */}
      <button
        onClick={() => setIsNewChatModalOpen(true)}
        className="md:hidden fixed bottom-[80px] right-6 w-14 h-14 bg-accent hover:bg-accent/90 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all z-50"
      >
        <Plus className="w-6 h-6" />
      </button>

      {isNewChatModalOpen && (
        <NewChatModal onClose={() => setIsNewChatModalOpen(false)} onSelectConversation={onSelectConversation} />
      )}

      {contextMenuConvoId && contextMenuPos && (() => {
        const convo = conversations.find(c => c.id === contextMenuConvoId);
        if (!convo) return null;
        const isFavorited = !!(currentUser && convo.favoritedBy?.[currentUser.uid]);
        
        return (
          <div 
            className="fixed z-50 bg-bg-popover border border-border rounded-xl shadow-lg py-1 min-w-[160px] overflow-hidden"
            style={{ 
              top: Math.min(contextMenuPos.y, window.innerHeight - 100), 
              left: Math.min(contextMenuPos.x, window.innerWidth - 180) 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleToggleFavorite(convo.id, isFavorited)}
              className="w-full text-left px-4 py-3 text-sm hover:bg-surface-hover flex items-center text-foreground transition-colors"
            >
              <Star className={`w-4 h-4 mr-3 ${isFavorited ? 'fill-accent text-accent' : ''}`} />
              {isFavorited ? 'Remove Favorite' : 'Add Favorite'}
            </button>
            <button
              onClick={() => handleDeleteChat(convo.id)}
              className="w-full text-left px-4 py-3 text-sm hover:bg-surface-hover flex items-center text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-3" />
              Delete Chat
            </button>
          </div>
        );
      })()}
    </div>
  );
}
