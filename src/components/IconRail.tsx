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
import { Avatar } from "./ui/Avatar";
import GlassSurface from "./ui/GlassSurface";

interface IconRailProps {
  onProfileClick: () => void;
  onChatsClick: () => void;
  activeTab?: string;
  isHiddenOnMobile?: boolean;
}

export default function IconRail({ onProfileClick, onChatsClick, activeTab = "chats", isHiddenOnMobile }: IconRailProps) {
  const { currentUser, userProfile } = useAuth();
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
      icon: <MessageSquare className="w-[22px] h-[22px] md:w-6 md:h-6 shrink-0" />,
      onClick: onChatsClick
    },
    {
      id: "status",
      label: "Status",
      icon: <CircleDashed className="w-[22px] h-[22px] md:w-6 md:h-6 shrink-0" />,
      onClick: () => handleStubClick("Status")
    },
    {
      id: "voice",
      label: "Voice Call",
      icon: <Phone className="w-[22px] h-[22px] md:w-6 md:h-6 shrink-0" />,
      onClick: () => handleStubClick("Voice calling")
    },
    {
      id: "video",
      label: "Video Call",
      icon: <Video className="w-[22px] h-[22px] md:w-6 md:h-6 shrink-0" />,
      onClick: () => handleStubClick("Video calling")
    }
  ];

  const bottomLinks = [
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="w-[22px] h-[22px] md:w-6 md:h-6 shrink-0" />,
      onClick: () => handleStubClick("Settings")
    },
    {
      id: "profile",
      label: "Profile",
      icon: (userProfile?.photoURL || currentUser?.photoURL) ? (
        <Avatar
          src={userProfile?.photoURL || currentUser?.photoURL}
          className="w-7 h-7 md:w-8 md:h-8"
          alt={userProfile?.displayName || currentUser?.displayName || "Avatar"}
        />
      ) : (
        <div className="w-7 h-7 md:w-8 md:h-8 shrink-0 rounded-full bg-accent text-white flex items-center justify-center">
          <User className="w-4 h-4 md:w-5 md:h-5" />
        </div>
      ),
      onClick: onProfileClick
    }
  ];

  const renderIconBtn = (
    link: typeof links[0],
    isActive: boolean,
    isMobile: boolean
  ) => {
    // Desktop styling logic (with hover and deep glow)
    if (!isMobile) {
      return (
        <button
          key={link.id}
          onClick={link.onClick}
          className={`group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${
            isActive
              ? "text-accent bg-accent/10 shadow-[0_0_15px_rgba(0,168,132,0.15)] scale-100"
              : "text-muted-foreground motion-safe:hover:scale-[1.08] hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          {/* Active Indicator Line */}
          {isActive && (
            <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-1 h-8 bg-accent rounded-r-md transition-all duration-300 shadow-[0_0_8px_rgba(0,168,132,0.5)]" />
          )}

          <div className="relative z-10 transition-transform duration-200">
            {link.icon}
          </div>

          {/* CSS-only Tooltip */}
          <div className="absolute left-[calc(100%+14px)] px-3 py-1.5 bg-foreground/95 backdrop-blur-sm text-background text-sm font-medium rounded-md shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 -translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-[100]">
            {link.label}
            {/* Tooltip Arrow */}
            <div className="absolute top-1/2 -translate-y-1/2 -left-[4px] border-[5px] border-transparent border-r-foreground/95" />
          </div>
        </button>
      );
    }

    // Mobile styling logic (optimized for touch, simpler effects)
    return (
      <button
        key={link.id}
        onClick={link.onClick}
        className={`p-2 flex flex-col items-center gap-1 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${
          isActive
            ? "text-accent"
            : "text-muted-foreground active:scale-95"
        }`}
      >
        <div
          className={`p-1.5 transition-colors duration-200 ${
            isActive ? "bg-accent/15 rounded-full" : "bg-transparent rounded-full"
          }`}
        >
          {link.icon}
        </div>
      </button>
    );
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-[80px] left-1/2 -translate-x-1/2 md:bottom-auto md:top-6 md:left-[calc(clamp(64px,5vw,80px)+24px)] md:translate-x-0 break-words max-w-[calc(100vw-32px)] sm:max-w-xs bg-surface border border-border shadow-lg rounded-lg px-4 py-2 text-sm text-foreground animate-in fade-in z-[60]">
          {toastMessage}
        </div>
      )}

      {/* Unified Responsive Solid Container */}
      <div className={`${isHiddenOnMobile ? 'hidden md:flex' : 'flex'} fixed bottom-0 left-0 right-0 h-[60px] md:relative md:w-[clamp(64px,5vw,80px)] md:h-full md:flex-col md:bottom-auto md:left-auto md:right-auto z-50 md:z-[40] border-t md:border-t-0 md:border-r border-border/20 md:border-border/30 bg-bg-sidebar`}>
        {/* Mobile Layout (horizontal) */}
        <div className="flex md:hidden w-full h-full items-center justify-around px-2">
          {[...links, bottomLinks[0], bottomLinks[1]].map((link) =>
            renderIconBtn(link, activeTab === link.id, true)
          )}
        </div>

        {/* Desktop Layout (vertical) */}
        <div className="hidden md:flex flex-col w-full h-full">
          {/* Top Icons */}
          <div className="flex-1 flex flex-col py-6 gap-4 items-center">
            {links.map((link) =>
              renderIconBtn(link, activeTab === link.id, false)
            )}
          </div>

          {/* Bottom Icons */}
          <div className="pb-6 flex flex-col gap-4 items-center">
            {bottomLinks.map((link) =>
              renderIconBtn(link, activeTab === link.id, false)
            )}
          </div>
        </div>
      </div>
    </>
  );
}
