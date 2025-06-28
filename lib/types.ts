import { Timestamp } from 'firebase/firestore';

export type Category = 'restaurants' | 'movies' | 'books' | 'music' | 'travel' | 'other';

export interface Post {
  id: string;
  authorId: string;
  authorName: string; // Denormalized for better UX
  category: Category;
  title: string;
  description: string;
  createdAt: Timestamp;
  savedBy: string[]; // userIds who saved this
  
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
}

export interface User {
  id: string;
  name: string;
  email: string;
  following: string[]; // userIds
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

export const CATEGORIES: CategoryInfo[] = [
  { id: 'restaurants', name: 'Restaurants', emoji: '🍕' },
  { id: 'movies', name: 'Movies/TV', emoji: '🎬' },
  { id: 'books', name: 'Books', emoji: '📚' },
  { id: 'music', name: 'Music/Podcasts', emoji: '🎵' },
  { id: 'travel', name: 'Travel/Places', emoji: '✈️' },
  { id: 'other', name: 'Other', emoji: '✨' },
]; 