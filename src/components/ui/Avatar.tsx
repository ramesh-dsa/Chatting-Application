import React, { useState, useEffect, useRef } from 'react';

interface AvatarProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  fallback?: string;
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
  return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
};

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 
    'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 
    'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 
    'bg-pink-500', 'bg-rose-500'
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export const Avatar: React.FC<AvatarProps> = ({ src, alt, className, fallback, ...props }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
    
    // Check if image is already loaded (e.g. from cache)
    if (imgRef.current?.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setIsLoaded(true);
      } else if (imgRef.current.naturalWidth === 0 && src) {
        // If it's complete but width is 0, it might be broken (unless it just hasn't rendered)
        // We'll let onError handle it if it's truly broken.
      }
    }
  }, [src]);

  const initials = fallback || getInitials(alt || 'U');
  const bgColor = getAvatarColor(alt || 'User');
  
  if (!src || hasError) {
    return (
      <div 
        className={`flex items-center justify-center text-white font-medium shrink-0 rounded-full ${bgColor} ${className}`}
        style={{ aspectRatio: '1/1' }}
        title={alt}
      >
        {initials}
      </div>
    );
  }

  return (
    <div className={`relative shrink-0 rounded-full ${className} overflow-hidden`} style={{ aspectRatio: '1/1' }}>
      {/* Show fallback while loading */}
      {!isLoaded && (
        <div className={`absolute inset-0 flex items-center justify-center text-white font-medium ${bgColor}`}>
          {initials}
        </div>
      )}
      <img
        key={src}
        ref={imgRef}
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        {...props}
      />
    </div>
  );
};
