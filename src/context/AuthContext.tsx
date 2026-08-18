import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserProfile } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        let profileData: UserProfile;
        
        if (userSnap.exists()) {
          profileData = userSnap.data() as UserProfile;
          // Update online status
          await updateDoc(userRef, {
            isOnline: true,
            lastSeen: Date.now()
          });
          profileData.isOnline = true;
        } else {
          // Create basic profile on first login
          profileData = {
            uid: user.uid,
            displayName: user.displayName || 'New User',
            photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName || 'U'}`,
            statusMessage: "Hey there! I am using Firebase Chat.",
            isOnline: true,
            lastSeen: Date.now()
          };
          await setDoc(userRef, profileData);
        }
        setUserProfile(profileData);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
