import { useState, useEffect } from 'react';
import ShinyText from '../components/ui/ShinyText';
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

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.chatOpen) {
        setActiveConversationId(e.state.conversationId);
      } else {
        setActiveConversationId(null);
        setSearchMessageId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectConversation = (id: string, msgId?: string) => {
    if (!activeConversationId) {
      window.history.pushState({ chatOpen: true, conversationId: id }, '');
    } else {
      window.history.replaceState({ chatOpen: true, conversationId: id }, '');
    }
    setActiveConversationId(id);
    setSearchMessageId(msgId || null);
  };

  const handleBack = () => {
    if (window.history.state?.chatOpen) {
      window.history.back();
    } else {
      setActiveConversationId(null);
      setSearchMessageId(null);
    }
  };

  return (
    <div className={`flex h-[100dvh] bg-background overflow-hidden relative ${activeConversationId ? 'pb-0' : 'pb-[60px] md:pb-0'}`}>
      <IconRail 
        onProfileClick={() => setShowMyProfile(true)} 
        onChatsClick={() => setShowMyProfile(false)}
        activeTab={showMyProfile ? "profile" : "chats"}
        isHiddenOnMobile={!!activeConversationId}
      />

      {/* Sidebar - hidden on mobile if a chat is active */}
      <div className={`w-full md:w-[30%] md:min-w-[350px] md:max-w-[450px] flex-shrink-0 border-r border-border h-full ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        <Sidebar 
          activeConversationId={activeConversationId} 
          usersMap={usersMap}
          isUsersLoaded={isUsersLoaded}
          showMyProfile={showMyProfile}
          setShowMyProfile={setShowMyProfile}
          onSelectConversation={(id, msgId) => handleSelectConversation(id, msgId || undefined)} 
        />
      </div>

      {/* Main Chat Area - hidden on mobile if NO chat is active */}
      <main className={`flex-1 flex flex-col min-w-0 h-full ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        {activeConversationId ? (
          <ChatWindow 
            conversationId={activeConversationId} 
            usersMap={usersMap}
            initialHighlightId={searchMessageId}
            onBack={handleBack} 
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface w-full h-full">
            <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mb-6 shadow-sm border border-border">
              <MessageSquare className="w-10 h-10 text-muted-foreground opacity-50" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2 tracking-tight">
              <ShinyText
                text="Let's Chat"
                speed={1.5}
                delay={0}
                color="#4b5563"
                shineColor="#9ca3af"
                spread={120}
                direction="left"
                yoyo={false}
                pauseOnHover={false}
                triggerOnHover={true}
              />
            </h2>
            <p className="text-muted text-sm max-w-sm">
              Select a chat to start messaging
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
