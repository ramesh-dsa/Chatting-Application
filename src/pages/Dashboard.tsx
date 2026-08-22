import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import IconRail from '../components/IconRail';
import ChatWindow from '../components/ChatWindow';
import { MessageSquare } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import type { UserProfile } from '../types';

export default function Dashboard() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [searchMessageId, setSearchMessageId] = useState<string | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [isUsersLoaded, setIsUsersLoaded] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);

  useEffect(() => {
    const unsubscribeUsers = onValue(ref(db, 'users'), (snapshot) => {
      const map: Record<string, UserProfile> = {};
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          map[childSnapshot.key] = childSnapshot.val() as UserProfile;
        });
      }
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
    <div className="flex h-[100dvh] bg-background overflow-hidden pb-[60px] md:pb-0 relative">
      <IconRail 
        onProfileClick={() => setShowMyProfile(true)} 
        onChatsClick={() => setShowMyProfile(false)}
        activeTab={showMyProfile ? "profile" : "chats"}
      />

      {/* Sidebar - hidden on mobile if a chat is active */}
      <div className={`w-full md:w-[30%] md:min-w-[350px] md:max-w-[450px] flex-shrink-0 border-r border-border h-full ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        <Sidebar 
          activeConversationId={activeConversationId} 
          usersMap={usersMap}
          isUsersLoaded={isUsersLoaded}
          showMyProfile={showMyProfile}
          setShowMyProfile={setShowMyProfile}
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
