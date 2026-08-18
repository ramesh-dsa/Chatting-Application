import { useState, useEffect } from 'react';
import { X, Camera, Edit2, UserPlus, LogOut, Check } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { doc, updateDoc, arrayRemove, arrayUnion, collection, getDocs, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import type { Conversation, UserProfile } from '../types';
import { format } from 'date-fns';

interface GroupInfoPanelProps {
  conversation: Conversation;
  participants: Record<string, UserProfile>;
  onClose: () => void;
  onLeave: () => void;
}

export default function GroupInfoPanel({ conversation, participants, onClose, onLeave }: GroupInfoPanelProps) {
  const { userProfile } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(conversation.groupName || '');
  const [showAddMember, setShowAddMember] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const isAdmin = userProfile ? conversation.admins?.includes(userProfile.uid) : false;
  const creator = conversation.createdBy ? participants[conversation.createdBy] : null;

  useEffect(() => {
    if (showAddMember) {
      const fetchUsers = async () => {
        const snapshot = await getDocs(collection(db, 'users'));
        const usersList: UserProfile[] = [];
        snapshot.forEach(doc => {
          if (!conversation.participants.includes(doc.id)) {
            usersList.push(doc.data() as UserProfile);
          }
        });
        setAllUsers(usersList);
      };
      fetchUsers();
    }
  }, [showAddMember, conversation.participants]);

  const handleSystemMessage = async (text: string) => {
    await addDoc(collection(db, `conversations/${conversation.id}/messages`), {
      senderId: null,
      type: 'system',
      text,
      timestamp: Date.now(),
      readBy: []
    });
  };

  const handleUpdateName = async () => {
    if (!newName.trim() || newName.trim() === conversation.groupName) {
      setIsEditingName(false);
      return;
    }
    await updateDoc(doc(db, 'conversations', conversation.id), {
      groupName: newName.trim(),
      updatedAt: Date.now()
    });
    await handleSystemMessage(`${userProfile?.displayName} changed the group name to '${newName.trim()}'`);
    setIsEditingName(false);
  };

  const handleUpdatePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;

    try {
      setUploadingImage(true);
      const storageRef = ref(storage, `group-photos/${conversation.id}-${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await updateDoc(doc(db, 'conversations', conversation.id), {
        groupPhoto: url,
        updatedAt: Date.now()
      });
      await handleSystemMessage(`${userProfile?.displayName} changed the group photo`);
    } catch (error) {
      console.error("Error uploading photo:", error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveMember = async (uid: string, name: string) => {
    if (!isAdmin) return;
    if (!confirm(`Remove ${name} from group?`)) return;

    const isRemovedAdmin = conversation.admins?.includes(uid);
    const updates: any = {
      participants: arrayRemove(uid),
      updatedAt: Date.now()
    };
    if (isRemovedAdmin) {
      updates.admins = arrayRemove(uid);
    }

    await updateDoc(doc(db, 'conversations', conversation.id), updates);
    await handleSystemMessage(`${userProfile?.displayName} removed ${name}`);
  };

  const handleAddMember = async (uid: string, name: string) => {
    if (!isAdmin) return;
    await updateDoc(doc(db, 'conversations', conversation.id), {
      participants: arrayUnion(uid),
      updatedAt: Date.now()
    });
    await handleSystemMessage(`${userProfile?.displayName} added ${name}`);
    setShowAddMember(false);
  };

  const handleLeaveGroup = async () => {
    if (!userProfile) return;
    if (!confirm(`Leave '${conversation.groupName}'?`)) return;

    let updates: any = {
      participants: arrayRemove(userProfile.uid),
      updatedAt: Date.now()
    };

    const isUserAdmin = conversation.admins?.includes(userProfile.uid);
    let newAdmins = [...(conversation.admins || [])];
    
    if (isUserAdmin) {
      newAdmins = newAdmins.filter(id => id !== userProfile.uid);
      updates.admins = arrayRemove(userProfile.uid);
      
      // Auto-promote if sole admin
      if (newAdmins.length === 0) {
        const remainingParticipants = conversation.participants.filter(id => id !== userProfile.uid);
        if (remainingParticipants.length > 0) {
          const oldestMember = remainingParticipants[0];
          updates.admins = [oldestMember];
        }
      }
    }

    await updateDoc(doc(db, 'conversations', conversation.id), updates);
    await handleSystemMessage(`${userProfile.displayName} left`);
    onLeave();
  };

  if (showAddMember) {
    return (
      <div className="w-full md:w-[380px] h-full bg-surface border-l border-border flex flex-col shadow-xl z-20">
        <div className="h-16 flex items-center px-4 border-b border-border bg-surface shrink-0">
          <button onClick={() => setShowAddMember(false)} className="p-2 mr-2 text-muted-foreground hover:bg-background rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-foreground">Add Members</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {allUsers.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm mt-4">No new users to add.</p>
          ) : (
            allUsers.map(user => (
              <div key={user.uid} className="flex items-center justify-between p-2 hover:bg-background rounded-lg">
                <div className="flex items-center space-x-3">
                  <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full" />
                  <span className="text-sm font-medium text-foreground">{user.displayName}</span>
                </div>
                <button 
                  onClick={() => handleAddMember(user.uid, user.displayName)}
                  className="text-sm text-accent font-medium px-3 py-1 hover:bg-accent/10 rounded-full transition-colors"
                >
                  Add
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full md:w-[380px] h-full bg-surface border-l border-border flex flex-col shadow-xl z-20 overflow-y-auto">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border bg-surface shrink-0 sticky top-0 z-10">
        <h2 className="font-semibold text-foreground">Group Info</h2>
        <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-background rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Hero Section */}
      <div className="flex flex-col items-center p-6 bg-surface border-b border-border">
        <div className="relative group mb-4">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-accent/10 flex items-center justify-center">
            {conversation.groupPhoto ? (
              <img src={conversation.groupPhoto} alt="Group" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl text-accent font-semibold">{conversation.groupName?.charAt(0)}</span>
            )}
          </div>
          {isAdmin && (
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity">
              <Camera className="w-8 h-8 text-white" />
              <input type="file" className="hidden" accept="image/*" onChange={handleUpdatePhoto} disabled={uploadingImage} />
            </label>
          )}
        </div>

        {isEditingName ? (
          <div className="flex items-center space-x-2 w-full max-w-[250px]">
            <input 
              type="text" 
              value={newName} 
              onChange={e => setNewName(e.target.value)}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-1 text-center font-semibold focus:outline-none focus:border-accent"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleUpdateName()}
            />
            <button onClick={handleUpdateName} className="p-1.5 bg-accent text-white rounded-full"><Check className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-semibold text-foreground">{conversation.groupName}</h1>
            {isAdmin && (
              <button onClick={() => setIsEditingName(true)} className="p-1 text-muted-foreground hover:text-foreground">
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground mt-2 text-center">
          Group • {conversation.participants.length} members
        </p>
      </div>

      {/* Details */}
      <div className="p-4 bg-background mt-2 border-y border-border">
        <p className="text-sm text-muted-foreground">
          Created by {creator?.displayName || 'Unknown'} {conversation.createdAt && `on ${format(conversation.createdAt, 'd MMM yyyy')}`}
        </p>
      </div>

      {/* Members */}
      <div className="mt-2 bg-surface border-y border-border flex-1">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="text-sm font-semibold text-muted-foreground">Members</h3>
          <span className="text-xs font-medium text-muted-foreground bg-background px-2 py-1 rounded-full">
            {conversation.participants.length}
          </span>
        </div>

        {isAdmin && (
          <button 
            onClick={() => setShowAddMember(true)}
            className="w-full flex items-center space-x-4 p-4 hover:bg-background transition-colors border-b border-border"
          >
            <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="font-medium text-foreground">Add members</span>
          </button>
        )}

        <div className="flex flex-col">
          {conversation.participants.map(uid => {
            const participant = participants[uid];
            if (!participant) return null;
            const isParticipantAdmin = conversation.admins?.includes(uid);
            const isMe = userProfile?.uid === uid;

            return (
              <div key={uid} className="flex items-center justify-between p-4 hover:bg-background transition-colors group">
                <div className="flex items-center space-x-3">
                  <img src={participant.photoURL} alt={participant.displayName} className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {participant.displayName} {isMe && <span className="text-muted-foreground font-normal">(You)</span>}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-32">{participant.statusMessage}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {isParticipantAdmin && (
                    <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">Admin</span>
                  )}
                  {isAdmin && !isMe && (
                    <button 
                      onClick={() => handleRemoveMember(uid, participant.displayName)}
                      className="text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 p-1.5 rounded-md transition-all"
                      title="Remove member"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leave */}
      <div className="mt-2 mb-8 bg-surface border-y border-border">
        <button 
          onClick={handleLeaveGroup}
          className="w-full flex items-center space-x-4 p-4 hover:bg-red-50 transition-colors text-red-500"
        >
          <LogOut className="w-6 h-6" />
          <span className="font-semibold">Leave group</span>
        </button>
      </div>

    </div>
  );
}
