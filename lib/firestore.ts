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
import { Post, User, Category } from './types';

export const createPost = async (
  authorId: string,
  authorName: string,
  category: Category,
  title: string,
  description: string
): Promise<string> => {
  try {
    const postData = {
      authorId,
      authorName,
      category,
      title,
      description,
      createdAt: Timestamp.now(),
      savedBy: [],
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

export const toggleSavePost = async (postId: string, userId: string, shouldSave: boolean) => {
  try {
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
      savedBy: shouldSave ? arrayUnion(userId) : arrayRemove(userId),
    });
  } catch (error) {
    console.error('Error toggling save post:', error);
    throw error;
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