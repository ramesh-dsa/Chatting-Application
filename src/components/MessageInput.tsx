import { useState } from 'react';
import { Send, Smile } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (text: string) => Promise<void>;
}

export default function MessageInput({ onSendMessage }: MessageInputProps) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSending) return;

    try {
      setIsSending(true);
      await onSendMessage(text);
      setText('');
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full flex-shrink-0 p-4 bg-surface border-t border-border">
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <button 
          type="button" 
          className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-background transition-colors"
        >
          <Smile className="w-5 h-5" />
        </button>

        <input
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
