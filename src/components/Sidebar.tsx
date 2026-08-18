import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { Plus, Search, MessageSquare, LogOut, Users } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Conversation, UserProfile, Message } from '../types';
import { formatDistanceToNow } from 'date-fns';
import NewChatModal from './NewChatModal';

interface SidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string, messageId?: string) => void;
}

export default function Sidebar({ activeConversationId, onSelectConversation }: SidebarProps) {
  const { userProfile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
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

    // Subscribe to all users to display names/avatars for direct chats
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const map: Record<string, UserProfile> = {};
      snapshot.forEach(doc => {
        map[doc.id] = doc.data() as UserProfile;
      });
      setUsersMap(map);
    });

    return () => unsubscribeUsers();
  }, []);

  useEffect(() => {
    if (!userProfile?.uid) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userProfile.uid),
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
          const isCurrentlyActive = activeConversationId === change.doc.id && document.hasFocus();
          
          if (!isCurrentlyActive && hasNotificationPermission) {
            new Notification('New Message', {
              body: convo.lastMessage || 'You received a new message',
              icon: '/vite.svg'
            });
          }
        }
      });
    });

    return () => unsubscribe();
  }, [userProfile, activeConversationId, hasNotificationPermission]);

  const handleLogout = () => {
    auth.signOut();
  };

  const filteredConversations = conversations.filter(c => {
    if (debouncedSearchQuery.trim() === '') return true;
    
    let name = '';
    if (c.type === 'group') {
      name = c.groupName || '';
    } else {
      const otherUserId = c.participants.find(id => id !== userProfile?.uid);
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
    if (user.uid === userProfile?.uid) return false;
    if (existingDirectContactIds.has(user.uid)) return false;
    return user.displayName.toLowerCase().includes(debouncedSearchQuery.trim().toLowerCase());
  });

  const handleStartDirectChat = async (otherUser: UserProfile) => {
    if (!userProfile) return;
    try {
      const directConversationId = [userProfile.uid, otherUser.uid].sort().join('_');
      const convoRef = doc(db, 'conversations', directConversationId);
      const convoSnap = await getDoc(convoRef);

      if (!convoSnap.exists()) {
        await setDoc(convoRef, {
          type: 'direct',
          participants: [userProfile.uid, otherUser.uid],
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

  return (
    <div className="w-full h-full flex flex-col bg-surface">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img 
              src={userProfile?.photoURL} 
              alt="Profile" 
              className="w-10 h-10 rounded-full object-cover border border-border"
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent border-2 border-surface rounded-full"></div>
          </div>
          <h1 className="font-semibold text-foreground truncate w-32">{userProfile?.displayName}</h1>
        </div>
        <div className="flex space-x-1">
          <button 
            onClick={() => setIsNewChatModalOpen(true)}
            className="p-2 rounded-full hover:bg-surface-hover text-muted-foreground transition-colors"
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
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-12 h-12 bg-surface rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="h-4 bg-surface rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-surface rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 && filteredContacts.length === 0 ? (
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
          <div className="px-2 pb-4">
            {filteredConversations.length > 0 && (
              <ul className="space-y-1">
                {filteredConversations.map((convo) => {
              const isActive = convo.id === activeConversationId;
              const isGroup = convo.type === 'group';
              
              let displayName = 'Direct Message';
              let photoURL = '';

              if (isGroup) {
                displayName = convo.groupName || 'Group';
              } else {
                const otherUserId = convo.participants.find(id => id !== userProfile?.uid);
                if (otherUserId && usersMap[otherUserId]) {
                  displayName = usersMap[otherUserId].displayName;
                  photoURL = usersMap[otherUserId].photoURL;
                }
              }
              
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
                        <h3 className={`text-sm font-medium truncate ${isActive ? 'text-foreground' : 'text-foreground'}`}>
                          {displayName}
                        </h3>
                        {convo.updatedAt && (
                          <span className="text-xs text-muted">
                            {formatDistanceToNow(convo.updatedAt, { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate ${isActive ? 'text-foreground/80' : 'text-muted'}`}>
                        {convo.lastMessage || 'No messages yet'}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
              </ul>
            )}

            {filteredContacts.length > 0 && (
              <div className="mt-4">
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
          </div>
        )}
      </div>

      {isNewChatModalOpen && (
        <NewChatModal onClose={() => setIsNewChatModalOpen(false)} onSelectConversation={onSelectConversation} />
      )}
    </div>
  );
}
