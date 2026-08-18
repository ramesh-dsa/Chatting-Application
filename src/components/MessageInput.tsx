import { useState, useRef, useEffect } from 'react';
import { Send, Smile } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';

interface MessageInputProps {
  onSendMessage: (text: string) => Promise<void>;
}

export default function MessageInput({ onSendMessage }: MessageInputProps) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close picker on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };
    
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showPicker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSending) return;

    try {
      setIsSending(true);
      await onSendMessage(text);
      setText('');
      setShowPicker(false);
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleEmojiClick = (emojiObject: any) => {
    const emoji = emojiObject.emoji;
    const input = inputRef.current;
    
    if (input) {
      const cursorStart = input.selectionStart || 0;
      const cursorEnd = input.selectionEnd || 0;
      
      const newText = text.substring(0, cursorStart) + emoji + text.substring(cursorEnd);
      setText(newText);
      
      // Restore cursor position and focus
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(cursorStart + emoji.length, cursorStart + emoji.length);
      }, 0);
    } else {
      setText(prev => prev + emoji);
    }
  };

  return (
    <div className="w-full flex-shrink-0 p-4 bg-surface border-t border-border">
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        
        <div className="relative" ref={containerRef}>
          {/* Emoji Picker Popover */}
          {showPicker && (
            <div className="absolute bottom-full left-0 mb-4 z-50 shadow-xl rounded-xl overflow-hidden border border-border">
              <EmojiPicker 
                onEmojiClick={handleEmojiClick}
                theme={Theme.LIGHT}
                height={350}
                width={320}
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}

          <button 
            type="button" 
            onClick={() => setShowPicker(prev => !prev)}
            className={`p-2 rounded-full transition-colors flex items-center justify-center ${showPicker ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground hover:bg-background'}`}
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-background border border-border rounded-full px-4 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          disabled={isSending}
        />

        <button 
          type="submit" 
          disabled={!text.trim() || isSending}
          className="p-2 bg-accent text-accent-foreground rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
