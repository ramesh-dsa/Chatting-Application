import { useState } from 'react';
import { ArrowLeft, Camera, Edit2, Check } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

interface MyProfilePanelProps {
  onClose: () => void;
}

export default function MyProfilePanel({ onClose }: MyProfilePanelProps) {
  const { userProfile } = useAuth();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(userProfile?.displayName || '');
  
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [newAbout, setNewAbout] = useState(userProfile?.about || 'Hey there! I am using Chat.');
  
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleUpdateName = async () => {
    if (!userProfile) return;
    if (!newName.trim() || newName.trim() === userProfile.displayName) {
      setIsEditingName(false);
      return;
    }
    
    await updateDoc(doc(db, 'users', userProfile.uid), {
      displayName: newName.trim()
    });
    setIsEditingName(false);
  };

  const handleUpdateAbout = async () => {
    if (!userProfile) return;
    if (!newAbout.trim()) return;
    
    await updateDoc(doc(db, 'users', userProfile.uid), {
      about: newAbout.trim()
    });
    setIsEditingAbout(false);
  };

  const handleUpdatePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;

    try {
      setUploadingImage(true);
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary configuration missing");
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      const url = data.secure_url;

      await updateDoc(doc(db, 'users', userProfile.uid), {
        photoURL: url
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
    } finally {
      setUploadingImage(false);
    }
  };

  if (!userProfile) return null;

  return (
    <div className="w-full h-full bg-surface flex flex-col z-20 overflow-y-auto">
      {/* Header */}
      <div className="h-16 flex items-center px-4 border-b border-border bg-surface shrink-0 sticky top-0 z-10">
        <button onClick={onClose} className="p-2 mr-2 text-muted-foreground hover:bg-background rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-foreground">Profile</h2>
      </div>

      {/* Hero Section */}
      <div className="flex flex-col items-center p-6 bg-surface">
        <div className="relative group mb-6">
          <div className="w-40 h-40 rounded-full overflow-hidden bg-accent/10 flex items-center justify-center border-2 border-border">
            {userProfile.photoURL ? (
              <img 
                src={userProfile.photoURL} 
                alt="Profile" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${userProfile.displayName || 'U'}`;
                }}
              />
            ) : (
              <span className="text-6xl text-accent font-semibold">{userProfile.displayName?.charAt(0)}</span>
            )}
          </div>
          <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity">
            <Camera className="w-8 h-8 text-white mb-1" />
            <span className="text-white text-xs font-medium text-center px-4">
              {uploadingImage ? 'UPLOADING...' : 'CHANGE PROFILE PHOTO'}
            </span>
            <input type="file" className="hidden" accept="image/*" onChange={handleUpdatePhoto} disabled={uploadingImage} />
          </label>
        </div>
      </div>

      {/* Details section */}
      <div className="flex-1 bg-background px-4 py-2 space-y-4">
        {/* Name Field */}
        <div className="bg-surface rounded-xl p-4 shadow-sm border border-border">
          <p className="text-xs font-semibold text-accent mb-1 uppercase tracking-wider">Your Name</p>
          {isEditingName ? (
            <div className="flex items-center space-x-2">
              <input 
                type="text" 
                value={newName} 
                onChange={e => setNewName(e.target.value)}
                className="flex-1 bg-transparent border-b-2 border-accent px-1 py-1 text-foreground font-medium focus:outline-none"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleUpdateName()}
              />
              <button onClick={handleUpdateName} className="p-1.5 text-accent hover:bg-accent/10 rounded-full transition-colors"><Check className="w-5 h-5" /></button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-foreground font-medium">{userProfile.displayName}</span>
              <button onClick={() => setIsEditingName(true)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            This is not your username or pin. This name will be visible to your contacts.
          </p>
        </div>

        {/* About Field */}
        <div className="bg-surface rounded-xl p-4 shadow-sm border border-border">
          <p className="text-xs font-semibold text-accent mb-1 uppercase tracking-wider">About</p>
          {isEditingAbout ? (
            <div className="flex items-center space-x-2">
              <input 
                type="text" 
                value={newAbout} 
                onChange={e => setNewAbout(e.target.value)}
                maxLength={139}
                className="flex-1 bg-transparent border-b-2 border-accent px-1 py-1 text-foreground font-medium focus:outline-none"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleUpdateAbout()}
              />
              <button onClick={handleUpdateAbout} className="p-1.5 text-accent hover:bg-accent/10 rounded-full transition-colors"><Check className="w-5 h-5" /></button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-foreground font-medium">{userProfile.about || 'Hey there! I am using Chat.'}</span>
              <button onClick={() => setIsEditingAbout(true)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
