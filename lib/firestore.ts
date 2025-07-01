import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  writeBatch,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { Post, User, Category, PersonalItem, PersonalItemStatus, UniversalItem, Notification } from './types';

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
    recommendedByUserId?: string;
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
      postType: 'manual' as const,
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
        ...(enhancedFields.recommendedByUserId && { recommendedByUserId: enhancedFields.recommendedByUserId }),
      }),
    };
    
    const docRef = await addDoc(collection(db, 'posts'), postData);
    
    // Create notifications for tagged users
    if (enhancedFields?.taggedUsers && enhancedFields.taggedUsers.length > 0) {
      const postId = docRef.id;
      for (const taggedUserId of enhancedFields.taggedUsers) {
        await notifyTaggedUser(taggedUserId, authorId, authorName, postId, title);
      }
    }

    // Create notification for recommended by user
    if (enhancedFields?.recommendedByUserId) {
      const postId = docRef.id;
      await notifyRecommendedBy(enhancedFields.recommendedByUserId, authorId, authorName, postId, title);
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

export const getPost = async (postId: string): Promise<Post | null> => {
  try {
    const docRef = doc(db, 'posts', postId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Post;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting post:', error);
    return null;
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
      // Inherit the post author as the recommender
      recommendedBy: post.authorName,
      recommendedByUserId: post.authorId,
      // Copy any enhanced fields from the original post
      ...(post.rating && { rating: post.rating }),
      ...(post.location && { location: post.location }),
      ...(post.priceRange && { priceRange: post.priceRange }),
      ...(post.customPrice && { customPrice: post.customPrice }),
      ...(post.tags && { tags: post.tags }),
      ...(post.experienceDate && { experienceDate: post.experienceDate }),
      ...(post.taggedUsers && { taggedUsers: post.taggedUsers }),
      ...(post.taggedNonUsers && { taggedNonUsers: post.taggedNonUsers }),
    };
    
    const docRef = await addDoc(collection(db, 'personal_items'), personalItemData);
    
    // Update the post's savedBy array to include this user
    const postRef = doc(db, 'posts', post.id);
    await updateDoc(postRef, {
      savedBy: arrayUnion(userId)
    });
    
    // Create notification for post author (unless it's their own post)
    if (post.authorId !== userId) {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userName = userDoc.exists() ? userDoc.data().name : 'Someone';
        
        await createNotification(
          post.authorId,
          'post_liked',
          `${userName} saved your post!`,
          `"${post.title}"`,
          {
            postId: post.id,
            fromUserId: userId,
            fromUserName: userName
          }
        );
      } catch (error) {
        console.error('Error creating save notification:', error);
        // Don't fail the save operation if notification fails
      }
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error saving post as personal item:', error);
    throw error;
  }
};

export const unsavePersonalItem = async (personalItemId: string): Promise<void> => {
  try {
    // Get the personal item first to find the original post
    const personalItemDoc = await getDoc(doc(db, 'personal_items', personalItemId));
    if (!personalItemDoc.exists()) {
      throw new Error('Personal item not found');
    }
    
    const personalItem = personalItemDoc.data() as PersonalItem;
    
    // Soft delete the personal item
    await updateDoc(doc(db, 'personal_items', personalItemId), {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: 'deleted' as any,
    });
    
    // Remove user from post's savedBy array if there's an original post
    if (personalItem.originalPostId && personalItem.userId) {
      const postRef = doc(db, 'posts', personalItem.originalPostId);
      await updateDoc(postRef, {
        savedBy: arrayRemove(personalItem.userId)
      });
    }
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

    // Create notification for the followed user
    try {
      const followerDoc = await getDoc(doc(db, 'users', currentUserId));
      const followerName = followerDoc.exists() ? followerDoc.data().name : 'Someone';
      
      // Check if target user wants follow notifications (default to true if not set)
      const targetDoc = await getDoc(doc(db, 'users', targetUserId));
      const targetUser = targetDoc.exists() ? targetDoc.data() as User : null;
      
      if (targetUser?.notificationPreferences?.followed !== false) {
        await createNotification(
          targetUserId,
          'followed',
          `${followerName} started following you!`,
          `You have a new follower`,
          {
            fromUserId: currentUserId,
            fromUserName: followerName
          }
        );
      }
    } catch (error) {
      console.error('Error creating follow notification:', error);
      // Don't fail the follow operation if notification fails
    }
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

export const getUsersByIds = async (userIds: string[]): Promise<User[]> => {
  try {
    if (userIds.length === 0) return [];
    
    // Firestore has a limit of 10 items for 'in' queries, so we batch if needed
    const batchSize = 10;
    const batches: Promise<User[]>[] = [];
    
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batchIds = userIds.slice(i, i + batchSize);
      const batchPromise = getDocs(
        query(collection(db, 'users'), where('id', 'in', batchIds))
      ).then(querySnapshot => {
        const users: User[] = [];
        querySnapshot.forEach((doc) => {
          users.push(doc.data() as User);
        });
        return users;
      });
      batches.push(batchPromise);
    }
    
    const batchResults = await Promise.all(batches);
    return batchResults.flat();
  } catch (error) {
    console.error('Error getting users by IDs:', error);
    return [];
  }
};

export const searchUsers = async (searchTerm: string): Promise<User[]> => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    const users: User[] = [];
    
    console.log(`👥 Searching ${querySnapshot.size} users for: "${searchTerm}"`);
    
    querySnapshot.forEach((doc) => {
      const user = doc.data() as User;
      const nameMatch = user.name.toLowerCase().includes(searchTerm.toLowerCase());
      const emailMatch = user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (nameMatch || emailMatch) {
        console.log(`✅ User match: ${user.name}`, { nameMatch, emailMatch });
        users.push(user);
      }
    });
    
    console.log(`🎯 Found ${users.length} matching users`);
    return users;
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
};

export const searchPosts = async (searchTerm: string): Promise<Post[]> => {
  try {
    const postsRef = collection(db, 'posts');
    const querySnapshot = await getDocs(postsRef);
    const posts: Post[] = [];
    
    console.log(`🔍 Searching ${querySnapshot.size} posts for: "${searchTerm}"`);
    
    querySnapshot.forEach((doc) => {
      const post = doc.data() as Post;
      const searchLower = searchTerm.toLowerCase();
      
      // Search across title, description, location, tags, recommendedBy, category, and author
      const titleMatch = post.title.toLowerCase().includes(searchLower);
      const descMatch = post.description.toLowerCase().includes(searchLower);
      const locationMatch = post.location && post.location.toLowerCase().includes(searchLower);
      const tagsMatch = post.tags && post.tags.some(tag => tag.toLowerCase().includes(searchLower));
      const recommendedByMatch = post.recommendedBy && post.recommendedBy.toLowerCase().includes(searchLower);
      const categoryMatch = post.category.toLowerCase().includes(searchLower);
      const authorMatch = post.authorName.toLowerCase().includes(searchLower);
      
      const matchesSearch = titleMatch || descMatch || locationMatch || tagsMatch || recommendedByMatch || categoryMatch || authorMatch;
      
      if (matchesSearch) {
        console.log(`✅ Match found: "${post.title}" by ${post.authorName}`, {
          title: titleMatch ? post.title : null,
          description: descMatch ? post.description : null,
          category: categoryMatch ? post.category : null,
          author: authorMatch ? post.authorName : null,
          location: locationMatch ? post.location : null,
          tags: tagsMatch ? post.tags : null,
          recommendedBy: recommendedByMatch ? post.recommendedBy : null
        });
        posts.push({ ...post, id: doc.id } as Post);
      }
    });
    
    // Sort by creation date, newest first
    const sortedPosts = posts.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    console.log(`🎯 Found ${sortedPosts.length} matching posts`);
    return sortedPosts;
  } catch (error) {
    console.error('Error searching posts:', error);
    return [];
  }
};

export const universalSearch = async (searchTerm: string): Promise<{
  posts: Post[];
  users: User[];
}> => {
  try {
    const [posts, users] = await Promise.all([
      searchPosts(searchTerm),
      searchUsers(searchTerm)
    ]);
    
    return {
      posts: posts.slice(0, 10), // Limit to top 10 posts
      users: users.slice(0, 5)   // Limit to top 5 users
    };
  } catch (error) {
    console.error('Error in universal search:', error);
    return { posts: [], users: [] };
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
    recommendedByUserId?: string;
  },
  linkToPost?: {
    postId: string;
    authorId: string;
    authorName: string;
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
      source: linkToPost ? 'saved_from_post' as const : 'personal' as const,
      // Link to original post if provided
      ...(linkToPost && {
        originalPostId: linkToPost.postId,
        originalAuthorId: linkToPost.authorId,
        originalAuthorName: linkToPost.authorName,
        // For structured posts, also set sharedPostId so edits sync
        sharedPostId: linkToPost.postId,
      }),
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
        ...(enhancedFields.recommendedByUserId && { recommendedByUserId: enhancedFields.recommendedByUserId }),
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

export const getPersonalItem = async (itemId: string): Promise<PersonalItem | null> => {
  try {
    const docRef = doc(db, 'personal_items', itemId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as PersonalItem;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting personal item:', error);
    return null;
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
    status?: PersonalItemStatus;
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
    if (updates.status !== undefined) updateData.status = updates.status;
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

// Google Books API Integration
export const searchGoogleBooks = async (query: string): Promise<UniversalItem[]> => {
  try {
    if (!query.trim()) return [];
    
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&printType=books`
    );
    
    if (!response.ok) {
      console.error('Google Books API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.items) return [];
    
    const books: UniversalItem[] = data.items.map((item: {
      id: string;
      volumeInfo: {
        title?: string;
        authors?: string[];
        description?: string;
        publishedDate?: string;
        pageCount?: number;
        imageLinks?: { thumbnail?: string };
        industryIdentifiers?: Array<{ type: string; identifier: string }>;
      };
    }) => {
      const volumeInfo = item.volumeInfo;
      return {
        id: item.id,
        title: volumeInfo.title || 'Unknown Title',
        category: 'books' as Category,
        description: volumeInfo.description ? 
          volumeInfo.description.substring(0, 200) + (volumeInfo.description.length > 200 ? '...' : '') : 
          undefined,
        image: volumeInfo.imageLinks?.thumbnail,
        metadata: {
          author: volumeInfo.authors ? volumeInfo.authors.join(', ') : undefined,
          isbn: volumeInfo.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier,
          publishedDate: volumeInfo.publishedDate,
          pageCount: volumeInfo.pageCount,
        },
        source: 'google_books' as const,
      };
    });
    
    console.log(`📚 Found ${books.length} books for "${query}"`);
    return books;
  } catch (error) {
    console.error('Error searching Google Books:', error);
    return [];
  }
};

// Google Places API Integration
export const searchGooglePlaces = async (query: string): Promise<UniversalItem[]> => {
  try {
    if (!query.trim()) return [];
    
    // Call our Next.js API route instead of Google Places directly
    const response = await fetch(`/api/places?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      console.error('Places API route error:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.results) {
      console.error('No results from Places API');
      return [];
    }
    
    const places: UniversalItem[] = data.results.slice(0, 8).map((place: {
      place_id: string;
      name: string;
      formatted_address?: string;
      rating?: number;
      price_level?: number;
      photos?: Array<{ photo_reference: string }>;
      types?: string[];
      website?: string;
      formatted_phone_number?: string;
    }) => {
      // Determine place type from Google's types array
      const getPlaceType = (types: string[] = []): string => {
        if (types.includes('restaurant') || types.includes('food') || types.includes('meal_takeaway')) return 'restaurant';
        if (types.includes('tourist_attraction') || types.includes('point_of_interest')) return 'tourist_attraction';
        if (types.includes('lodging')) return 'lodging';
        if (types.includes('cafe')) return 'cafe';
        if (types.includes('bar') || types.includes('night_club')) return 'bar';
        if (types.includes('store') || types.includes('shopping_mall')) return 'store';
        if (types.includes('museum')) return 'museum';
        if (types.includes('park')) return 'park';
        return 'other';
      };
      
      // Photos are disabled for now to avoid exposing API keys
      // TODO: Create a photo proxy API route to handle this securely
      
      return {
        id: place.place_id,
        title: place.name,
        category: 'places' as Category,
        description: place.formatted_address,
        image: undefined, // Photos disabled for now - TODO: Create photo proxy API route
        metadata: {
          address: place.formatted_address,
          rating: place.rating ? Math.round(place.rating * 10) / 10 : undefined,
          priceLevel: place.price_level ? (place.price_level as 1 | 2 | 3 | 4) : undefined,
          phoneNumber: place.formatted_phone_number,
          website: place.website,
          placeType: getPlaceType(place.types) as 'restaurant' | 'tourist_attraction' | 'lodging' | 'cafe' | 'bar' | 'store' | 'museum' | 'park' | 'other',
        },
        source: 'google_places' as const,
      };
    });
    
    console.log(`📍 Found ${places.length} places for "${query}"`);
    return places;
  } catch (error) {
    console.error('Error searching Google Places:', error);
    return [];
  }
};

// TMDb API Integration
export const searchTMDb = async (query: string): Promise<UniversalItem[]> => {
  try {
    if (!query.trim()) return [];
    
    // Get API key from environment variables
    const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    const BASE_URL = 'https://api.themoviedb.org/3';
    
    if (!API_KEY) {
      console.error('TMDb API key not configured. Please add NEXT_PUBLIC_TMDB_API_KEY to your .env.local file');
      return [];
    }
    
    // Search both movies and TV shows
    const [movieResponse, tvResponse] = await Promise.all([
      fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=1`),
      fetch(`${BASE_URL}/search/tv?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=1`)
    ]);
    
    if (!movieResponse.ok || !tvResponse.ok) {
      console.error('TMDb API error:', movieResponse.status, tvResponse.status);
      return [];
    }
    
    const [movieData, tvData] = await Promise.all([
      movieResponse.json(),
      tvResponse.json()
    ]);
    
    const movies = (movieData.results || []).slice(0, 5).map((movie: {
      id: number;
      title: string;
      overview?: string;
      release_date?: string;
      poster_path?: string;
      vote_average?: number;
      genre_ids?: number[];
    }) => ({
      id: `movie-${movie.id}`,
      title: movie.title,
      category: 'movies' as Category,
      description: movie.overview ? 
        movie.overview.substring(0, 200) + (movie.overview.length > 200 ? '...' : '') : 
        undefined,
      image: movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : undefined,
      metadata: {
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined,
        tmdbRating: movie.vote_average ? Math.round(movie.vote_average * 10) / 10 : undefined,
        type: 'movie',
      },
      source: 'tmdb' as const,
    }));
    
    const tvShows = (tvData.results || []).slice(0, 5).map((show: {
      id: number;
      name: string;
      overview?: string;
      first_air_date?: string;
      poster_path?: string;
      vote_average?: number;
    }) => ({
      id: `tv-${show.id}`,
      title: show.name,
      category: 'movies' as Category,
      description: show.overview ? 
        show.overview.substring(0, 200) + (show.overview.length > 200 ? '...' : '') : 
        undefined,
      image: show.poster_path ? `https://image.tmdb.org/t/p/w200${show.poster_path}` : undefined,
      metadata: {
        year: show.first_air_date ? new Date(show.first_air_date).getFullYear() : undefined,
        tmdbRating: show.vote_average ? Math.round(show.vote_average * 10) / 10 : undefined,
        type: 'tv',
      },
      source: 'tmdb' as const,
    }));
    
    // Combine and sort by rating/popularity
    const allResults = [...movies, ...tvShows]
      .sort((a, b) => (b.metadata.tmdbRating || 0) - (a.metadata.tmdbRating || 0))
      .slice(0, 8); // Limit to top 8 results
    
    console.log(`🎬 Found ${allResults.length} movies/TV shows for "${query}"`);
    return allResults;
  } catch (error) {
    console.error('Error searching TMDb:', error);
    return [];
  }
};

// Helper function to remove undefined values from objects
const cleanObject = <T>(obj: T): Partial<T> => {
  const cleaned: Partial<T> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively clean nested objects
        const cleanedNested = cleanObject(value);
        if (Object.keys(cleanedNested).length > 0) {
          (cleaned as Record<string, unknown>)[key] = cleanedNested;
        }
      } else {
        (cleaned as Record<string, unknown>)[key] = value;
      }
    }
  }
  return cleaned;
};

// Enhanced post creation with universal items that also creates personal items
export const createStructuredPost = async (
  authorId: string,
  authorName: string,
  universalItem: UniversalItem,
  status: 'completed' | 'want_to_try',
  personalDescription?: string,
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
    recommendedByUserId?: string;
  }
): Promise<{ postId: string; personalItemId: string }> => {
  try {
    // Clean the universalItem to remove undefined fields
    const cleanedUniversalItem = cleanObject(universalItem);

    // Create the post for the feed first
    const postData = {
      authorId,
      authorName,
      category: universalItem.category,
      title: universalItem.title,
      description: personalDescription || universalItem.description || '',
      createdAt: Timestamp.now(),
      savedBy: [],
      universalItem: cleanedUniversalItem,
      postType: 'structured' as const,
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
        ...(enhancedFields.recommendedByUserId && { recommendedByUserId: enhancedFields.recommendedByUserId }),
      }),
    };
    
    const docRef = await addDoc(collection(db, 'posts'), postData);
    const postId = docRef.id;

    // Create notifications for tagged users
    if (enhancedFields?.taggedUsers && enhancedFields.taggedUsers.length > 0) {
      for (const taggedUserId of enhancedFields.taggedUsers) {
        await notifyTaggedUser(taggedUserId, authorId, authorName, postId, universalItem.title);
      }
    }

    // Create notification for recommended by user
    if (enhancedFields?.recommendedByUserId) {
      await notifyRecommendedBy(enhancedFields.recommendedByUserId, authorId, authorName, postId, universalItem.title);
    }

    // Now create the personal item linked to the post
    const personalItemId = await createPersonalItem(
      authorId,
      universalItem.category,
      universalItem.title,
      personalDescription,
      enhancedFields,
      // Link to the post we just created
      {
        postId,
        authorId,
        authorName,
      }
    );
    
    // If completed, update personal item to shared status
    if (status === 'completed') {
      await updatePersonalItemStatus(personalItemId, 'shared', postId);
    }
    
    console.log(`📚 Created structured post and personal item for "${universalItem.title}"`);
    return { postId, personalItemId };
  } catch (error) {
    console.error('Error creating structured post:', error);
    throw error;
  }
};

export const deletePost = async (postId: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
      // Mark as deleted instead of actually deleting for data integrity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: 'deleted' as any,
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};

// Completely delete a post and all associated personal items
export const fullyDeletePost = async (postId: string): Promise<void> => {
  try {
    // First, find and delete all personal items associated with this post
    const personalItemsQuery = query(
      collection(db, 'personal_items'),
      where('originalPostId', '==', postId)
    );
    const personalItemsSnapshot = await getDocs(personalItemsQuery);
    
    // Delete all associated personal items
    const deletePromises = personalItemsSnapshot.docs.map(doc => 
      deleteDoc(doc.ref)
    );
    await Promise.all(deletePromises);
    
    // Find any personal items that have this post as their sharedPostId
    const sharedItemsQuery = query(
      collection(db, 'personal_items'),
      where('sharedPostId', '==', postId)
    );
    const sharedItemsSnapshot = await getDocs(sharedItemsQuery);
    
    // Remove the sharedPostId reference from these items
    const updatePromises = sharedItemsSnapshot.docs.map(doc => 
      updateDoc(doc.ref, { sharedPostId: null })
    );
    await Promise.all(updatePromises);
    
    // Finally, delete the post itself
    const postRef = doc(db, 'posts', postId);
    await deleteDoc(postRef);
    
    console.log(`🗑️ Fully deleted post ${postId} and all associated personal items`);
  } catch (error) {
    console.error('Error fully deleting post:', error);
    throw error;
  }
};

export const unsharePost = async (
  postId: string, 
  personalItemId: string
): Promise<void> => {
  try {
    // Delete the post
    await deletePost(postId);
    
    // Revert personal item status from 'shared' back to 'completed'
    await updatePersonalItem(personalItemId, {
      status: 'completed'
    });
    
    // Remove the sharedPostId reference
    await updateDoc(doc(db, 'personal_items', personalItemId), {
      sharedPostId: null,
    });
    
    console.log(`📤 Unshared post ${postId}, reverted personal item ${personalItemId} to completed`);
  } catch (error) {
    console.error('Error unsharing post:', error);
    throw error;
  }
};

// Notification functions
export const createNotification = async (
  userId: string,
  type: 'tagged' | 'mentioned' | 'followed' | 'post_liked',
  title: string,
  message: string,
  data: {
    postId?: string;
    fromUserId: string;
    fromUserName: string;
    action?: string;
  }
) => {
  try {
    const notification = {
      userId,
      type,
      title,
      message,
      read: false,
      createdAt: serverTimestamp(),
      data
    };

    const docRef = await addDoc(collection(db, 'notifications'), notification);
    console.log('📬 Created notification:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export const getUserNotifications = async (userId: string, limitNum: number = 50) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitNum)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as (Notification & { id: string })[];
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
};

export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.length;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
};

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true
    });
    console.log('✅ Marked notification as read:', notificationId);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });

    await batch.commit();
    console.log('✅ Marked all notifications as read for user:', userId);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

// Create notification when user gets tagged
export const notifyTaggedUser = async (
  taggedUserId: string,
  fromUserId: string,
  fromUserName: string,
  postId: string,
  postTitle: string
) => {
  try {
    // Check if user wants to receive tagged notifications (default to true if not set)
    const userDoc = await getDoc(doc(db, 'users', taggedUserId));
    const userProfile = userDoc.exists() ? userDoc.data() as User : null;
    if (userProfile?.notificationPreferences?.tagged === false) {
      console.log('User has disabled tagged notifications');
      return;
    }

    await createNotification(
      taggedUserId,
      'tagged',
      `${fromUserName} tagged you!`,
      `In "${postTitle}"`,
      {
        postId,
        fromUserId,
        fromUserName
      }
    );
  } catch (error) {
    console.error('Error notifying tagged user:', error);
  }
};

// Create notification when user is mentioned as recommender
export const notifyRecommendedBy = async (
  recommendedByUserId: string,
  fromUserId: string,
  fromUserName: string,
  postId: string,
  postTitle: string
) => {
  try {
    // Check if user wants to receive mentioned notifications (default to true if not set)
    const userDoc = await getDoc(doc(db, 'users', recommendedByUserId));
    const userProfile = userDoc.exists() ? userDoc.data() as User : null;
    if (userProfile?.notificationPreferences?.mentioned === false) {
      console.log('User has disabled mentioned notifications');
      return;
    }

    await createNotification(
      recommendedByUserId,
      'mentioned',
      `${fromUserName} mentioned you recommended something!`,
      `In "${postTitle}"`,
      {
        postId,
        fromUserId,
        fromUserName
      }
    );
  } catch (error) {
    console.error('Error notifying recommended by user:', error);
  }
};

// Real-time notification listener
export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: (Notification & { id: string })[]) => void
) => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as (Notification & { id: string })[];
    
    callback(notifications);
  });
};

// Username management functions
export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  try {
    const normalizedUsername = username.toLowerCase();
    
    // Check if username exists in users collection
    const usersQuery = query(
      collection(db, 'users'),
      where('username', '==', normalizedUsername)
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    
    return usersSnapshot.empty;
  } catch (error) {
    console.error('Error checking username availability:', error);
    throw error;
  }
};

export const reserveUsername = async (userId: string, username: string): Promise<boolean> => {
  try {
    const normalizedUsername = username.toLowerCase();
    
    // Use a transaction to ensure atomicity
    const result = await runTransaction(db, async (transaction) => {
      // Check if username is available
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '==', normalizedUsername)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      
      if (!usersSnapshot.empty) {
        // Username is taken
        return false;
      }
      
      // Username is available, update the user
      const userRef = doc(db, 'users', userId);
      transaction.update(userRef, { username: normalizedUsername });
      
      return true;
    });
    
    return result;
  } catch (error) {
    console.error('Error reserving username:', error);
    throw error;
  }
};

export const updateUserWithUsername = async (
  userId: string, 
  updates: { name?: string; email?: string; username?: string }
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (updates.username) {
      const normalizedUsername = updates.username.toLowerCase();
      
      // Check if this username is already taken by someone else
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '==', normalizedUsername)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      
      // If username exists and belongs to someone else, return error
      if (!usersSnapshot.empty) {
        const existingUserDoc = usersSnapshot.docs[0];
        if (existingUserDoc.id !== userId) {
          return { success: false, error: 'Username is already taken' };
        }
      }
      
      // Username is available or belongs to current user, update with normalized version
      updates.username = normalizedUsername;
    }
    
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, updates);
    
    return { success: true };
  } catch (error) {
    console.error('Error updating user with username:', error);
    return { success: false, error: 'Failed to update profile' };
  }
};

export const getUserByUsername = async (username: string): Promise<User | null> => {
  try {
    const normalizedUsername = username.toLowerCase();
    const q = query(
      collection(db, 'users'),
      where('username', '==', normalizedUsername),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as User;
  } catch (error) {
    console.error('Error getting user by username:', error);
    return null;
  }
};

export const getUserRecsGivenCount = async (userId: string): Promise<number> => {
  try {
    // Get all posts by this user
    const userPostsQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', userId)
    );
    
    const userPostsSnapshot = await getDocs(userPostsQuery);
    
    if (userPostsSnapshot.empty) {
      return 0;
    }
    
    // Count total saves across all user's posts
    let totalSaves = 0;
    userPostsSnapshot.forEach((doc) => {
      const post = doc.data() as Post;
      if (post.savedBy && Array.isArray(post.savedBy)) {
        totalSaves += post.savedBy.length;
      }
    });
    
    return totalSaves;
  } catch (error) {
    console.error('Error getting user recs given count:', error);
    return 0;
  }
}; 