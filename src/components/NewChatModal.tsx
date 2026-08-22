import { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { X, Users } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { UserProfile } from '../types';
import { Avatar } from './ui/Avatar';

interface NewChatModalProps {
  onClose: () => void;
  onSelectConversation: (id: string) => void;
}

export default function NewChatModal({ onClose, onSelectConversation }: NewChatModalProps) {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Group creation state
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'));
        const snapshot = await getDocs(q);
        const usersList: UserProfile[] = [];
        snapshot.forEach((doc) => {
          if (doc.id !== userProfile?.uid) {
            usersList.push(doc.data() as UserProfile);
          }
        });
        setUsers(usersList);
      } catch (err) {
        console.error("Error fetching users:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [userProfile]);

  const checkChatCreationRateLimit = () => {
    if (!userProfile) return false;
    const key = `chat_creations_${userProfile.uid}`;
    const now = Date.now();
    let creations: number[] = [];
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        creations = JSON.parse(stored);
      }
    } catch (e) {
      // ignore
    }

    // Filter to last 60 seconds
    creations = creations.filter(time => now - time < 60000);

    if (creations.length >= 10) {
      setError('You can only create up to 10 new chats per minute. Please wait.');
      return false;
    }

    creations.push(now);
    localStorage.setItem(key, JSON.stringify(creations));
    return true;
  };

  const handleStartDirectChat = async (otherUser: UserProfile) => {
    if (!userProfile) return;
    
    setCreating(true);
    setError('');
    try {
      const directConversationId = [userProfile.uid, otherUser.uid].sort().join('_');
      const convoRef = doc(db, 'conversations', directConversationId);
      const convoSnap = await getDoc(convoRef);

      if (convoSnap.exists()) {
        onSelectConversation(directConversationId);
        onClose();
        return;
      }

      if (!checkChatCreationRateLimit()) {
        setCreating(false);
        return;
      }

      // Create new if it doesn't exist
      await setDoc(convoRef, {
        type: 'direct',
        participants: [userProfile.uid, otherUser.uid],
        updatedAt: Date.now(),
        lastMessage: '',
      });
      
      onSelectConversation(directConversationId);
      onClose();
    } catch (err: any) {
      setError(err.message);
      setCreating(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!userProfile || selectedUsers.size === 0 || !groupName.trim()) return;
    setCreating(true);
    setError('');
    
    if (!checkChatCreationRateLimit()) {
      setCreating(false);
      return;
    }

    try {
      const participants = [userProfile.uid, ...Array.from(selectedUsers)];
      const groupNameTrimmed = groupName.trim();
      const now = Date.now();
      const convoRef = await addDoc(collection(db, 'conversations'), {
        type: 'group',
        participants,
        groupName: groupNameTrimmed,
        createdBy: userProfile.uid,
        createdAt: now,
        admins: [userProfile.uid],
        updatedAt: now,
        lastMessage: `${userProfile.displayName} created this group`,
        lastMessageTimestamp: now,
      });

      // Add system message
      await addDoc(collection(db, `conversations/${convoRef.id}/messages`), {
        senderId: null,
        type: 'system',
        text: `${userProfile.displayName} created this group`,
        timestamp: now,
        readBy: []
      });
      
      onSelectConversation(convoRef.id);
      onClose();
    } catch (err: any) {
      setError(err.message);
      setCreating(false);
    }
  };

  const toggleUserSelection = (uid: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(uid)) {
      newSelection.delete(uid);
    } else {
      newSelection.add(uid);
    }
    setSelectedUsers(newSelection);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-border flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {isCreatingGroup ? 'Create Group' : 'New Chat'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="text-destructive text-sm mb-4">{error}</p>}
          
          {!isCreatingGroup ? (
            <>
              <button 
                onClick={() => setIsCreatingGroup(true)}
                className="w-full flex items-center p-3 mb-4 rounded-xl hover:bg-surface-hover text-accent transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mr-3">
                  <Users className="w-5 h-5" />
                </div>
                <span className="font-medium">Create a new group</span>
              </button>

              <div className="mb-2 text-xs font-semibold text-muted uppercase tracking-wider">Suggested Users</div>
              
              {loading ? (
                <div className="flex justify-center p-4">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <ul className="space-y-1">
                  {users.map(u => (
                    <li key={u.uid}>
                      <button 
                        onClick={() => handleStartDirectChat(u)}
                        disabled={creating}
                        className="w-full flex items-center p-2 rounded-xl hover:bg-surface-hover transition-colors text-left disabled:opacity-50"
                      >
                        <Avatar src={u.photoURL} alt={u.displayName} className="w-10 h-10 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-foreground">{u.displayName}</div>
                          <div className="text-xs text-muted truncate max-w-[200px]">{u.statusMessage}</div>
                        </div>
                      </button>
                    </li>
                  ))}
                  {users.length === 0 && (
                    <p className="text-sm text-muted text-center py-4">No other users found.</p>
                  )}
                </ul>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">Group Name</label>
                <input 
                  type="text" 
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Weekend Plan"
                  className="w-full p-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold text-muted uppercase tracking-wider">Select Members</div>
                <ul className="space-y-1 border border-border rounded-xl p-2 max-h-48 overflow-y-auto bg-background/50">
                  {users.map(u => (
                    <li key={u.uid}>
                      <label className="flex items-center p-2 rounded-lg hover:bg-surface cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedUsers.has(u.uid)}
                          onChange={() => toggleUserSelection(u.uid)}
                          className="mr-3 w-4 h-4 text-accent border-border rounded focus:ring-accent"
                        />
                        <Avatar src={u.photoURL} alt={u.displayName} className="w-8 h-8 mr-3" />
                        <span className="text-sm text-foreground">{u.displayName}</span>
                      </label>
                    </li>
                  ))}
                  {users.length === 0 && (
                    <p className="text-sm text-muted text-center py-2">No users to add.</p>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {isCreatingGroup && (
          <div className="p-4 border-t border-border bg-surface-hover/30 flex justify-end space-x-2">
            <button 
              onClick={() => setIsCreatingGroup(false)}
              className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              Back
            </button>
            <button 
              onClick={handleCreateGroup}
              disabled={creating || !groupName.trim() || selectedUsers.size === 0}
              className="px-4 py-2 bg-accent text-accent-foreground text-sm font-medium rounded-xl hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
