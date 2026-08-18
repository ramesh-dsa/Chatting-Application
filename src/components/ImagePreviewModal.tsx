import React, { useEffect, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface ImagePreviewModalProps {
  url: string;
  senderName: string;
  timestamp: number;
  onClose: () => void;
  originalFileName?: string;
}

export default function ImagePreviewModal({ url, senderName, timestamp, onClose, originalFileName }: ImagePreviewModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = originalFileName || `image_${timestamp}.jpg`;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      // Optional: Add toast notification for failure here
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/90 flex flex-col"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div 
        className="w-full flex justify-between items-center px-4 py-4 bg-gradient-to-b from-black/50 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col text-white">
          <span className="font-semibold">{senderName}</span>
          <span className="text-xs opacity-75">{format(new Date(timestamp), 'h:mm a')}</span>
        </div>
        <div className="flex space-x-4 text-white">
          <button 
            onClick={handleDownload}
            disabled={isDownloading}
            className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
            title="Download"
          >
            {isDownloading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
          </button>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div className="flex-1 overflow-hidden p-4 flex items-center justify-center">
        <img 
          src={url} 
          alt="Preview" 
          className="max-w-full max-h-full object-contain drop-shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
