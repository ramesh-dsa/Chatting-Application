import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { ref, get, set, update, onValue, off } from 'firebase/database';
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
    let unsubscribeDoc: (() => void) | undefined;
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false); // Unblock app immediately
      
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }

      if (user) {
        const userRef = ref(db, `users/${user.uid}`);
        const uid = user.uid;
        
        // Fetch profile and update presence in background
        get(userRef).then((snapshot) => {
          // Bail out if we unmounted or the signed-in user changed while fetching
          if (cancelled || auth.currentUser?.uid !== uid) return;

          let profileData: UserProfile;
          
          if (snapshot.exists()) {
            profileData = snapshot.val() as UserProfile;
            profileData.isOnline = true;
            setUserProfile(profileData);
            
            // Update online status
            update(userRef, {
              isOnline: true,
              lastSeen: Date.now()
            }).catch(console.error);
          } else {
            profileData = {
              uid: user.uid,
              displayName: user.displayName || 'New User',
              photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName || 'U'}`,
              statusMessage: "Hey there! I am using Firebase Chat.",
              isOnline: true,
              lastSeen: Date.now()
            };
            setUserProfile(profileData);
            set(userRef, profileData).catch(console.error);
          }

          if (cancelled || auth.currentUser?.uid !== uid) return;

          const onValueChange = onValue(userRef, (snap) => {
            if (snap.exists()) {
              setUserProfile(snap.val() as UserProfile);
            }
          });

          unsubscribeDoc = () => off(userRef, 'value', onValueChange);
        }).catch(console.error);
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
