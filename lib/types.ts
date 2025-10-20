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
    genre?: string;
    runtime?: number;
    episodes?: number;
    seasons?: number;
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
  phoneNumber?: string; // Optional - user's phone number
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
  type: 'tagged' | 'rec_given' | 'comment' | 'post_liked' | 'followed';
  title: string;
  message: string;
  read: boolean;
  createdAt: Timestamp;
  data: {
    postId?: string;
    fromUserId?: string;
    fromUserName?: string;
    action?: string;
    tagId?: string;
    thingId?: string;
    thingTitle?: string;
    interactionId?: string;
  };
}

export interface NotificationPreferences {
  tagged: boolean;
  rec_given: boolean;
  comment: boolean;
  post_liked: boolean;
  followed: boolean;
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
  userName: string; // Denormalized for feed display
  thingId: string;
  state: UserThingInteractionState;
  date: Timestamp; // Last state change date
  visibility: 'private' | 'friends' | 'public';
  
  // Personal tracking (always present)
  rating?: number; // 1-5 star rating
  notes?: string;  // Private notes (never shown to others)
  
  // Public sharing fields (when visibility = public/friends)
  content?: string;        // Public comments/review (shown in feed)
  photos?: string[];       // Photo URLs (shown in feed)
  likedBy?: string[];      // userIds who liked (for feed engagement)
  commentCount?: number;   // Number of comments (denormalized)
  experiencedWith?: string[]; // User IDs of tagged users (for "experienced with" feature)
  
  // Metadata
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Recommendation {
  id: string;
  fromUserId: string; // User who made the recommendation
  toUserId: string;   // User who received the recommendation
  thingId: string;    // The thing being recommended
  date: Timestamp;
  message?: string;   // Optional message with the recommendation
}

// Feed data structure - groups interactions by thing
export interface FeedThing {
  thing: Thing;
  interactions: {
    completed: UserThingInteraction[];
    saved: UserThingInteraction[];
  };
  myInteraction?: UserThingInteraction;
  avgRating: number | null;
  mostRecentUpdate: Timestamp;
}

// Invitation system
export interface Invitation {
  id: string;              // The invite code (e.g., ABC123)
  inviterId: string;       // User ID of person sending invite
  inviterName: string;     // Display name
  inviterUsername: string; // Username (for @mentions)
  thingId: string;        // The thing being shared
  thingTitle: string;     // Denormalized for display
  interactionId?: string; // Optional: specific interaction being shared
  recipientName?: string; // Name of the person being invited (if known)
  createdAt: Timestamp;
  usedBy: string[];       // User IDs who clicked this link
  convertedUsers: string[]; // User IDs who signed up via this
}

// Tag system - for "Experienced With" feature
export interface Tag {
  id: string;
  sourceInteractionId: string;  // The original interaction (Alice's post)
  taggerId: string;              // Who created the tag (Alice)
  taggerName: string;
  taggedUserId: string;          // Who was tagged (Bob, or empty if non-user)
  taggedName: string;            // Display name
  taggedUserEmail?: string;      // For non-users
  thingId: string;
  thingTitle: string;            // Denormalized
  state: 'bucketList' | 'completed';  // Mirror from source
  rating?: number;               // Mirror from source
  status: 'pending' | 'accepted' | 'declined';
  inviteCode?: string;           // If tagged non-user, for SMS invite
  createdAt: Timestamp;
}

// DEPRECATED: PostV2 replaced by UserThingInteraction with visibility field
// This type is kept for backwards compatibility with store.ts
// Can be removed once postsV2 is removed from store
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
  interactionId: string;  // Links to UserThingInteraction (must have visibility: public/friends)
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