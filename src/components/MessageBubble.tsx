import { format } from 'date-fns';
import type { Message, UserProfile } from '../types';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  senderProfile?: UserProfile;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isGroupChat: boolean;
}

export default function MessageBubble({ 
  message, 
  isOwnMessage, 
  senderProfile, 
  isFirstInGroup,
  isLastInGroup,
  isGroupChat
}: MessageBubbleProps) {
  
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

  return (
    <div className={`flex w-full ${marginBottom} ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] sm:max-w-[75%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
        
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
            className={`px-3 pt-2 pb-1.5 relative group shadow-sm ${radiusClass} ${
              isOwnMessage 
                ? 'bg-[#d9fdd3] text-[#111b21]' 
                : 'bg-surface border border-border text-foreground'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed mr-12">{message.text}</p>
            
            {/* Attachment placeholder */}
            {message.attachmentUrl && (
              <div className="mt-2 mb-1 mr-10">
                {message.attachmentType === 'image' ? (
                  <img src={message.attachmentUrl} alt="attachment" className="rounded-lg max-w-full h-auto max-h-64 object-cover" />
                ) : (
                  <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer" className="underline text-sm text-blue-600">
                    View File
                  </a>
                )}
              </div>
            )}

            {/* Floating Timestamp inside the bubble */}
            <div className="absolute bottom-1 right-2 flex items-center space-x-1">
              <span className="text-[10px] text-muted opacity-80 mt-1">
                {format(message.timestamp, 'HH:mm')}
              </span>
              {isOwnMessage && (
                <span className="text-[10px] text-emerald-600 font-medium">✓✓</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
