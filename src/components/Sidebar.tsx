import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, limit, writeBatch } from 'firebase/firestore';
import { Plus, Search, MessageSquare, LogOut, Users } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Conversation, UserProfile, Message } from '../types';
import { format, isToday, isYesterday } from 'date-fns';
import NewChatModal from './NewChatModal';
import MyProfilePanel from './MyProfilePanel';

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
}

export default function Sidebar({ activeConversationId, onSelectConversation, usersMap, isUsersLoaded }: SidebarProps) {
  const { userProfile, currentUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({});

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

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos: Conversation[] = [];
      snapshot.forEach((doc) => {
        convos.push({ id: doc.id, ...doc.data() } as Conversation);
      });
      setConversations(convos);
      setIsLoading(false);

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const convo = change.doc.data() as Conversation;
          const isCurrentlyActive = activeConversationIdRef.current === change.doc.id && document.hasFocus();
          const isNewMessage = convo.lastMessageTimestamp && convo.lastMessageTimestamp !== lastMsgTsRef.current[change.doc.id];
          lastMsgTsRef.current[change.doc.id] = convo.lastMessageTimestamp || 0;
          
          if (!isCurrentlyActive && hasNotificationPermissionRef.current && isNewMessage) {
            new Notification('New Message', {
              body: convo.lastMessage || 'You received a new message',
              icon: '/favicon.svg'
            });
          }
        }
      });
    }, (error) => {
      console.error("Conversations query error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Keep a local cache of the last 50 messages for each conversation to support client-side search
  // and handle message delivery receipts (double gray ticks)
  useEffect(() => {
    if (!currentUser?.uid) return;

    const convoList = conversationsRef.current;
    const unsubscribes = convoList.map(convo => {
      const q = query(
        collection(db, `conversations/${convo.id}/messages`),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      return onSnapshot(q, snapshot => {
        const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
        setMessagesCache(prev => ({ ...prev, [convo.id]: msgs.slice().reverse() }));

        // Process delivery receipts: mark undelivered messages from others as delivered
        const undeliveredMsgs = msgs.filter(m => 
          m.type !== 'system' && 
          m.senderId !== currentUser.uid && 
          !m.deliveredTo?.includes(currentUser.uid)
        );

        if (undeliveredMsgs.length > 0) {
          const batch = writeBatch(db);
          undeliveredMsgs.forEach(m => {
            const msgRef = doc(db, `conversations/${convo.id}/messages`, m.id);
            batch.update(msgRef, {
              deliveredTo: [...(m.deliveredTo || []), currentUser.uid]
            });
          });
          batch.commit().catch(console.error);
        }
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [conversationIds, currentUser?.uid]);

  const handleLogout = () => {
    auth.signOut();
  };

  const filteredConversations = conversations.filter(c => {
    if (debouncedSearchQuery.trim() === '') return true;
    
    let name = '';
    if (c.type === 'group') {
      name = c.groupName || '';
    } else {
      const otherUserId = c.participants.find(id => id !== currentUser?.uid);
      name = (otherUserId && usersMap[otherUserId]?.displayName) || 'Direct Message';
    }
    
    return name.toLowerCase().includes(debouncedSearchQuery.trim().toLowerCase());
  });

  const existingDirectContactIds = new Set(
    conversations
      .filter(c => c.type === 'direct')
      .flatMap(c => c.participants)
  );

  const filteredContacts = debouncedSearchQuery.trim() === '' ? [] : Object.values(usersMap).filter(user => {
    if (user.uid === currentUser?.uid) return false;
    if (existingDirectContactIds.has(user.uid)) return false;
    return user.displayName.toLowerCase().includes(debouncedSearchQuery.trim().toLowerCase());
  });

  const handleStartDirectChat = async (otherUser: UserProfile) => {
    if (!currentUser?.uid) return;
    
    const existingConvo = conversations.find(c => 
      c.type === 'direct' && c.participants.includes(otherUser.uid)
    );

    if (existingConvo) {
      onSelectConversation(existingConvo.id);
      setSearchQuery('');
      return;
    }

    try {
      const directConversationId = [currentUser.uid, otherUser.uid].sort().join('_');
      const convoRef = doc(db, 'conversations', directConversationId);
      const convoSnap = await getDoc(convoRef);

      if (!convoSnap.exists()) {
        await setDoc(convoRef, {
          type: 'direct',
          participants: [currentUser.uid, otherUser.uid],
          updatedAt: Date.now(),
          lastMessage: '',
        });
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
      const otherUserId = convo.participants.find(id => id !== currentUser?.uid);
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

  const activeUserProfile = currentUser && usersMap[currentUser.uid] ? usersMap[currentUser.uid] : userProfile;

  return (
    <div className="w-full h-full flex flex-col bg-surface">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div 
          className="flex items-center space-x-3 cursor-pointer hover:bg-background/50 p-1.5 -ml-1.5 rounded-lg transition-colors"
          onClick={() => setShowMyProfile(true)}
        >
          <div className="relative">
            {activeUserProfile?.photoURL ? (
              <img 
                key={activeUserProfile.photoURL}
                src={activeUserProfile.photoURL} 
                alt="Profile" 
                className="w-10 h-10 rounded-full object-cover border border-border"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${activeUserProfile?.displayName || 'U'}`;
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-border animate-pulse border border-border"></div>
            )}
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent border-2 border-surface rounded-full"></div>
          </div>
          <h1 className="font-semibold text-foreground truncate w-32">{activeUserProfile?.displayName}</h1>
        </div>
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
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
          />
        </div>
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
                <p className="text-sm">No conversations yet.</p>
                <p className="text-xs mt-1">Click the + button to start one.</p>
              </>
            )}
          </div>
        ) : (
          <div className="px-2 pb-24">
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
                          onClick={() => onSelectConversation(convo.id)}
                          className={`w-full flex items-center p-3 rounded-xl transition-all ${
                            isActive 
                              ? 'bg-accent/10 text-foreground' 
                              : 'hover:bg-surface-hover text-muted-foreground'
                          }`}
                        >
                          <div className="relative flex-shrink-0">
                            {isGroup && !photoURL ? (
                              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                                <Users className="w-6 h-6" />
                              </div>
                            ) : photoURL ? (
                              <img src={photoURL} alt={displayName} className="w-12 h-12 rounded-full object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 opacity-50" />
                              </div>
                            )}
                          </div>
                          
                          <div className="ml-4 flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className={`text-sm truncate ${unreadCount > 0 ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>
                                {displayName}
                              </h3>
                              {convo.updatedAt && (
                                <span className={`text-xs ${unreadCount > 0 ? 'text-accent font-medium' : 'text-muted'}`}>
                                  {formatSidebarTime(convo.updatedAt)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <p className={`text-xs truncate mr-2 ${unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted'}`}>
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
                        className="w-full flex items-center p-3 rounded-xl transition-all hover:bg-surface-hover text-muted-foreground"
                      >
                        <div className="relative flex-shrink-0">
                          <img src={user.photoURL} alt={user.displayName} className="w-12 h-12 rounded-full object-cover" />
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
                          className="w-full flex items-center p-3 rounded-xl transition-all hover:bg-surface-hover text-muted-foreground"
                        >
                          <div className="relative flex-shrink-0">
                            {isGroup ? (
                              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                                <Users className="w-6 h-6" />
                              </div>
                            ) : photoURL ? (
                              <img src={photoURL} alt={displayName} className="w-12 h-12 rounded-full object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 opacity-50" />
                              </div>
                            )}
                          </div>
                          <div className="ml-4 flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="text-sm font-medium truncate text-foreground">
                                {displayName}
                              </h3>
                              {message.timestamp && (
                                <span className="text-xs text-muted">
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
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-accent hover:bg-accent/90 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all z-50"
      >
        <Plus className="w-6 h-6" />
      </button>

      {isNewChatModalOpen && (
        <NewChatModal onClose={() => setIsNewChatModalOpen(false)} onSelectConversation={onSelectConversation} />
      )}
    </div>
  );
}
