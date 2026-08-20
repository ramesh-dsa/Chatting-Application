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
  typing?: Record<string, number>; // uid -> last typing timestamp (ms)
}

export interface PollOption {
  id: string;
  text: string;
  voters: string[];
}

export interface PollData {
  question: string;
  options: PollOption[];
  multipleAnswers: boolean;
  isClosed?: boolean;
}

export interface Message {
  id: string; // Document ID
  senderId: string | null;
  text: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'document' | 'voice';
  attachmentName?: string;
  attachmentSize?: number;
  duration?: number; // Duration of voice note in seconds
  timestamp: number;
  readBy: string[]; // Array of UIDs
  deliveredTo?: string[]; // Array of UIDs
  type: 'text' | 'image' | 'video' | 'document' | 'system' | 'voice' | 'poll';
  forwarded?: boolean;
  pollData?: PollData;
  reactions?: Record<string, string[]>; // emoji -> array of UIDs who reacted
  replyTo?: string; // ID of the message being replied to
  replyToText?: string; // Denormalized snippet of the replied message
  replyToSenderName?: string; // Denormalized sender name of the replied message
  edited?: boolean;
  editedAt?: number;
  deletedForEveryone?: boolean;
  deletedFor?: string[]; // UIDs who deleted this message "for me"
}
