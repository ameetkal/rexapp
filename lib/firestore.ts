import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';
import { Post, User, Category, PersonalItem, PersonalItemStatus } from './types';

export const createPost = async (
  authorId: string,
  authorName: string,
  category: Category,
  title: string,
  description?: string,
  enhancedFields?: {
    rating?: number;
    location?: string;
    priceRange?: '$' | '$$' | '$$$' | '$$$$';
    customPrice?: number;
    tags?: string[];
    experienceDate?: Date;
    taggedUsers?: string[];
    taggedNonUsers?: { name: string; email?: string }[];
    recommendedBy?: string;
  }
): Promise<string> => {
  try {
    const postData = {
      authorId,
      authorName,
      category,
      title,
      description: description || '',
      createdAt: Timestamp.now(),
      savedBy: [],
      // Include enhanced fields if provided
      ...(enhancedFields && {
        ...(enhancedFields.rating && { rating: enhancedFields.rating }),
        ...(enhancedFields.location && { location: enhancedFields.location }),
        ...(enhancedFields.priceRange && { priceRange: enhancedFields.priceRange }),
        ...(enhancedFields.customPrice && { customPrice: enhancedFields.customPrice }),
        ...(enhancedFields.tags && { tags: enhancedFields.tags }),
        ...(enhancedFields.experienceDate && { experienceDate: Timestamp.fromDate(enhancedFields.experienceDate) }),
        ...(enhancedFields.taggedUsers && { taggedUsers: enhancedFields.taggedUsers }),
        ...(enhancedFields.taggedNonUsers && { taggedNonUsers: enhancedFields.taggedNonUsers }),
        ...(enhancedFields.recommendedBy && { recommendedBy: enhancedFields.recommendedBy }),
      }),
    };
    
    const docRef = await addDoc(collection(db, 'posts'), postData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

export const getFeedPosts = async (followingIds: string[], currentUserId: string): Promise<Post[]> => {
  try {
    // Include current user's posts in the feed
    const allUserIds = [...new Set([...followingIds, currentUserId])];
    
    if (allUserIds.length === 0) return [];
    
    const q = query(
      collection(db, 'posts'),
      where('authorId', 'in', allUserIds),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];
    
    querySnapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() } as Post);
    });
    
    return posts;
  } catch (error) {
    console.error('Error getting feed posts:', error);
    return [];
  }
};

export const getSavedPosts = async (userId: string): Promise<Post[]> => {
  try {
    const q = query(
      collection(db, 'posts'),
      where('savedBy', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const posts: Post[] = [];
    
    querySnapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() } as Post);
    });
    
    return posts;
  } catch (error) {
    console.error('Error getting saved posts:', error);
    return [];
  }
};

export const savePostAsPersonalItem = async (
  post: Post,
  userId: string
): Promise<string> => {
  try {
    const personalItemData = {
      userId,
      category: post.category,
      title: post.title,
      description: post.description,
      status: 'want_to_try' as PersonalItemStatus,
      createdAt: Timestamp.now(),
      source: 'saved_from_post',
      originalPostId: post.id,
      originalAuthorId: post.authorId,
      originalAuthorName: post.authorName,
    };
    
    const docRef = await addDoc(collection(db, 'personal_items'), personalItemData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving post as personal item:', error);
    throw error;
  }
};

export const unsavePersonalItem = async (personalItemId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'personal_items', personalItemId), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: 'deleted' as any,
    });
  } catch (error) {
    console.error('Error unsaving personal item:', error);
    throw error;
  }
};

export const getPersonalItemByPostId = async (
  userId: string,
  postId: string
): Promise<PersonalItem | null> => {
  try {
    const q = query(
      collection(db, 'personal_items'),
      where('userId', '==', userId),
      where('originalPostId', '==', postId),
      where('status', '!=', 'deleted')
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as PersonalItem;
  } catch (error) {
    console.error('Error getting personal item by post ID:', error);
    return null;
  }
};

export const followUser = async (currentUserId: string, targetUserId: string) => {
  try {
    const userRef = doc(db, 'users', currentUserId);
    await updateDoc(userRef, {
      following: arrayUnion(targetUserId),
    });
  } catch (error) {
    console.error('Error following user:', error);
    throw error;
  }
};

export const unfollowUser = async (currentUserId: string, targetUserId: string) => {
  try {
    const userRef = doc(db, 'users', currentUserId);
    await updateDoc(userRef, {
      following: arrayRemove(targetUserId),
    });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    throw error;
  }
};

export const searchUsers = async (searchTerm: string): Promise<User[]> => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    const users: User[] = [];
    
    querySnapshot.forEach((doc) => {
      const user = doc.data() as User;
      if (user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          user.email.toLowerCase().includes(searchTerm.toLowerCase())) {
        users.push(user);
      }
    });
    
    return users;
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
};

// Personal Items Functions
export const createPersonalItem = async (
  userId: string,
  category: Category,
  title: string,
  description?: string,
  enhancedFields?: {
    rating?: number;
    location?: string;
    priceRange?: '$' | '$$' | '$$$' | '$$$$';
    customPrice?: number;
    tags?: string[];
    experienceDate?: Date;
    taggedUsers?: string[];
    taggedNonUsers?: { name: string; email?: string }[];
    recommendedBy?: string;
  }
): Promise<string> => {
  try {
    const itemData = {
      userId,
      category,
      title,
      description: description || '',
      status: 'want_to_try' as PersonalItemStatus,
      createdAt: Timestamp.now(),
      source: 'personal' as const,
      // Include enhanced fields if provided
      ...(enhancedFields && {
        ...(enhancedFields.rating && { rating: enhancedFields.rating }),
        ...(enhancedFields.location && { location: enhancedFields.location }),
        ...(enhancedFields.priceRange && { priceRange: enhancedFields.priceRange }),
        ...(enhancedFields.customPrice && { customPrice: enhancedFields.customPrice }),
        ...(enhancedFields.tags && { tags: enhancedFields.tags }),
        ...(enhancedFields.experienceDate && { experienceDate: Timestamp.fromDate(enhancedFields.experienceDate) }),
        ...(enhancedFields.taggedUsers && { taggedUsers: enhancedFields.taggedUsers }),
        ...(enhancedFields.taggedNonUsers && { taggedNonUsers: enhancedFields.taggedNonUsers }),
        ...(enhancedFields.recommendedBy && { recommendedBy: enhancedFields.recommendedBy }),
      }),
    };
    
    const docRef = await addDoc(collection(db, 'personal_items'), itemData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating personal item:', error);
    throw error;
  }
};

export const getPersonalItems = async (userId: string): Promise<PersonalItem[]> => {
  try {
    const q = query(
      collection(db, 'personal_items'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const items: PersonalItem[] = [];
    
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() } as PersonalItem);
    });
    
    return items;
  } catch (error) {
    console.error('Error getting personal items:', error);
    return [];
  }
};

export const updatePersonalItemStatus = async (
  itemId: string,
  status: PersonalItemStatus,
  sharedPostId?: string
): Promise<void> => {
  try {
    const itemRef = doc(db, 'personal_items', itemId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: { [key: string]: any } = {
      status,
    };
    
    if (status === 'completed') {
      updateData.completedAt = Timestamp.now();
    }
    
    if (sharedPostId) {
      updateData.sharedPostId = sharedPostId;
    }
    
    await updateDoc(itemRef, updateData);
  } catch (error) {
    console.error('Error updating personal item status:', error);
    throw error;
  }
};

export const deletePersonalItem = async (itemId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'personal_items', itemId), {
      // Mark as deleted instead of actually deleting for data integrity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: 'deleted' as any,
    });
  } catch (error) {
    console.error('Error deleting personal item:', error);
    throw error;
  }
};

export const sharePersonalItemAsPost = async (
  personalItem: PersonalItem,
  authorName: string,
  updatedDescription?: string
): Promise<string> => {
  try {
    // Create the post
    const postId = await createPost(
      personalItem.userId,
      authorName,
      personalItem.category,
      personalItem.title,
      updatedDescription || personalItem.description
    );
    
    // Update the personal item status
    await updatePersonalItemStatus(personalItem.id, 'shared', postId);
    
    return postId;
  } catch (error) {
    console.error('Error sharing personal item as post:', error);
    throw error;
  }
};

// Edit Functions
export const updatePost = async (
  postId: string,
  updates: {
    title?: string;
    description?: string;
    category?: Category;
    rating?: number;
    location?: string;
    priceRange?: '$' | '$$' | '$$$' | '$$$$';
    customPrice?: number;
    tags?: string[];
    experienceDate?: Date;
    taggedUsers?: string[];
    taggedNonUsers?: { name: string; email?: string }[];
    recommendedBy?: string;
  }
): Promise<void> => {
  try {
    const postRef = doc(db, 'posts', postId);
    const updateData: Record<string, string | number | Timestamp | string[] | { name: string; email?: string }[]> = {};
    
    // Only include fields that are provided
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.rating !== undefined) updateData.rating = updates.rating;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.priceRange !== undefined) updateData.priceRange = updates.priceRange;
    if (updates.customPrice !== undefined) updateData.customPrice = updates.customPrice;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.experienceDate !== undefined) updateData.experienceDate = Timestamp.fromDate(updates.experienceDate);
    if (updates.taggedUsers !== undefined) updateData.taggedUsers = updates.taggedUsers;
    if (updates.taggedNonUsers !== undefined) updateData.taggedNonUsers = updates.taggedNonUsers;
    if (updates.recommendedBy !== undefined) updateData.recommendedBy = updates.recommendedBy;
    
    await updateDoc(postRef, updateData);
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
};

export const updatePersonalItem = async (
  itemId: string,
  updates: {
    title?: string;
    description?: string;
    category?: Category;
    rating?: number;
    location?: string;
    priceRange?: '$' | '$$' | '$$$' | '$$$$';
    customPrice?: number;
    tags?: string[];
    experienceDate?: Date;
    taggedUsers?: string[];
    taggedNonUsers?: { name: string; email?: string }[];
    recommendedBy?: string;
  }
): Promise<void> => {
  try {
    const itemRef = doc(db, 'personal_items', itemId);
    const updateData: Record<string, string | number | Timestamp | string[] | { name: string; email?: string }[]> = {};
    
    // Only include fields that are provided
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.rating !== undefined) updateData.rating = updates.rating;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.priceRange !== undefined) updateData.priceRange = updates.priceRange;
    if (updates.customPrice !== undefined) updateData.customPrice = updates.customPrice;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.experienceDate !== undefined) updateData.experienceDate = Timestamp.fromDate(updates.experienceDate);
    if (updates.taggedUsers !== undefined) updateData.taggedUsers = updates.taggedUsers;
    if (updates.taggedNonUsers !== undefined) updateData.taggedNonUsers = updates.taggedNonUsers;
    if (updates.recommendedBy !== undefined) updateData.recommendedBy = updates.recommendedBy;
    
    await updateDoc(itemRef, updateData);
  } catch (error) {
    console.error('Error updating personal item:', error);
    throw error;
  }
}; 