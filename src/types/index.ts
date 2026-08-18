export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  statusMessage: string;
  about?: string;
  isOnline: boolean;
  lastSeen: number; // Unix timestamp
}

export interface Conversation {
  id: string; // Document ID
  type: 'direct' | 'group';
  participants: string[]; // Array of UIDs
  groupName?: string;
  groupPhoto?: string;
  description?: string;
  createdBy?: string;
  createdAt?: number;
  admins?: string[];
  lastMessage?: string;
  lastMessageTimestamp?: number;
  updatedAt: number;
  unreadCounts?: Record<string, number>;
}

export interface Message {
  id: string; // Document ID
  senderId: string | null;
  text: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'document';
  attachmentName?: string;
  attachmentSize?: number;
  timestamp: number;
  readBy: string[]; // Array of UIDs
  deliveredTo?: string[]; // Array of UIDs
  type: 'text' | 'image' | 'video' | 'document' | 'system';
  forwarded?: boolean;
}
