// User types
export interface User {
  id: string;
  email?: string;
  phone?: string;
  fullName?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female';
  isActive?: boolean;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  lastActive?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserPublic {
  id: string;
  fullName?: string;
  lastActive?: Date;
}

// Photo types
export interface Photo {
  id: string;
  userId: string;
  url: string;
  publicId?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePhotoDto {
  url: string;
  publicId?: string;
  order?: number;
}

// Message types
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType?: 'text' | 'image' | 'video' | 'audio';
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendMessageDto {
  content: string;
  messageType?: 'text' | 'image' | 'video' | 'audio';
}

// Conversation types
export interface Conversation {
  conversationId: string;
  participant: UserPublic;
  lastMessage?: Message;
  unreadCount: number;
}

// RefreshToken types
export interface RefreshToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
