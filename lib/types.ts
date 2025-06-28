import { Timestamp } from 'firebase/firestore';

export type Category = 'restaurants' | 'movies' | 'books' | 'music' | 'travel';

export interface Post {
  id: string;
  authorId: string;
  authorName: string; // Denormalized for better UX
  category: Category;
  title: string;
  description: string;
  createdAt: Timestamp;
  savedBy: string[]; // userIds who saved this
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
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'restaurants', name: 'Restaurants', emoji: '🍕' },
  { id: 'movies', name: 'Movies/TV', emoji: '🎬' },
  { id: 'books', name: 'Books', emoji: '📚' },
  { id: 'music', name: 'Music/Podcasts', emoji: '🎵' },
  { id: 'travel', name: 'Travel/Places', emoji: '✈️' },
]; 