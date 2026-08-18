import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import { MessageSquare } from 'lucide-react';

export default function Dashboard() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [searchMessageId, setSearchMessageId] = useState<string | null>(null);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar - hidden on mobile if a chat is active */}
      <div className={`w-full md:w-[380px] flex-shrink-0 border-r border-border h-full ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        <Sidebar 
          activeConversationId={activeConversationId} 
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
            initialHighlightId={searchMessageId}
            onBack={() => {
              setActiveConversationId(null);
              setSearchMessageId(null);
            }} 
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-chat-bg w-full h-full">
            <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mb-6 shadow-sm border border-border/50">
              <MessageSquare className="w-10 h-10 text-accent opacity-80" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Your Messages</h2>
            <p className="text-muted-foreground max-w-sm">
              Select a conversation from the sidebar or start a new chat.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
