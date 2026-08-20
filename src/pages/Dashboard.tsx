import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import { MessageSquare } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from '../types';

export default function Dashboard() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [searchMessageId, setSearchMessageId] = useState<string | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [isUsersLoaded, setIsUsersLoaded] = useState(false);

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const map: Record<string, UserProfile> = {};
      snapshot.forEach((doc) => {
        map[doc.id] = doc.data() as UserProfile;
      });
      setUsersMap(map);
      setIsUsersLoaded(true);
    });

    // Fallback safety timeout for user fetch
    const timeout = setTimeout(() => {
      setIsUsersLoaded(true);
    }, 3000);

    return () => {
      clearTimeout(timeout);
      unsubscribeUsers();
    };
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar - hidden on mobile if a chat is active */}
      <div className={`w-full md:w-[380px] flex-shrink-0 border-r border-border h-full ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        <Sidebar 
          activeConversationId={activeConversationId} 
          usersMap={usersMap}
          isUsersLoaded={isUsersLoaded}
          onSelectConversation={(id, msgId) => {
            setActiveConversationId(id);
            setSearchMessageId(msgId || null);
          }} 
        />
      </div>

      {/* Main Chat Area - hidden on mobile if NO chat is active */}
      <main className={`flex-1 flex flex-col min-w-0 h-full ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        {activeConversationId ? (
          <ChatWindow 
            conversationId={activeConversationId} 
            usersMap={usersMap}
            initialHighlightId={searchMessageId}
            onBack={() => {
              setActiveConversationId(null);
              setSearchMessageId(null);
            }} 
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-bg-chat w-full h-full">
            <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mb-6 shadow-sm border border-border">
              <MessageSquare className="w-10 h-10 text-muted-foreground opacity-50" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2 tracking-tight">Your Messages</h2>
            <p className="text-muted text-sm max-w-sm">
              Select a chat to start messaging
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
