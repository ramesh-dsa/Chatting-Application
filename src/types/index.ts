export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  statusMessage: string;
  isOnline: boolean;
  lastSeen: number; // Unix timestamp
}

export interface Conversation {
  id: string; // Document ID
  type: 'direct' | 'group';
  participants: string[]; // Array of UIDs
  groupName?: string;
  groupPhoto?: string;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  updatedAt: number;
}

export interface Message {
  id: string; // Document ID
  senderId: string | null;
  text: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'file';
  timestamp: number;
  readBy: string[]; // Array of UIDs
  type: 'text' | 'image' | 'file' | 'system';
}
