import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { X, Search, Check } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Conversation, Message, UserProfile } from '../types';
import { Avatar } from './ui/Avatar';

interface ForwardModalProps {
  selectedMessages: Message[];
  usersMap: Record<string, UserProfile>;
  onClose: () => void;
  onForwardComplete: (count: number) => void;
}

export default function ForwardModal({ selectedMessages, usersMap, onClose, onForwardComplete }: ForwardModalProps) {
  const { userProfile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchConversations = async () => {
      if (!userProfile) return;
      try {
        const q = query(
          collection(db, 'conversations'),
          where('participants', 'array-contains', userProfile.uid)
        );
        const snapshot = await getDocs(q);
        const convosList: Conversation[] = [];
        snapshot.forEach((doc) => {
          convosList.push({ id: doc.id, ...doc.data() } as Conversation);
        });
        
        // Sort by updatedAt descending
        convosList.sort((a, b) => b.updatedAt - a.updatedAt);
        setConversations(convosList);
      } catch (err) {
        console.error("Error fetching conversations:", err);
        setError("Failed to load conversations");
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [userProfile]);

  const toggleChatSelection = (id: string) => {
    const newSelection = new Set(selectedChats);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedChats(newSelection);
  };

  const getChatName = (convo: Conversation) => {
    if (convo.type === 'group') return convo.groupName || 'Unnamed Group';
    const otherId = convo.participants.find(id => id !== userProfile?.uid);
    return otherId && usersMap[otherId] ? usersMap[otherId].displayName : 'Saved Messages';
  };

  const getChatPhoto = (convo: Conversation) => {
    if (convo.type === 'group') {
      return convo.groupPhoto || '';
    }
    const otherId = convo.participants.find(id => id !== userProfile?.uid);
    return otherId && usersMap[otherId]?.photoURL 
      ? usersMap[otherId].photoURL 
      : '';
  };

  const filteredConversations = conversations.filter(c => {
    const name = getChatName(c).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const handleForward = async () => {
    if (!userProfile || selectedChats.size === 0 || selectedMessages.length === 0) return;
    setForwarding(true);
    
    try {
      // Sort messages chronologically just in case
      const messagesToForward = [...selectedMessages].sort((a, b) => a.timestamp - b.timestamp);

      for (const targetChatId of selectedChats) {
        let lastMessageText = '';
        
        for (const msg of messagesToForward) {
          const { id: _id, readBy: _readBy, deliveredTo: _deliveredTo, ...msgData } = msg;
          
          await addDoc(collection(db, `conversations/${targetChatId}/messages`), {
            ...msgData,
            senderId: userProfile.uid,
            timestamp: Date.now(),
            readBy: [userProfile.uid],
            forwarded: true
          });

          // Determine snippet for lastMessage
          if (msg.type === 'text') lastMessageText = msg.text;
          else if (msg.type === 'image') lastMessageText = '📷 Photo';
          else if (msg.type === 'video') lastMessageText = '🎥 Video';
          else if (msg.type === 'document') lastMessageText = '📄 Document';
          else if (msg.type === 'poll') lastMessageText = '📊 Poll';
          else if (msg.type === 'voice') lastMessageText = '🎤 Voice Message';
        }

        // Determine who needs unread count increments
        const targetConvo = conversations.find(c => c.id === targetChatId);
        const unreadIncrements: Record<string, any> = {};
        if (targetConvo) {
          targetConvo.participants.forEach(pid => {
            if (pid !== userProfile.uid) {
              unreadIncrements[`unreadCounts.${pid}`] = increment(messagesToForward.length);
            }
          });
        }

        // Update the target conversation document
        await updateDoc(doc(db, 'conversations', targetChatId), {
          lastMessage: lastMessageText,
          lastMessageTimestamp: Date.now(),
          updatedAt: Date.now(),
          ...unreadIncrements
        });
      }

      onForwardComplete(selectedChats.size);
    } catch (err: any) {
      console.error("Error forwarding messages:", err);
      setError("Failed to forward messages.");
      setForwarding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-sm rounded-2xl shadow-xl overflow-hidden border border-border flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            Forward to...
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border bg-surface-hover/30">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search chats..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-2">
          {error && <p className="text-destructive text-sm p-2 mb-2">{error}</p>}
          
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredConversations.map(c => (
                <li key={c.id}>
                  <label className="flex items-center p-2 rounded-xl hover:bg-surface-hover cursor-pointer transition-colors">
                    <div className="relative flex items-center justify-center w-5 h-5 mr-3">
                      <input 
                        type="checkbox" 
                        checked={selectedChats.has(c.id)}
                        onChange={() => toggleChatSelection(c.id)}
                        className="appearance-none w-5 h-5 border-2 border-muted rounded-full checked:bg-accent checked:border-accent transition-all cursor-pointer peer"
                      />
                      <Check className="w-3 h-3 text-accent-foreground absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                    </div>
                    <Avatar src={getChatPhoto(c)} alt="chat" className="w-10 h-10 mr-3" />
                    <span className="text-sm font-medium text-foreground truncate">{getChatName(c)}</span>
                  </label>
                </li>
              ))}
              {filteredConversations.length === 0 && (
                <p className="text-sm text-muted text-center py-8">No chats found.</p>
              )}
            </ul>
          )}
        </div>

        {/* Footer */}
        {selectedChats.size > 0 && (
          <div className="p-4 border-t border-border bg-surface-hover/30 flex justify-between items-center animate-in slide-in-from-bottom-2">
            <span className="text-sm font-medium text-muted-foreground">
              {selectedChats.size} chat{selectedChats.size !== 1 ? 's' : ''} selected
            </span>
            <button 
              onClick={handleForward}
              disabled={forwarding}
              className="px-5 py-2.5 bg-accent text-accent-foreground text-sm font-semibold rounded-xl hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all active:scale-95 flex items-center gap-2"
            >
              {forwarding ? 'Sending...' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
