import { useState, useEffect } from "react";
import {
  MessageSquare,
  CircleDashed,
  Phone,
  Video,
  Settings,
  User,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface IconRailProps {
  onProfileClick: () => void;
  onChatsClick: () => void;
  activeTab?: string;
}

export default function IconRail({ onProfileClick, onChatsClick, activeTab = "chats" }: IconRailProps) {
  const { currentUser } = useAuth();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleStubClick = (feature: string) => {
    setToastMessage(`${feature} isn't available yet`);
  };

  const links = [
    {
      id: "chats",
      label: "Chats",
      icon: <MessageSquare className="w-6 h-6 shrink-0" />,
      onClick: onChatsClick
    },
    {
      id: "status",
      label: "Status",
      icon: <CircleDashed className="w-6 h-6 shrink-0" />,
      onClick: () => handleStubClick("Status")
    },
    {
      id: "voice",
      label: "Voice Call",
      icon: <Phone className="w-6 h-6 shrink-0" />,
      onClick: () => handleStubClick("Voice calling")
    },
    {
      id: "video",
      label: "Video Call",
      icon: <Video className="w-6 h-6 shrink-0" />,
      onClick: () => handleStubClick("Video calling")
    }
  ];

  const bottomLinks = [
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="w-6 h-6 shrink-0" />,
      onClick: () => handleStubClick("Settings")
    },
    {
      id: "profile",
      label: "Profile",
      icon: currentUser?.photoURL ? (
        <img
          src={currentUser.photoURL}
          className="w-8 h-8 shrink-0 rounded-full object-cover"
          alt="Avatar"
        />
      ) : (
        <div className="w-8 h-8 shrink-0 rounded-full bg-accent text-white flex items-center justify-center">
          <User className="w-5 h-5" />
        </div>
      ),
      onClick: onProfileClick
    }
  ];

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 md:bottom-auto md:top-6 md:left-24 md:translate-x-0 whitespace-nowrap bg-surface border border-border shadow-lg rounded-lg px-4 py-2 text-sm text-foreground animate-in fade-in z-[60]">
          {toastMessage}
        </div>
      )}

      {/* Mobile Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-bg-sidebar border-t border-border flex items-center justify-around z-50">
        {[...links, bottomLinks[0], bottomLinks[1]].map((link) => {
          const isActive = activeTab === link.id;
          return (
            <button
              key={link.id}
              onClick={link.onClick}
              className={`p-2 flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-accent" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className={`${isActive ? "bg-accent/10 p-1.5 rounded-full" : "p-1.5"}`}>
                {link.icon}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop Static Icon Rail */}
      <div className="hidden md:flex flex-col w-[64px] flex-shrink-0 h-full bg-bg-sidebar border-r border-border z-[40]">
        
        {/* Top Icons */}
        <div className="flex-1 flex flex-col py-4 gap-3 items-center">
          {links.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={link.onClick}
                className={`group relative flex items-center justify-center w-12 h-12 rounded-xl transition-colors ${
                  isActive 
                    ? "text-accent bg-surface-hover" 
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                {/* Active Indicator Line */}
                {isActive && (
                  <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1 h-8 bg-accent rounded-r-md" />
                )}
                
                {link.icon}

                {/* CSS-only Tooltip */}
                <div className="absolute left-[calc(100%+12px)] px-3 py-1.5 bg-foreground text-background text-sm font-medium rounded-md shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-[100]">
                  {link.label}
                  {/* Tooltip Arrow */}
                  <div className="absolute top-1/2 -translate-y-1/2 -left-1 border-[5px] border-transparent border-r-foreground" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Icons */}
        <div className="pb-4 flex flex-col gap-3 items-center">
          {bottomLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={link.onClick}
                className={`group relative flex items-center justify-center w-12 h-12 rounded-xl transition-colors ${
                  isActive 
                    ? "text-accent bg-surface-hover" 
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                {/* Active Indicator Line */}
                {isActive && (
                  <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1 h-8 bg-accent rounded-r-md" />
                )}
                
                {link.icon}

                {/* CSS-only Tooltip */}
                <div className="absolute left-[calc(100%+12px)] px-3 py-1.5 bg-foreground text-background text-sm font-medium rounded-md shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-[100]">
                  {link.label}
                  {/* Tooltip Arrow */}
                  <div className="absolute top-1/2 -translate-y-1/2 -left-1 border-[5px] border-transparent border-r-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
