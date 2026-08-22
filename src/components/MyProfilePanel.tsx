import { useState } from 'react';
import { ArrowLeft, Camera, Edit2, Check } from 'lucide-react';
import { db } from '../lib/firebase';
import { ref, update } from 'firebase/database';
import { useAuth } from '../context/AuthContext';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import ImageCropperModal from './ImageCropperModal';
import { validatePassword, stripHTML } from '../utils/sanitize';
import { Avatar } from './ui/Avatar';

interface MyProfilePanelProps {
  onClose: () => void;
}

export default function MyProfilePanel({ onClose }: MyProfilePanelProps) {
  const { userProfile } = useAuth();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(userProfile?.displayName || '');
  
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [newAbout, setNewAbout] = useState(userProfile?.statusMessage || 'Hey there! I am using Chat.');
  
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const { currentUser } = useAuth();
  const isPasswordProvider = currentUser?.providerData.some(p => p.providerId === 'password');
  
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  const handleUpdateName = async () => {
    setProfileError('');
    if (!userProfile) return;
    
    let cleanedName = newName.trim();
    if (!cleanedName) {
      setProfileError('Display name is required');
      return;
    }
    if (cleanedName.length > 50) {
      setProfileError('Display name must be 50 characters or less');
      return;
    }
    cleanedName = stripHTML(cleanedName);
    
    if (cleanedName === userProfile.displayName) {
      setIsEditingName(false);
      return;
    }
    
    await update(ref(db, `users/${userProfile.uid}`), {
      displayName: cleanedName
    });
    setIsEditingName(false);
  };

  const handleUpdateAbout = async () => {
    setProfileError('');
    if (!userProfile) return;
    
    let cleanedAbout = newAbout.trim();
    if (!cleanedAbout) {
      setProfileError('Bio is required');
      return;
    }
    if (cleanedAbout.length > 150) {
      setProfileError('Bio must be 150 characters or less');
      return;
    }
    cleanedAbout = stripHTML(cleanedAbout);
    
    if (cleanedAbout === userProfile.statusMessage) {
      setIsEditingAbout(false);
      return;
    }
    
    await update(ref(db, `users/${userProfile.uid}`), {
      statusMessage: cleanedAbout
    });
    setIsEditingAbout(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setCropImageSrc(reader.result?.toString() || null);
    });
    reader.readAsDataURL(file);
    
    e.target.value = ''; // Reset input
  };

  const handleCropComplete = async (croppedFile: File) => {
    setCropImageSrc(null);
    if (!userProfile) return;

    try {
      setUploadingImage(true);
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary configuration missing");
      }

      const formData = new FormData();
      formData.append('file', croppedFile);
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

      await update(ref(db, `users/${userProfile.uid}`), {
        photoURL: url
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.email) return;

    setPasswordError('');
    setPasswordSuccess('');

    const { valid, errors } = validatePassword(newPassword);
    if (!valid) {
      setPasswordError(`Password must contain: ${errors.join(', ')}`);
      return;
    }

    setIsChangingPassword(true);

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      
      setPasswordSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess('');
      }, 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password. Please check your current password.');
    } finally {
      setIsChangingPassword(false);
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
          <div className="w-40 h-40 rounded-full overflow-hidden flex items-center justify-center border-2 border-border">
            {userProfile.photoURL ? (
              <Avatar 
                src={userProfile.photoURL} 
                alt="Profile" 
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full bg-accent/10 flex items-center justify-center">
                <span className="text-6xl text-accent font-semibold">{userProfile.displayName?.charAt(0)}</span>
              </div>
            )}
          </div>
          <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity">
            <Camera className="w-8 h-8 text-white mb-1" />
            <span className="text-white text-xs font-medium text-center px-4">
              {uploadingImage ? 'UPLOADING...' : 'CHANGE PROFILE PHOTO'}
            </span>
            <input 
              type="file" 
              id="profile-upload"
              className="hidden"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploadingImage}
            />
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
        
        {profileError && (
          <div className="mx-6 p-3 mb-2 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 text-center">
            {profileError}
          </div>
        )}

        {/* Profile Info */}
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
              <span className="text-foreground font-medium">{userProfile.statusMessage || 'Hey there! I am using Chat.'}</span>
              <button onClick={() => setIsEditingAbout(true)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Change Password Section (Only for Email/Password users) */}
        {isPasswordProvider && (
          <div className="bg-surface rounded-xl p-4 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-accent uppercase tracking-wider">Security</p>
              {!showPasswordForm && (
                <button 
                  onClick={() => setShowPasswordForm(true)}
                  className="text-xs font-medium text-accent hover:underline focus:outline-none"
                >
                  Change Password
                </button>
              )}
            </div>
            
            {showPasswordForm && (
              <form onSubmit={handleChangePassword} className="space-y-3 mt-3">
                {passwordError && (
                  <div className="bg-destructive/10 text-destructive text-xs p-2 rounded-lg border border-destructive/20">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="bg-green-500/10 text-green-500 text-xs p-2 rounded-lg border border-green-500/20">
                    {passwordSuccess}
                  </div>
                )}
                
                <div>
                  <input
                    type="password"
                    placeholder="Current Password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full text-sm bg-background border rounded-lg px-3 py-2 focus:ring-1 focus:ring-accent focus:border-transparent outline-none transition-shadow"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="New Password (min 6 chars)"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-sm bg-background border rounded-lg px-3 py-2 focus:ring-1 focus:ring-accent focus:border-transparent outline-none transition-shadow"
                  />
                </div>
                
                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordError('');
                      setPasswordSuccess('');
                      setCurrentPassword('');
                      setNewPassword('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword || !currentPassword || newPassword.length < 6}
                    className="px-3 py-1.5 text-xs font-medium bg-accent text-accent-foreground rounded-lg hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface focus:ring-accent disabled:opacity-50 transition-all"
                  >
                    {isChangingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {cropImageSrc && (
        <ImageCropperModal
          imageSrc={cropImageSrc}
          onClose={() => setCropImageSrc(null)}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}
