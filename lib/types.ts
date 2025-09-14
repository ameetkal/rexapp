import { Timestamp } from 'firebase/firestore';

export type Category = 'places' | 'movies' | 'books' | 'music' | 'other';

export interface UniversalItem {
  id: string;
  title: string;
  category: Category;
  description?: string;
  image?: string;
  metadata: {
    // Books
    author?: string;
    isbn?: string;
    publishedDate?: string;
    pageCount?: number;
    // Movies/TV
    director?: string;
    year?: number;
    tmdbRating?: number;
    type?: 'movie' | 'tv';
    // Places
    address?: string;
    rating?: number;
    priceLevel?: 1 | 2 | 3 | 4;
    phoneNumber?: string;
    website?: string;
    placeType?: 'restaurant' | 'tourist_attraction' | 'lodging' | 'cafe' | 'bar' | 'store' | 'museum' | 'park' | 'other';
    // Music (future)
    artist?: string;
    album?: string;
  };
  source: 'google_books' | 'tmdb' | 'google_places' | 'spotify' | 'manual';
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string; // Denormalized for better UX
  category: Category;
  title: string;
  description: string;
  createdAt: Timestamp;
  savedBy: string[]; // userIds who saved this
  recommendedBy?: string; // Who recommended this item
  recommendedByUserId?: string; // User ID if recommendedBy is a Rex user
  
  // Enhanced optional fields
  rating?: number; // 1-10
  photos?: string[]; // image URLs
  location?: string;
  priceRange?: '$' | '$$' | '$$$' | '$$$$';
  customPrice?: number;
  tags?: string[];
  experienceDate?: Timestamp;
  taggedUsers?: string[]; // userIds of tagged people
  taggedNonUsers?: { name: string; email?: string }[]; // for invites
  
  // Universal item reference
  universalItem?: UniversalItem;
  postType: 'structured' | 'manual'; // Track which creation method was used
}

export interface User {
  id: string;
  name: string;
  email: string;
  username: string; // Required - auto-generated for new users
  following: string[]; // userIds
  followers: string[];
  createdAt: Timestamp;
  notificationPreferences?: NotificationPreferences;
}

export interface CategoryInfo {
  id: Category;
  name: string;
  emoji: string;
}

export type PersonalItemStatus = 'want_to_try' | 'completed' | 'shared';

export interface PersonalItem {
  id: string;
  userId: string;
  category: Category;
  title: string;
  description: string;
  status: PersonalItemStatus;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  sharedPostId?: string;
  source: 'personal' | 'saved_from_post';
  originalPostId?: string;
  originalAuthorId?: string;
  originalAuthorName?: string;
  recommendedBy?: string; // Who recommended this item
  recommendedByUserId?: string; // User ID if recommendedBy is a Rex user
  
  // Enhanced optional fields (same as Post)
  rating?: number; // 1-10
  photos?: string[]; // image URLs
  location?: string;
  priceRange?: '$' | '$$' | '$$$' | '$$$$';
  customPrice?: number;
  tags?: string[];
  experienceDate?: Timestamp;
  taggedUsers?: string[]; // userIds of tagged people
  taggedNonUsers?: { name: string; email?: string }[]; // for invites
}

export interface Notification {
  id: string;
  userId: string;
  type: 'tagged' | 'mentioned' | 'followed' | 'post_liked';
  title: string;
  message: string;
  read: boolean;
  createdAt: Timestamp;
  data: {
    postId?: string;
    fromUserId: string;
    fromUserName: string;
    action?: string;
  };
}

export interface NotificationPreferences {
  tagged: boolean;
  mentioned: boolean; 
  followed: boolean;
  post_liked: boolean;
  email_notifications: boolean;
}



export const CATEGORIES: CategoryInfo[] = [
  { id: 'places', name: 'Places', emoji: '📍' },
  { id: 'movies', name: 'Movies/TV', emoji: '🎬' },
  { id: 'books', name: 'Books', emoji: '📚' },
  { id: 'music', name: 'Music/Podcasts', emoji: '🎵' },
  { id: 'other', name: 'Other', emoji: '✨' },
]; 