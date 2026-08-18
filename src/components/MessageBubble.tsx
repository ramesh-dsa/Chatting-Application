import React, { memo } from 'react';
import { format } from 'date-fns';
import { Check as CheckIcon, CheckCheck, FileText, Download, ChevronDown, Forward, Copy, CheckSquare } from 'lucide-react';
import type { Message, UserProfile } from '../types';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  senderProfile?: UserProfile;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isGroupChat: boolean;
  isHighlighted?: boolean;
  participantCount?: number;
  onImageClick?: (message: Message) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (messageId: string) => void;
  onForward?: (message: Message) => void;
  onCopy?: (message: Message) => void;
  onSelectMode?: (message: Message) => void;
}

const MessageBubble = function MessageBubble({ 
  message, 
  isOwnMessage, 
  senderProfile, 
  isFirstInGroup,
  isLastInGroup,
  isGroupChat,
  isHighlighted,
  participantCount = 2,
  onImageClick,
  selectionMode,
  isSelected,
  onToggleSelect,
  onForward,
  onCopy,
  onSelectMode
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = React.useState(false);

  const handleBubbleClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(message.id);
    }
  };

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-3 w-full">
        <span className="bg-black/5 text-muted-foreground text-xs px-3 py-1.5 rounded-full text-center">
          {message.text}
        </span>
      </div>
    );
  }

  // WhatsApp style corner radius grouping logic
  let radiusClass = 'rounded-2xl';
  if (isOwnMessage) {
    if (isFirstInGroup && !isLastInGroup) radiusClass = 'rounded-2xl rounded-tr-md rounded-br-sm';
    else if (!isFirstInGroup && !isLastInGroup) radiusClass = 'rounded-2xl rounded-tr-sm rounded-br-sm';
    else if (!isFirstInGroup && isLastInGroup) radiusClass = 'rounded-2xl rounded-tr-sm';
    else radiusClass = 'rounded-2xl rounded-br-sm'; // alone message
  } else {
    if (isFirstInGroup && !isLastInGroup) radiusClass = 'rounded-2xl rounded-tl-md rounded-bl-sm';
    else if (!isFirstInGroup && !isLastInGroup) radiusClass = 'rounded-2xl rounded-tl-sm rounded-bl-sm';
    else if (!isFirstInGroup && isLastInGroup) radiusClass = 'rounded-2xl rounded-tl-sm';
    else radiusClass = 'rounded-2xl rounded-bl-sm'; // alone message
  }

  const marginBottom = isLastInGroup ? 'mb-4' : 'mb-[2px]';

  // Calculate message status ticks for own messages
  let tickState = 'sent'; // 'sent' | 'delivered' | 'read'
  if (isOwnMessage) {
    const otherParticipantCount = participantCount - 1;
    // msg.readBy includes the sender
    const readCount = message.readBy ? message.readBy.length - 1 : 0;
    const deliveredCount = message.deliveredTo ? message.deliveredTo.length : 0;

    if (readCount >= otherParticipantCount && otherParticipantCount > 0) {
      tickState = 'read';
    } else if (deliveredCount >= otherParticipantCount && otherParticipantCount > 0) {
      tickState = 'delivered';
    }
  }

  return (
    <div className={`flex w-full ${marginBottom} ${isOwnMessage ? 'justify-end' : 'justify-start'} ${selectionMode ? 'pl-2' : ''}`}>
      {selectionMode && (
        <div className="flex items-center justify-center mr-3 mt-auto mb-2" onClick={() => onToggleSelect?.(message.id)}>
          <div className="relative flex items-center justify-center w-5 h-5 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isSelected || false}
              readOnly
              className="appearance-none w-5 h-5 border-2 border-muted rounded-full checked:bg-accent checked:border-accent transition-all cursor-pointer peer"
            />
            <CheckIcon className="w-3 h-3 text-accent-foreground absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
          </div>
        </div>
      )}
      <div 
        className={`flex max-w-[85%] sm:max-w-[75%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} ${selectionMode ? 'cursor-pointer' : ''}`}
        onClick={handleBubbleClick}
      >
        
        {/* Avatar Spacer for grouped messages */}
        {!isOwnMessage && isGroupChat && !isLastInGroup && (
          <div className="w-8 mr-2 flex-shrink-0" />
        )}
        
        {/* Avatar on last message in group */}
        {!isOwnMessage && isGroupChat && isLastInGroup && (
          <img 
            src={senderProfile?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${senderProfile?.displayName || 'U'}`} 
            alt="avatar" 
            className="w-8 h-8 rounded-full flex-shrink-0 mt-auto mr-2 shadow-sm"
          />
        )}

        {/* Bubble Container */}
        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
          {/* Sender Name (only on first message in a group chat) */}
          {!isOwnMessage && isGroupChat && isFirstInGroup && senderProfile && (
            <span className="text-xs font-medium text-emerald-600 ml-1 mb-1">{senderProfile.displayName}</span>
          )}
          
          <div 
            id={`msg-${message.id}`}
            onMouseLeave={() => setShowMenu(false)}
            className={`px-3 pt-2 pb-1.5 relative group shadow-sm transition-colors duration-500 ${radiusClass} ${
              isHighlighted || isSelected
                ? 'bg-accent/40 text-foreground ring-2 ring-accent ring-offset-2'
                : isOwnMessage 
                  ? 'bg-[#d9fdd3] text-[#111b21]' 
                  : 'bg-surface border border-border text-foreground'
            }`}
          >
            {/* Forwarded Label */}
            {message.forwarded && (
              <div className="flex items-center text-muted-foreground mb-1 text-[11px] italic">
                <Forward className="w-3 h-3 mr-1" />
                Forwarded
              </div>
            )}

            {message.text && (
              <p className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${message.attachmentUrl ? 'mb-2' : ''} mr-12`}>
                {message.text}
              </p>
            )}
            
            {/* Attachment placeholder */}
            {message.attachmentUrl && (
              <div className={`mt-1 mb-4 ${message.attachmentType === 'document' ? 'mr-0' : 'mr-4'}`}>
                {message.attachmentType === 'image' ? (
                  <img 
                    src={message.attachmentUrl} 
                    alt="attachment" 
                    className="rounded-lg max-w-full h-auto max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                    onClick={() => onImageClick?.(message)}
                  />
                ) : message.attachmentType === 'video' ? (
                  <video src={message.attachmentUrl} controls className="rounded-lg max-w-full h-auto max-h-64 object-cover" />
                ) : (
                  <a 
                    href={message.attachmentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`flex items-center gap-3 p-2.5 rounded-xl border ${isOwnMessage ? 'bg-black/5 border-black/10' : 'bg-surface border-border'} hover:opacity-80 transition-opacity`}
                  >
                    <div className={`${isOwnMessage ? 'bg-black/10 text-emerald-800' : 'bg-emerald-100 text-emerald-600'} p-2 rounded-lg flex-shrink-0`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-medium truncate">{message.attachmentName || 'Document'}</p>
                      {message.attachmentSize && (
                        <p className={`text-xs mt-0.5 ${isOwnMessage ? 'text-emerald-800/70' : 'text-muted-foreground'}`}>
                          {(message.attachmentSize / 1024 / 1024).toFixed(2)} MB
                        </p>
                      )}
                    </div>
                    <div className={`flex-shrink-0 p-1.5 rounded-full ${isOwnMessage ? 'bg-black/10 text-emerald-800' : 'bg-black/5 text-muted-foreground'}`}>
                      <Download className="w-4 h-4" />
                    </div>
                  </a>
                )}
              </div>
            )}

            {/* Floating Timestamp inside the bubble */}
            <div className="absolute bottom-1 right-2 flex items-center space-x-1">
              <span className="text-[10px] text-muted opacity-80 mt-1">
                {format(message.timestamp, 'h:mm a')}
              </span>
              {isOwnMessage && (
                <span className="ml-1 flex items-center">
                  {tickState === 'sent' && <CheckIcon className="w-3.5 h-3.5 text-muted-foreground/60" />}
                  {tickState === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-muted-foreground/60" />}
                  {tickState === 'read' && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
                </span>
              )}
            </div>

            {/* Hover Menu Button */}
            {!selectionMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className={`absolute top-1 right-1 p-0.5 rounded-full bg-black/5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ${showMenu ? 'opacity-100' : ''}`}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            )}

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute top-6 right-2 bg-surface border border-border shadow-lg rounded-lg py-1 z-50 min-w-[120px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onSelectMode?.(message);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-surface-hover flex items-center gap-2 text-foreground"
                >
                  <CheckSquare className="w-4 h-4" />
                  Select
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onCopy?.(message);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-surface-hover flex items-center gap-2 text-foreground"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onForward?.(message);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-surface-hover flex items-center gap-2 text-foreground"
                >
                  <Forward className="w-4 h-4" />
                  Forward
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(MessageBubble, (prev, next) => {
  return prev.message.id === next.message.id &&
         prev.message.readBy.length === next.message.readBy.length &&
         prev.message.deliveredTo?.length === next.message.deliveredTo?.length &&
         prev.isHighlighted === next.isHighlighted &&
         prev.selectionMode === next.selectionMode &&
         prev.isSelected === next.isSelected &&
         prev.isFirstInGroup === next.isFirstInGroup &&
         prev.isLastInGroup === next.isLastInGroup &&
         prev.senderProfile?.uid === next.senderProfile?.uid &&
         prev.senderProfile?.photoURL === next.senderProfile?.photoURL &&
         prev.senderProfile?.displayName === next.senderProfile?.displayName;
});
