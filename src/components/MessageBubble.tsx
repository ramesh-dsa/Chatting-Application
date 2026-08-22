import React, { useEffect, useRef, memo } from 'react';
import { format } from 'date-fns';
import { Check as CheckIcon, CheckCheck, FileText, Download, ChevronDown, Forward, Copy, CheckSquare, SmilePlus, Reply, Pencil, Trash2, Phone, Video, PhoneMissed, Info } from 'lucide-react';
import type { Message, UserProfile } from '../types';
import PollDisplay from './PollDisplay';
import { Avatar } from './ui/Avatar';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// Safe helpers to prevent crashes when Firebase returns objects instead of sparse arrays
const safeIncludes = (data: any, val: string) => {
  if (!data) return false;
  if (Array.isArray(data)) return data.includes(val);
  if (typeof data === 'object') return Object.values(data).includes(val) || val in data;
  return false;
};

const safeLength = (data: any) => {
  if (!data) return 0;
  if (Array.isArray(data)) return data.filter(Boolean).length;
  if (typeof data === 'object') return Object.keys(data).length;
  return 0;
};

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
  onReact?: (messageId: string, emoji: string) => void;
  usersMap?: Record<string, UserProfile>;
  onReply?: (message: Message) => void;
  onEdit?: (messageId: string, newText: string) => void;
  onDelete?: (messageId: string, mode: 'me' | 'everyone') => void;
  onInfo?: (messageId: string) => void;

  conversationId: string;
  currentUserId: string;

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
  onSelectMode,
  onReact,
  usersMap = {},
  onReply,
  onEdit,
  onDelete,
  onInfo,

  conversationId,
  currentUserId,

}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = React.useState(false);
  
  const [menuPosition, setMenuPosition] = React.useState<'top' | 'bottom'>('bottom');
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [showReactPicker, setShowReactPicker] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(message.text);



  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-3 w-full">
        <span className="bg-black/5 text-muted-foreground text-xs px-3 py-1.5 rounded-full text-center">
          {message.text}
        </span>
      </div>
    );
  }

  if (message.type === 'call') {
    const isMissed = message.callStatus === 'missed';
    const isVideo = message.callType === 'video';
    const CallIcon = isMissed ? PhoneMissed : (isVideo ? Video : Phone);
    
    let callText = '';
    if (isMissed) {
      callText = isOwnMessage ? 'You missed a call' : 'Missed call';
    } else if (message.callStatus === 'ended') {
      const durationStr = message.duration ? `${Math.floor(message.duration / 60)}:${(message.duration % 60).toString().padStart(2, '0')}` : '0:00';
      callText = `${isVideo ? 'Video' : 'Voice'} call ended (${durationStr})`;
    } else if (message.callStatus === 'declined') {
      callText = 'Call declined';
    } else if (message.callStatus === 'busy') {
      callText = 'Line busy';
    }

    return (
      <div className="flex justify-center my-3 w-full">
        <div className="flex items-center gap-2 bg-black/5 text-muted-foreground px-4 py-2 rounded-full">
          <CallIcon className={`w-4 h-4 ${isMissed ? 'text-red-500' : ''}`} />
          <span className="text-sm font-medium">{callText}</span>
          <span className="text-xs opacity-70 ml-2">{format(message.timestamp, 'HH:mm')}</span>
        </div>
      </div>
    );
  }

  // Telegram style corner radius grouping logic
  let radiusClass = 'rounded-[12px]';
  if (isOwnMessage) {
    if (isFirstInGroup && !isLastInGroup) radiusClass = 'rounded-[12px] rounded-tr-[4px] rounded-br-[4px]';
    else if (!isFirstInGroup && !isLastInGroup) radiusClass = 'rounded-[12px] rounded-tr-[4px] rounded-br-[4px]';
    else if (!isFirstInGroup && isLastInGroup) radiusClass = 'rounded-[12px] rounded-tr-[4px]';
    else radiusClass = 'rounded-[12px] rounded-br-[4px]'; // alone message
  } else {
    if (isFirstInGroup && !isLastInGroup) radiusClass = 'rounded-[12px] rounded-tl-[4px] rounded-bl-[4px]';
    else if (!isFirstInGroup && !isLastInGroup) radiusClass = 'rounded-[12px] rounded-tl-[4px] rounded-bl-[4px]';
    else if (!isFirstInGroup && isLastInGroup) radiusClass = 'rounded-[12px] rounded-tl-[4px]';
    else radiusClass = 'rounded-[12px] rounded-bl-[4px]'; // alone message
  }

  if (message.deletedForEveryone) {
    return (
      <div className={`flex w-full mb-4 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
        <div className={`px-4 py-2 text-sm italic text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)] ${radiusClass} ${isOwnMessage ? 'bg-bg-msg-sent' : 'bg-surface'}`}>
          🚫 This message was deleted
        </div>
      </div>
    );
  }

  if (safeIncludes(message.deletedFor, currentUserId)) {
    return (
      <div className={`flex w-full mb-4 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
        <div className={`px-4 py-2 text-sm italic text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)] ${radiusClass} ${isOwnMessage ? 'bg-bg-msg-sent' : 'bg-surface'}`}>
          🚫 You deleted this message
        </div>
      </div>
    );
  }

  const marginBottom = isLastInGroup ? 'mb-4' : 'mb-[2px]';

  // Calculate message status ticks for own messages
  let tickState = 'sent'; // 'sent' | 'delivered' | 'read'
  if (isOwnMessage) {
    const otherParticipantCount = participantCount - 1;
    // msg.readBy includes the sender. Handle mixed type strings or objects and prevent duplicates from inflating counts.
    const getUniqueUids = (data: any) => {
      if (!data) return new Set();
      if (Array.isArray(data)) return new Set(data.map(r => typeof r === 'string' ? r : r.uid));
      if (typeof data === 'object') return new Set(Object.keys(data));
      return new Set();
    };
    const uniqueReaders = getUniqueUids(message.readBy);
    const readCount = Math.max(0, uniqueReaders.size - (uniqueReaders.has(message.senderId) ? 1 : 0));
    const deliveredCount = getUniqueUids(message.deliveredTo).size;

    if (readCount >= otherParticipantCount && otherParticipantCount > 0) {
      tickState = 'read';
    } else if (deliveredCount >= otherParticipantCount && otherParticipantCount > 0) {
      tickState = 'delivered';
    }
  }

    useEffect(() => {
    if (showMenu && bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 250) {
        setMenuPosition('top');
      } else {
        setMenuPosition('bottom');
      }
    }
  }, [showMenu]);

  const handleBubbleClick = () => {
    if (selectionMode) {
      if (message.type !== 'poll') {
        onToggleSelect?.(message.id);
      }
    } else {
      setShowMenu(!showMenu);
    }
  };

  const handlePlay = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audios = document.getElementsByTagName('audio');
    for (let i = 0; i < audios.length; i++) {
      if (audios[i] !== e.currentTarget) {
        audios[i].pause();
      }
    }
  };

  return (
    <div className={`flex w-full ${marginBottom} ${isOwnMessage ? 'justify-end' : 'justify-start'} ${selectionMode ? 'pl-2' : ''}`}>
      {selectionMode && (
        <div className="flex items-center justify-center mr-3 mt-auto mb-2" onClick={() => message.type !== 'poll' && onToggleSelect?.(message.id)}>
          {message.type !== 'poll' ? (
            <div className="relative flex items-center justify-center w-5 h-5 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isSelected || false}
                readOnly
                className="appearance-none w-5 h-5 border-2 border-muted rounded-full checked:bg-accent checked:border-accent transition-all cursor-pointer peer"
              />
              <CheckIcon className="w-3 h-3 text-accent-foreground absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
            </div>
          ) : (
            <div className="w-5 h-5" />
          )}
        </div>
      )}
      <div 
        className={`flex max-w-[85%] sm:max-w-[75%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} cursor-pointer`}
        onClick={handleBubbleClick}
      >
        
        {/* Avatar Spacer for grouped messages */}
        {!isOwnMessage && isGroupChat && !isLastInGroup && (
          <div className="w-8 mr-2 flex-shrink-0" />
        )}
        
        {/* Avatar on last message in group */}
        {!isOwnMessage && isGroupChat && isLastInGroup && (
          <Avatar 
            src={senderProfile?.photoURL || ''} 
            alt="avatar" 
            className="w-8 h-8 mt-auto mr-2 shadow-sm"
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
            onMouseLeave={() => { setShowMenu(false); setShowReactPicker(false); }}
            className={`pl-[9px] pr-[9px] pt-[6px] pb-[8px] relative group shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-500 ${radiusClass} ${
              isHighlighted || isSelected
                ? 'bg-accent/40 text-foreground ring-2 ring-accent ring-offset-2'
                : isOwnMessage 
                  ? 'bg-bg-msg-sent text-foreground' 
                  : 'bg-surface text-foreground'
            }`}
          >
            {/* Reply Quote */}
            {message.replyTo && (
              <div className={`mb-1.5 px-2 py-1 rounded-md border-l-2 ${isOwnMessage ? 'bg-black/5 border-emerald-600' : 'bg-black/5 border-accent'}`}>
                <p className="text-xs font-semibold text-emerald-600 truncate">{message.replyToSenderName || 'Message'}</p>
                <p className="text-xs text-muted-foreground truncate">{message.replyToText || ''}</p>
              </div>
            )}

            {/* Forwarded Label */}
            {message.forwarded && (
              <div className="flex items-center text-muted-foreground mb-1 text-[11px] italic">
                <Forward className="w-3 h-3 mr-1" />
                Forwarded
              </div>
            )}

            {isEditing ? (
              <div className="mb-1">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                  rows={2}
                  className="w-full text-sm bg-white/70 border border-border rounded-md px-2 py-1 outline-none focus:border-accent resize-none"
                />
                <div className="flex items-center justify-end gap-3 mt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(false);
                      setEditText(message.text);
                    }}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(message.id, editText);
                      setIsEditing(false);
                    }}
                    className="text-xs font-medium text-emerald-600 hover:underline"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : message.text && (
              <p className={`text-[14.2px] whitespace-pre-wrap break-words leading-[19px] relative ${message.attachmentUrl ? 'mb-2' : ''}`}>
                {message.text}
                {!message.attachmentUrl && !message.pollData && (
                  <span className="inline-block" style={{ width: message.edited ? '110px' : '75px' }} />
                )}
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
                ) : message.attachmentType === 'voice' ? (
                  <audio 
                    src={message.attachmentUrl} 
                    controls 
                    className="w-full min-w-[200px] h-10 mt-1" 
                    onPlay={handlePlay}
                  />
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

            {/* Poll Display */}
            {message.type === 'poll' && message.pollData && (
              <div className="mb-4">
                <PollDisplay 
                  message={message}
                  conversationId={conversationId}
                  currentUserId={currentUserId}
                  usersMap={usersMap}
                />
              </div>
            )}

            {/* Timestamp & Ticks placed absolutely at the bottom right of the bubble inner container */}
            <div className="absolute bottom-[4px] right-[8px] flex items-center justify-end gap-1 shrink-0 z-10">
              {message.edited && (
                <span className="text-[11px] text-muted italic">edited</span>
              )}
              <span className="text-[11px] text-muted opacity-80 mt-[1px]">
                {format(message.timestamp, 'h:mm a')}
              </span>
              {isOwnMessage && (
                <span className="flex items-center">
                  {tickState === 'read' ? (
                    <CheckCheck className="w-4 h-4 text-blue-500" />
                  ) : tickState === 'delivered' ? (
                    <CheckCheck className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <CheckIcon className="w-4 h-4 text-muted-foreground" />
                  )}
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
                className={`absolute top-1 right-1 p-0.5 rounded-full z-10 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ${
                  showMenu ? 'opacity-100' : ''
                } ${isOwnMessage ? 'bg-bg-msg-sent shadow-[0_0_6px_2px_rgba(227,242,253,0.8)] dark:shadow-[0_0_6px_2px_rgba(17,34,31,0.8)]' : 'bg-surface shadow-[0_0_6px_2px_rgba(255,255,255,0.8)] dark:shadow-[0_0_6px_2px_rgba(31,31,31,0.8)]'}`}
              >
                <ChevronDown className="w-4 h-4 bg-black/5 rounded-full" />
              </button>
            )}

            {/* Hover Reaction Button */}
            {!selectionMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReactPicker(!showReactPicker);
                }}
                className={`absolute top-1 right-6 p-0.5 rounded-full bg-black/5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ${showReactPicker ? 'opacity-100' : ''}`}
                title="React"
              >
                <SmilePlus className="w-4 h-4" />
              </button>
            )}

            {/* Reaction Emoji Picker */}
            {showReactPicker && (
              <div className="absolute bottom-8 right-1 bg-surface border border-border shadow-lg rounded-full py-1 px-1 z-50 flex items-center gap-0.5">
                {REACTION_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReact?.(message.id, emoji);
                      setShowReactPicker(false);
                    }}
                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-surface-hover rounded-full transition-transform hover:scale-110"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Dropdown Menu */}
            {showMenu && (
              <div className={`absolute ${menuPosition === 'top' ? 'bottom-full mb-1' : 'top-8'} right-2 bg-surface border border-border shadow-lg rounded-lg py-1 z-[100] min-w-[120px]`}>
                {message.type !== 'poll' && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
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
                )}
                {isOwnMessage && onInfo && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onInfo(message.id);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-surface-hover flex items-center gap-2 text-foreground"
                  >
                    <Info className="w-4 h-4" />
                    Info
                  </button>
                )}
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onReply?.(message);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-surface-hover flex items-center gap-2 text-foreground"
                >
                  <Reply className="w-4 h-4" />
                  Reply
                </button>
                {isOwnMessage && message.type === 'text' && !message.attachmentUrl && (Date.now() - message.timestamp) < 15 * 60 * 1000 && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      setEditText(message.text);
                      setIsEditing(true);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-surface-hover flex items-center gap-2 text-foreground"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                )}
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    if (window.confirm('Delete this message for yourself?')) {
                      onDelete?.(message.id, 'me');
                    }
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-surface-hover flex items-center gap-2 text-foreground"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete for me
                </button>
                {isOwnMessage && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      if (window.confirm('Delete this message for everyone?')) {
                        onDelete?.(message.id, 'everyone');
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-destructive/10 hover:text-destructive flex items-center gap-2 text-foreground"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete for everyone
                  </button>
                )}
                {message.type !== 'poll' && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
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
                )}
                {message.type !== 'poll' && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
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
                )}
              </div>
            )}
          </div>

          {/* Reaction Chips */}
          {!selectionMode && (Object.entries(message.reactions || {}).some(([, uids]) => safeLength(uids) > 0)) && (
            <div className={`flex flex-wrap items-center gap-1 mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(message.reactions || {})
                .filter(([, uids]) => safeLength(uids) > 0)
                .map(([emoji, uids]) => (
                  <button
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReact?.(message.id, emoji);
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border shadow-sm transition-colors ${
                      safeIncludes(uids, currentUserId) ? 'bg-accent/20 border-accent/50' : 'bg-surface border-border'
                    }`}
                  >
                    <span className="text-sm">{emoji}</span>
                    <span className="font-medium text-foreground/80">{safeLength(uids)}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(MessageBubble, (prev, next) => {
  return prev.message.id === next.message.id &&
         Object.keys(prev.message.readBy || {}).length === Object.keys(next.message.readBy || {}).length &&
         Object.keys(prev.message.deliveredTo || {}).length === Object.keys(next.message.deliveredTo || {}).length &&
         prev.isHighlighted === next.isHighlighted &&
         prev.selectionMode === next.selectionMode &&
         prev.isSelected === next.isSelected &&
         prev.isFirstInGroup === next.isFirstInGroup &&
         prev.isLastInGroup === next.isLastInGroup &&
         prev.senderProfile?.uid === next.senderProfile?.uid &&
         prev.senderProfile?.photoURL === next.senderProfile?.photoURL &&
         prev.senderProfile?.displayName === next.senderProfile?.displayName &&
         JSON.stringify(prev.message.pollData) === JSON.stringify(next.message.pollData) &&
         JSON.stringify(prev.message.reactions) === JSON.stringify(next.message.reactions) &&
         prev.message.text === next.message.text &&
         prev.message.edited === next.message.edited &&
         prev.message.deletedForEveryone === next.message.deletedForEveryone &&
         JSON.stringify(prev.message.deletedFor) === JSON.stringify(next.message.deletedFor);
});
