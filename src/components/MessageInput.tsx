import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Send, Smile, Plus, Image as ImageIcon, FileText, X, Mic, Trash2, ArrowLeft, Lock, ChevronUp, BarChart2 } from 'lucide-react';
import CreatePollModal from './CreatePollModal';
import type { Message, PollData } from '../types';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

interface MessageInputProps {
  onSendMessage: (text: string, file?: File | Blob | null, duration?: number, replyToMessage?: Message | null) => Promise<void>;
  onSendPoll?: (pollData: PollData) => Promise<void>;
  uploadProgress?: number | null;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  onTyping?: () => void;
  onStopTyping?: () => void;
}

export default function MessageInput({ onSendMessage, onSendPoll, uploadProgress, replyingTo, onCancelReply, onTyping, onStopTyping }: MessageInputProps) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [slideOffset, setSlideOffset] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  
  const recordingStateRef = useRef({
    isRecording: false,
    isLocked: false,
  });

  const onTypingRef = useRef(onTyping);
  onTypingRef.current = onTyping;
  const onStopTypingRef = useRef(onStopTyping);
  onStopTypingRef.current = onStopTyping;
  const lastTypingSentRef = useRef(0);

  // Throttled typing indicator (at most once every 2s)
  useEffect(() => {
    if (text.trim()) {
      const now = Date.now();
      if (now - lastTypingSentRef.current > 2000) {
        lastTypingSentRef.current = now;
        onTypingRef.current?.();
      }
    } else {
      onStopTypingRef.current?.();
    }
  }, [text]);

  // Clear typing status on unmount
  useEffect(() => {
    return () => onStopTypingRef.current?.();
  }, []);

  useEffect(() => {
    recordingStateRef.current = { isRecording, isLocked };
  }, [isRecording, isLocked]);

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
    // existing logic
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        alert("File size must be less than 20MB");
        return;
      }
      setSelectedFile(file);
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
    setShowAttachMenu(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!text.trim() && !selectedFile) || isSending || uploadProgress != null) return;
    
    const messageText = text.trim();
    const currentFile = selectedFile;

    setIsSending(true);

    try {
      await onSendMessage(messageText, currentFile, undefined, replyingTo);
      onStopTypingRef.current?.();
      lastTypingSentRef.current = 0;
      setText('');
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
      setShowPicker(false);
      clearFile();
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
      
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(cursorStart + emoji.length, cursorStart + emoji.length);
      }, 0);
    } else {
      setText(prev => prev + emoji);
    }
  };

  // ---------------------------------
  // Voice Recording Methods
  // ---------------------------------

  const startRecording = async (e: React.PointerEvent) => {
    if (text.trim() || selectedFile || isSending || uploadProgress != null) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setMicError(null);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setIsLocked(false);
      setSlideOffset(0);

      startXRef.current = e.clientX;
      startYRef.current = e.clientY;

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Add global listeners for drag & drop out of element
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    } catch (err) {
      console.error("Error accessing mic", err);
      setMicError("Microphone access denied.");
      setTimeout(() => setMicError(null), 3000);
    }
  };

  const stopMediaTracks = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    stopMediaTracks();
    cleanupRecordingState();
  };

  const sendRecording = () => {
    const currentDuration = recordingTime;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        if (currentDuration > 0 && audioBlob.size > 0) {
          try {
            await onSendMessage('', audioBlob, currentDuration);
          } catch (err) {
            console.error("Failed to send voice message:", err);
          }
        }
        stopMediaTracks();
      };
      recorder.stop();
    }
    cleanupRecordingState();
  };

  const cleanupRecordingState = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setIsLocked(false);
    setSlideOffset(0);
    setRecordingTime(0);
    mediaRecorderRef.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!recordingStateRef.current.isRecording || recordingStateRef.current.isLocked) return;

    const deltaX = e.clientX - startXRef.current;
    const deltaY = e.clientY - startYRef.current;

    if (deltaX < 0) {
      setSlideOffset(deltaX);
    }

    // Cancel threshold
    if (deltaX < -100) {
      cancelRecording();
      return;
    }

    // Lock threshold
    if (deltaY < -60) {
      setIsLocked(true);
      setSlideOffset(0);
    }
  };

  const handlePointerUp = () => {
    if (!recordingStateRef.current.isRecording) return;
    
    if (!recordingStateRef.current.isLocked) {
      sendRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ---------------------------------
  // Render
  // ---------------------------------

  return (
    <div className="w-full flex-shrink-0 px-2 sm:px-4 py-2.5 bg-bg-sidebar z-10 relative">
      
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
      {selectedFile && !isRecording && (
        <div className="mb-2 p-3 bg-white rounded-2xl shadow-sm border border-border relative animate-in slide-in-from-bottom-2 fade-in">
          <button 
            onClick={clearFile}
            className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-10"
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

      {micError && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-3 py-1.5 rounded-full shadow-md z-50">
          {micError}
        </div>
      )}

      {replyingTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-3xl shadow-sm mb-1 border-l-4 border-accent">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-accent truncate">Replying</p>
            <p className="text-sm text-muted-foreground truncate">
              {replyingTo.attachmentUrl ? '[Attachment]' : replyingTo.text || ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1.5 rounded-full hover:bg-black/5 text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 w-full">
        
        <div className="flex-1 flex items-end bg-surface rounded-3xl px-2 py-1 border border-border/50 focus-within:ring-1 focus-within:ring-accent/50 transition-all">
          {/* Left Side: Attachments and Emoji */}
          {!isRecording && (
            <div className="flex items-center gap-0.5 shrink-0 pb-0.5 pl-1 animate-in fade-in">
            {/* Attachment Menu */}
            <div className="relative" ref={attachMenuRef}>
              {showAttachMenu && (
                <div 
                  className="absolute bottom-[calc(100%+12px)] left-0 z-50 bg-white shadow-xl rounded-xl border border-border py-2 w-48 animate-in fade-in slide-in-from-bottom-2"
                  onMouseDown={(e) => e.stopPropagation()}
                >
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
                  <button 
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      setShowPollModal(true);
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-black/5 transition-colors text-left"
                  >
                    <div className="bg-green-100 text-green-600 p-2 rounded-full">
                      <BarChart2 className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">Poll</span>
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
        )}

        {/* Center: Textarea OR Recording UI */}
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between px-4 py-3 min-h-[44px] animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-3">
              {isLocked ? (
                <button type="button" onClick={cancelRecording} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              ) : (
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              )}
              <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
            </div>
            
            {!isLocked && (
              <div 
                className="flex items-center gap-2 text-muted-foreground text-sm flex-1 justify-end pr-8"
                style={{ opacity: Math.max(0, 1 - Math.abs(slideOffset) / 100) }}
              >
                <ArrowLeft className="w-4 h-4" />
                Slide to cancel
              </div>
            )}
          </div>
        ) : (
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
                handleSubmit();
              }
            }}
            rows={1}
            placeholder="Type a message"
            className="flex-1 bg-transparent border-none px-3 py-2.5 text-[15px] text-foreground focus:outline-none placeholder:text-muted resize-none overflow-y-auto min-h-[44px] max-h-[150px] leading-relaxed m-0"
            disabled={isSending || uploadProgress != null}
          />
        )}

        </div>

        {/* Right Side: Send/Mic Button */}
        <div className="shrink-0 flex items-center justify-center">
          {!isRecording && (
            <>
              <button 
                type="button"
                onPointerDown={startRecording}
                disabled={isSending || uploadProgress != null}
                className={`w-[44px] h-[44px] rounded-full flex items-center justify-center shadow-sm transition-all duration-200 bg-accent text-white hover:scale-105 active:scale-95 touch-none ${
                  (isSending || uploadProgress != null) ? 'opacity-50 cursor-not-allowed' : ''
                } ${text.trim() || selectedFile ? 'hidden' : 'block'}`}
              >
                <Mic className="w-5 h-5" />
              </button>
              <button 
                type="submit"
                disabled={(!text.trim() && !selectedFile) || isSending || uploadProgress != null}
                className={`w-[44px] h-[44px] rounded-full flex items-center justify-center shadow-sm transition-all duration-200 bg-accent text-white hover:scale-105 active:scale-95 ${
                  (!text.trim() && !selectedFile) || isSending || uploadProgress != null ? 'cursor-not-allowed hidden' : 'block'
                }`}
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            </>
          )}

          {isRecording && (
            <div 
              className={`w-[44px] h-[44px] rounded-full flex items-center justify-center shadow-sm transition-all duration-200 bg-accent text-white relative ${isLocked ? 'hover:scale-105 active:scale-95 cursor-pointer' : ''}`}
              style={{ transform: !isLocked ? `translate(${slideOffset}px, 0)` : 'none' }}
              onClick={isLocked ? sendRecording : undefined}
            >
              <Send className="w-5 h-5 ml-0.5" />
              {!isLocked && (
                <div className="absolute -top-12 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 text-accent">
                  <Lock className="w-4 h-4 mb-1" />
                  <ChevronUp className="w-4 h-4" />
                </div>
              )}
            </div>
          )}
        </div>
      </form>

      <CreatePollModal 
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onCreatePoll={async (pollData) => {
          if (onSendPoll) {
            await onSendPoll(pollData);
          }
        }}
      />
    </div>
  );
}
