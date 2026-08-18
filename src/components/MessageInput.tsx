import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Send, Smile, Plus, Image as ImageIcon, FileText, X } from 'lucide-react';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

interface MessageInputProps {
  onSendMessage: (text: string, file?: File | null) => Promise<void>;
  uploadProgress?: number | null;
}

export default function MessageInput({ onSendMessage, uploadProgress }: MessageInputProps) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Close menus on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPicker(false);
        setShowAttachMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
      setShowAttachMenu(false);
      
      // Auto-focus the input field so the user can immediately press Enter to send
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if ((!text.trim() && !selectedFile) || isSending) return;

    try {
      setIsSending(true);
      await onSendMessage(text, selectedFile);
      setText('');
      clearFile();
      setShowPicker(false);
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
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
    <div className="w-full flex-shrink-0 px-3 pb-3 pt-2 bg-transparent z-10 relative">
      
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={imageInputRef} 
        onChange={handleFileSelect} 
        accept="image/*,video/*" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={docInputRef} 
        onChange={handleFileSelect} 
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,application/*" 
        className="hidden" 
      />

      {/* File Preview */}
      {selectedFile && (
        <div className="mx-2 mb-2 bg-white rounded-2xl p-3 shadow-sm relative border border-border/50">
          <button 
            type="button"
            onClick={clearFile}
            className="absolute -top-2 -right-2 bg-surface border border-border shadow-md rounded-full p-1 hover:bg-muted text-muted-foreground transition-colors z-10"
            disabled={uploadProgress != null && uploadProgress > 0}
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-3">
            {previewUrl ? (
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/5 flex-shrink-0 relative">
                {selectedFile.type.startsWith('video/') ? (
                  <video src={previewUrl} className="w-full h-full object-cover" />
                ) : (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                )}
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600">
                <FileText className="w-8 h-8" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>

          {uploadProgress != null && (
            <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center backdrop-blur-[1px] z-20">
              <div className="w-3/4 max-w-xs">
                <div className="flex justify-between text-xs font-medium text-emerald-600 mb-1">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-black/10 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end bg-white rounded-3xl shadow-sm px-1.5 py-1">
        
        <div className="flex items-center gap-0.5 shrink-0 pb-0.5 pl-1">
          
          {/* Attachment Menu */}
          <div className="relative" ref={attachMenuRef}>
            {showAttachMenu && (
              <div className="absolute bottom-[calc(100%+12px)] left-0 z-50 bg-white shadow-xl rounded-xl border border-border py-2 w-48 animate-in fade-in slide-in-from-bottom-2">
                <button 
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-black/5 transition-colors text-left"
                >
                  <div className="bg-purple-100 text-purple-600 p-2 rounded-full">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium">Photos & Videos</span>
                </button>
                <button 
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-black/5 transition-colors text-left"
                >
                  <div className="bg-blue-100 text-blue-600 p-2 rounded-full">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium">Document</span>
                </button>
              </div>
            )}
            <button 
              type="button" 
              onClick={() => setShowAttachMenu(prev => !prev)}
              className={`p-2.5 rounded-full transition-colors flex items-center justify-center ${showAttachMenu ? 'bg-black/5 text-muted-foreground' : 'text-muted-foreground hover:bg-black/5'}`}
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          {/* Emoji Picker Popover */}
          <div className="relative" ref={containerRef}>
            {showPicker && (
              <div className="absolute bottom-[calc(100%+12px)] left-0 z-50 shadow-xl rounded-xl overflow-hidden border border-border">
                <Suspense fallback={<div className="w-[320px] h-[350px] flex items-center justify-center bg-white text-muted-foreground text-sm">Loading emojis...</div>}>
                  <EmojiPicker 
                    onEmojiClick={handleEmojiClick}
                    theme={'light' as any}
                    height={350}
                    width={320}
                    previewConfig={{ showPreview: false }}
                  />
                </Suspense>
              </div>
            )}
            <button 
              type="button" 
              onClick={() => setShowPicker(prev => !prev)}
              className={`p-2.5 rounded-full transition-colors flex items-center justify-center ${showPicker ? 'bg-black/5 text-muted-foreground' : 'text-muted-foreground hover:bg-black/5'}`}
            >
              <Smile className="w-6 h-6" />
            </button>
          </div>
        </div>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          rows={1}
          placeholder="Type a message"
          className="flex-1 bg-transparent border-none px-3 py-3 text-[15px] text-foreground focus:outline-none placeholder:text-muted-foreground/70 resize-none overflow-y-auto min-h-[44px] max-h-[150px] leading-relaxed m-0"
          disabled={isSending || uploadProgress != null}
        />

        <div className="shrink-0 pb-1 pr-1 flex items-center justify-center ml-1">
          <button 
            type="submit" 
            disabled={(!text.trim() && !selectedFile) || isSending || uploadProgress != null}
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 ${
              (text.trim() || selectedFile) 
                ? 'bg-accent text-white hover:scale-105 active:scale-95' 
                : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
            }`}
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
