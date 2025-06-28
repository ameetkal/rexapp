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

export const CATEGORIES: CategoryInfo[] = [
  { id: 'restaurants', name: 'Restaurants', emoji: '🍕' },
  { id: 'movies', name: 'Movies/TV', emoji: '🎬' },
  { id: 'books', name: 'Books', emoji: '📚' },
  { id: 'music', name: 'Music/Podcasts', emoji: '🎵' },
  { id: 'travel', name: 'Travel/Places', emoji: '✈️' },
]; 