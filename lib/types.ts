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
    tmdbId?: string | number;  // For deduplication
    tmdbRating?: number;
    type?: 'movie' | 'tv';
    // Places
    address?: string;
    placeId?: string;  // For deduplication
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

// LEGACY: Keep for backward compatibility with old invite links
export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  category: Category;
  title: string;
  description: string;
  createdAt: Timestamp;
  savedBy: string[];
  recommendedBy?: string;
  recommendedByUserId?: string;
  rating?: number;
  photos?: string[];
  location?: string;
  priceRange?: '$' | '$$' | '$$$' | '$$$$';
  customPrice?: number;
  tags?: string[];
  experienceDate?: Timestamp;
  taggedUsers?: string[];
  taggedNonUsers?: { name: string; email?: string }[];
  universalItem?: UniversalItem;
  postType: 'structured' | 'manual';
}

// LEGACY: Keep for backward compatibility with old personal invite links
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
  recommendedBy?: string;
  recommendedByUserId?: string;
  rating?: number;
  photos?: string[];
  location?: string;
  priceRange?: '$' | '$$' | '$$$' | '$$$$';
  customPrice?: number;
  tags?: string[];
  experienceDate?: Timestamp;
  taggedUsers?: string[];
  taggedNonUsers?: { name: string; email?: string }[];
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

// NEW DATA MODEL INTERFACES

export interface Thing {
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
  createdAt: Timestamp;
  createdBy: string; // userId who first created this thing
}

export type UserThingInteractionState = 'bucketList' | 'inProgress' | 'completed';

export interface UserThingInteraction {
  id: string;
  userId: string;
  thingId: string;
  state: UserThingInteractionState;
  date: Timestamp; // Last state change date
  visibility: 'private' | 'friends' | 'public';
  rating?: number; // 1-5 star rating (only for completed items)
  notes?: string;  // Private notes
  linkedPostId?: string; // If user posted about it publicly
  createdAt: Timestamp;
}

export interface Recommendation {
  id: string;
  fromUserId: string; // User who made the recommendation
  toUserId: string;   // User who received the recommendation
  thingId: string;    // The thing being recommended
  date: Timestamp;
  message?: string;   // Optional message with the recommendation
}

// Updated Post interface to link to things
export interface PostV2 {
  id: string;
  authorId: string;
  authorName: string; // Denormalized for better UX
  thingId: string;    // Links to the thing
  content: string;    // User's description/review
  rating?: number;    // 1-5 star rating
  createdAt: Timestamp;
  likedBy: string[];  // userIds who liked this post
  commentCount?: number; // Denormalized count for performance
  
  // Enhanced optional fields
  photos?: string[]; // image URLs
  location?: string;
  priceRange?: '$' | '$$' | '$$$' | '$$$$';
  customPrice?: number;
  tags?: string[];
  experienceDate?: Timestamp;
  taggedUsers?: string[]; // userIds of tagged people
  taggedNonUsers?: { name: string; email?: string }[]; // for invites
}

// Comments on posts
export interface Comment {
  id: string;
  postId: string;         // Which post this comment is on
  authorId: string;       // User who wrote the comment
  authorName: string;     // Denormalized for display
  content: string;
  createdAt: Timestamp;
  likedBy: string[];      // userIds who liked this comment
  parentCommentId?: string; // For threaded replies (future)
}



export const CATEGORIES: CategoryInfo[] = [
  { id: 'places', name: 'Places', emoji: '📍' },
  { id: 'movies', name: 'Movies/TV', emoji: '🎬' },
  { id: 'books', name: 'Books', emoji: '📚' },
  { id: 'music', name: 'Music/Podcasts', emoji: '🎵' },
  { id: 'other', name: 'Other', emoji: '✨' },
]; 