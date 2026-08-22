import { useEffect, useState } from 'react';
import { ref, get, query as dbQuery, limitToLast } from 'firebase/database';
import { X, Loader2, Image as ImageIcon } from 'lucide-react';
import { db } from '../lib/firebase';
import type { Message } from '../types';

interface MediaGalleryModalProps {
  conversationId: string;
  currentUserId: string;
  onClose: () => void;
}

export default function MediaGalleryModal({ conversationId, currentUserId, onClose }: MediaGalleryModalProps) {
  const [media, setMedia] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Message | null>(null);

  useEffect(() => {
    let cancelled = false;
    const messagesRef = dbQuery(
      ref(db, `conversations/${conversationId}/messages`),
      limitToLast(500)
    );
    get(messagesRef).then((snapshot) => {
      if (cancelled) return;
      const items: Message[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const m = { id: childSnapshot.key, ...childSnapshot.val() } as Message;
          if (m.deletedForEveryone) return;
          if (m.deletedFor?.includes(currentUserId)) return;
          if (m.attachmentType === 'image' || m.attachmentType === 'video') {
            items.push(m);
          }
        });
      }
      items.sort((a, b) => b.timestamp - a.timestamp);
      setMedia(items);
      setLoading(false);
    }).catch((err) => {
      console.error("Failed to load media:", err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [conversationId, currentUserId]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface w-[95vw] sm:w-[90vw] md:max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="bg-accent/10 p-1.5 rounded-lg text-accent">
              <ImageIcon className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Media</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-hover text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : media.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No media in this chat yet</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {media.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPreview(m)}
                  className="aspect-square rounded-xl overflow-hidden bg-background border border-border hover:opacity-90 transition-opacity"
                >
                  {m.attachmentType === 'image' ? (
                    <img src={m.attachmentUrl} alt={m.attachmentName || 'image'} className="w-full h-full object-cover" />
                  ) : (
                    <video src={m.attachmentUrl} muted playsInline className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            onClick={(e) => { e.stopPropagation(); setPreview(null); }}
          >
            <X className="w-6 h-6" />
          </button>
          {preview.attachmentType === 'image' ? (
            <img
              src={preview.attachmentUrl}
              alt={preview.attachmentName || 'image'}
              className="max-w-full max-h-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <video
              src={preview.attachmentUrl}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}