import {
  collection,
  doc,
  setDoc,
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
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { Post, User, Category, PersonalItem, PersonalItemStatus, UniversalItem, Notification, Thing, UserThingInteraction, UserThingInteractionState, Recommendation, PostV2, Comment, FeedThing, Invitation, Tag } from './types';

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

    // NOTE: Recommendation notifications are now handled automatically in createRecommendation()
    // when someone saves a post/item from another user
    
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
      const term = searchTerm.toLowerCase();
      const nameMatch = user.name.toLowerCase().includes(term);
      const emailMatch = user.email.toLowerCase().includes(term);
      const usernameMatch = user.username ? user.username.toLowerCase().includes(term) : false;
      
      if (nameMatch || emailMatch || usernameMatch) {
        console.log(`✅ User match: ${user.username || user.name}`, { nameMatch, emailMatch, usernameMatch });
        users.push(user);
      }
    });

    // Sort results to prioritize username matches
    users.sort((a, b) => {
      const term = searchTerm.toLowerCase();
      const aUsernameMatch = a.username ? a.username.toLowerCase().includes(term) : false;
      const bUsernameMatch = b.username ? b.username.toLowerCase().includes(term) : false;
      
      // Username matches first
      if (aUsernameMatch && !bUsernameMatch) return -1;
      if (!aUsernameMatch && bUsernameMatch) return 1;
      
      // Then by name
      return a.name.localeCompare(b.name);
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

// DEPRECATED: Old structured post creation - replaced by createOrGetThing + createUserThingInteraction
// This function was part of the dual-system implementation
// Can be safely removed after confirming production stability

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

    // NOTE: Recommendation notifications are now handled automatically in createRecommendation()

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
  type: 'tagged' | 'rec_given' | 'comment' | 'followed',
  title: string,
  message: string,
  data: {
    postId?: string;
    fromUserId?: string;
    fromUserName?: string;
    action?: string;
    tagId?: string;
    thingId?: string;
    thingTitle?: string;
    interactionId?: string;
  }
) => {
  try {
    // Check user's notification preferences
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const prefs = userData.notificationPreferences;
      
      // If user has preferences set, check if this notification type is enabled
      if (prefs && prefs[type] === false) {
        console.log(`🔕 Notification skipped (user preference): ${type} for user ${userId}`);
        return null;
      }
    }

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

// DEPRECATED: Old notification function - no longer used
// Recommendations now trigger 'rec_given' notifications directly in createRecommendation()

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
  updates: { name?: string; email?: string; username?: string; phoneNumber?: string }
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
    // Get all recommendations given by this user
    const recommendationsQuery = query(
      collection(db, 'recommendations'),
      where('fromUserId', '==', userId)
    );
    
    const recommendationsSnapshot = await getDocs(recommendationsQuery);
    
    return recommendationsSnapshot.size;
  } catch (error) {
    console.error('Error getting user recs given count:', error);
    return 0;
  }
};

// ============================================================================
// NEW DATA MODEL FUNCTIONS
// ============================================================================

// THINGS COLLECTION FUNCTIONS

export const createOrGetThing = async (
  universalItem: UniversalItem,
  createdBy: string
): Promise<string> => {
  try {
    // For API items, check if it exists by unique API ID
    if (universalItem.source !== 'manual') {
      if (universalItem.source === 'google_places') {
        // Dedupe by place_id (stored in metadata)
        const placeId = universalItem.id || universalItem.metadata?.placeId;
        if (placeId) {
          // Try to find by stored ID first (most reliable)
          const thingsRef = collection(db, 'things');
          const snapshot = await getDocs(thingsRef);
          const existing = snapshot.docs.find(doc => {
            const data = doc.data();
            return data.source === 'google_places' && 
                   (data.id === placeId || data.metadata?.placeId === placeId);
          });
          
          if (existing) {
            console.log('♻️ Using existing Google Place:', existing.id, 'for', universalItem.title);
            return existing.id;
          }
        }
      } else if (universalItem.source === 'google_books') {
        // Dedupe by ISBN
        const isbn = universalItem.metadata?.isbn;
        if (isbn) {
          const thingsRef = collection(db, 'things');
          const snapshot = await getDocs(thingsRef);
          const existing = snapshot.docs.find(doc => {
            const data = doc.data();
            return data.source === 'google_books' && data.metadata?.isbn === isbn;
          });
          
          if (existing) {
            console.log('♻️ Using existing book:', existing.id, 'for', universalItem.title);
            return existing.id;
          }
        }
      } else if (universalItem.source === 'tmdb') {
        // Dedupe by TMDB ID
        const tmdbId = universalItem.id || universalItem.metadata?.tmdbId;
        if (tmdbId) {
          const thingsRef = collection(db, 'things');
          const snapshot = await getDocs(thingsRef);
          const existing = snapshot.docs.find(doc => {
            const data = doc.data();
            return data.source === 'tmdb' && 
                   (data.id === tmdbId || data.metadata?.tmdbId === tmdbId);
          });
          
          if (existing) {
            console.log('♻️ Using existing movie/TV show:', existing.id, 'for', universalItem.title);
            return existing.id;
          }
        }
      }
      
      // If no existing thing found, create new API thing
      const thingData: Omit<Thing, 'id'> = {
        title: universalItem.title,
        category: universalItem.category,
        description: universalItem.description,
        image: universalItem.image,
        metadata: universalItem.metadata,
        source: universalItem.source,
        createdAt: Timestamp.now(),
        createdBy,
        commentCount: 0, // Initialize comment count
      };
      
      // Clean undefined values before writing to Firestore
      const cleanedThingData = cleanObject(thingData);
      const docRef = await addDoc(collection(db, 'things'), cleanedThingData);
      console.log('✅ Created new API thing:', docRef.id, 'for', universalItem.title, `(${universalItem.source})`);
      return docRef.id;
    }

    // For manual items, check for exact duplicates by title + category
    const thingsQuery = query(
      collection(db, 'things'),
      where('title', '==', universalItem.title),
      where('category', '==', universalItem.category),
      where('source', '==', 'manual')
    );
    
    const existingThings = await getDocs(thingsQuery);
    
    if (!existingThings.empty) {
      const existingThing = existingThings.docs[0];
      console.log('♻️ Using existing manual thing:', existingThing.id, 'for', universalItem.title);
      return existingThing.id;
    }
    
    // Create new manual thing
    const thingData: Omit<Thing, 'id'> = {
      title: universalItem.title,
      category: universalItem.category,
      description: universalItem.description,
      image: universalItem.image,
      metadata: universalItem.metadata,
      source: universalItem.source,
      createdAt: Timestamp.now(),
      createdBy,
      commentCount: 0, // Initialize comment count
    };
    
    // Clean undefined values before writing to Firestore
    const cleanedThingData = cleanObject(thingData);
    const docRef = await addDoc(collection(db, 'things'), cleanedThingData);
    console.log('✅ Created new manual thing:', docRef.id, 'for', universalItem.title);
    return docRef.id;
  } catch (error) {
    console.error('Error creating/getting thing:', error);
    throw error;
  }
};

export const getThing = async (thingId: string): Promise<Thing | null> => {
  try {
    const docRef = doc(db, 'things', thingId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return { id: docSnap.id, ...docSnap.data() } as Thing;
  } catch (error) {
    console.error('Error getting thing:', error);
    return null;
  }
};

// USER THING INTERACTIONS COLLECTION FUNCTIONS

export const createUserThingInteraction = async (
  userId: string,
  userName: string,
  thingId: string,
  state: UserThingInteractionState,
  visibility: 'private' | 'friends' = 'friends',
  options?: {
    rating?: number;
    notes?: string;
    content?: string;      // Public comments (for feed display)
    photos?: string[];     // Photos (for feed display)
  }
): Promise<string> => {
  try {
    console.log('🔍 createUserThingInteraction called:', { userId, userName, thingId, state, visibility });
    
    // Check if user already has an interaction with this thing
    const existingQuery = query(
      collection(db, 'user_thing_interactions'),
      where('userId', '==', userId),
      where('thingId', '==', thingId)
    );
    
    const existingInteractions = await getDocs(existingQuery);
    
    if (!existingInteractions.empty) {
      console.log('⚠️ Found existing interaction, updating instead of creating new one');
      // Update existing interaction
      const existingDoc = existingInteractions.docs[0];
      const updateData: Partial<UserThingInteraction> = {
        state,
        date: Timestamp.now(),
        visibility,
        updatedAt: Timestamp.now(),
      };
      
      // Add optional fields if provided
      if (options?.rating !== undefined) updateData.rating = options.rating;
      if (options?.notes !== undefined) updateData.notes = options.notes;
      if (options?.content !== undefined) updateData.content = options.content;
      if (options?.photos !== undefined) updateData.photos = options.photos;
      
      await updateDoc(doc(db, 'user_thing_interactions', existingDoc.id), updateData);
      console.log('🔄 Updated existing interaction:', existingDoc.id);
      return existingDoc.id;
    }
    
    // Create new interaction
    const interactionData: Omit<UserThingInteraction, 'id'> = {
      userId,
      userName,
      thingId,
      state,
      date: Timestamp.now(),
      visibility,
      rating: options?.rating,
      notes: options?.notes,
      content: options?.content,
      photos: options?.photos,
      likedBy: [],
      commentCount: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    // Clean undefined values
    const cleanedData = cleanObject(interactionData);
    const docRef = await addDoc(collection(db, 'user_thing_interactions'), cleanedData);
    console.log('✅ Created new interaction:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating user thing interaction:', error);
    throw error;
  }
};

export const getUserThingInteractions = async (userId: string): Promise<UserThingInteraction[]> => {
  try {
    const q = query(
      collection(db, 'user_thing_interactions'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const interactions: UserThingInteraction[] = [];
    
    querySnapshot.forEach((doc) => {
      interactions.push({ id: doc.id, ...doc.data() } as UserThingInteraction);
    });
    
    return interactions;
  } catch (error) {
    console.error('Error getting user thing interactions:', error);
    return [];
  }
};

export const getUserThingInteraction = async (
  userId: string,
  thingId: string
): Promise<UserThingInteraction | null> => {
  try {
    const q = query(
      collection(db, 'user_thing_interactions'),
      where('userId', '==', userId),
      where('thingId', '==', thingId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as UserThingInteraction;
  } catch (error) {
    console.error('Error getting user thing interaction:', error);
    return null;
  }
};

export const deleteUserThingInteraction = async (interactionId: string): Promise<void> => {
  try {
    // Delete the interaction
    await deleteDoc(doc(db, 'user_thing_interactions', interactionId));
    console.log('✅ Deleted user thing interaction:', interactionId);
    
    // Also delete all comments for this interaction
    const commentsQuery = query(
      collection(db, 'comments'),
      where('interactionId', '==', interactionId)
    );
    const commentsSnapshot = await getDocs(commentsQuery);
    
    const batch = writeBatch(db);
    commentsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    console.log(`🗑️ Deleted ${commentsSnapshot.size} comments for interaction ${interactionId}`);
  } catch (error) {
    console.error('Error deleting user thing interaction:', error);
    throw error;
  }
};

// Like/unlike interactions (for feed engagement)
export const likeInteraction = async (interactionId: string, userId: string): Promise<void> => {
  try {
    const interactionRef = doc(db, 'user_thing_interactions', interactionId);
    await updateDoc(interactionRef, {
      likedBy: arrayUnion(userId),
    });
    console.log('❤️ Liked interaction:', interactionId);
  } catch (error) {
    console.error('Error liking interaction:', error);
    throw error;
  }
};

export const unlikeInteraction = async (interactionId: string, userId: string): Promise<void> => {
  try {
    const interactionRef = doc(db, 'user_thing_interactions', interactionId);
    await updateDoc(interactionRef, {
      likedBy: arrayRemove(userId),
    });
    console.log('💔 Unliked interaction:', interactionId);
  } catch (error) {
    console.error('Error unliking interaction:', error);
    throw error;
  }
};

// Update interaction content/photos (for editing)
export const updateInteractionContent = async (
  interactionId: string,
  updates: {
    content?: string;
    rating?: number;
    photos?: string[];
  }
): Promise<void> => {
  try {
    const interactionRef = doc(db, 'user_thing_interactions', interactionId);
    
    const updateData: Partial<UserThingInteraction> = {
      updatedAt: Timestamp.now(),
    };
    
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.rating !== undefined) updateData.rating = updates.rating;
    if (updates.photos !== undefined) updateData.photos = updates.photos;
    
    await updateDoc(interactionRef, updateData);
    console.log('✏️ Updated interaction content:', interactionId);
  } catch (error) {
    console.error('Error updating interaction content:', error);
    throw error;
  }
};

// RECOMMENDATIONS COLLECTION FUNCTIONS

export const createRecommendation = async (
  fromUserId: string,
  toUserId: string,
  thingId: string,
  message?: string
): Promise<string> => {
  try {
    // Check if recommendation already exists
    const existingQuery = query(
      collection(db, 'recommendations'),
      where('fromUserId', '==', fromUserId),
      where('toUserId', '==', toUserId),
      where('thingId', '==', thingId)
    );
    
    const existingRecommendations = await getDocs(existingQuery);
    
    if (!existingRecommendations.empty) {
      console.log('⚠️ Recommendation already exists, skipping creation');
      return existingRecommendations.docs[0].id;
    }
    
    const recommendationData: Omit<Recommendation, 'id'> = {
      fromUserId,
      toUserId,
      thingId,
      date: Timestamp.now(),
      message,
    };
    
    const docRef = await addDoc(collection(db, 'recommendations'), recommendationData);
    console.log('✅ Created recommendation:', docRef.id);
    
    // Notify the fromUser (person who made the rec) that someone saved it
    // Get thing title for notification
    const thingDoc = await getDoc(doc(db, 'things', thingId));
    const thingTitle = thingDoc.exists() ? thingDoc.data().title : 'an item';
    
    // Get toUser's name
    const toUserDoc = await getDoc(doc(db, 'users', toUserId));
    const toUserName = toUserDoc.exists() ? toUserDoc.data().name : 'Someone';
    
    await createNotification(
      fromUserId,
      'rec_given',
      'Recommendation saved!',
      `${toUserName} saved your recommendation for ${thingTitle}`,
      {
        fromUserId: toUserId,
        fromUserName: toUserName,
        thingId,
        thingTitle,
      }
    );
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating recommendation:', error);
    throw error;
  }
};

export const getRecommendationsReceived = async (userId: string): Promise<Recommendation[]> => {
  try {
    const q = query(
      collection(db, 'recommendations'),
      where('toUserId', '==', userId),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const recommendations: Recommendation[] = [];
    
    querySnapshot.forEach((doc) => {
      recommendations.push({ id: doc.id, ...doc.data() } as Recommendation);
    });
    
    return recommendations;
  } catch (error) {
    console.error('Error getting recommendations received:', error);
    return [];
  }
};

export const getRecommendationsGiven = async (userId: string): Promise<Recommendation[]> => {
  try {
    const q = query(
      collection(db, 'recommendations'),
      where('fromUserId', '==', userId),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const recommendations: Recommendation[] = [];
    
    querySnapshot.forEach((doc) => {
      recommendations.push({ id: doc.id, ...doc.data() } as Recommendation);
    });
    
    return recommendations;
  } catch (error) {
    console.error('Error getting recommendations given:', error);
    return [];
  }
};

// ===== POSTS V2 COLLECTION FUNCTIONS =====
// DEPRECATED: PostsV2 collection replaced by UserThingInteraction with visibility field
// Keeping these functions for reference but they are no longer used in the app
// Can be safely removed after confirming production stability

export const createPostV2 = async (
  authorId: string,
  authorName: string,
  thingId: string,
  content: string,
  enhancedFields?: {
    rating?: number;
    photos?: string[];
    location?: string;
    priceRange?: '$' | '$$' | '$$$' | '$$$$';
    customPrice?: number;
    tags?: string[];
    experienceDate?: Date;
    taggedUsers?: string[];
    taggedNonUsers?: { name: string; email?: string }[];
  }
): Promise<string> => {
  try {
    const postData: Omit<PostV2, 'id'> = {
      authorId,
      authorName,
      thingId,
      content,
      rating: enhancedFields?.rating,
      photos: enhancedFields?.photos,
      location: enhancedFields?.location,
      priceRange: enhancedFields?.priceRange,
      customPrice: enhancedFields?.customPrice,
      tags: enhancedFields?.tags,
      experienceDate: enhancedFields?.experienceDate ? Timestamp.fromDate(enhancedFields.experienceDate) : undefined,
      taggedUsers: enhancedFields?.taggedUsers,
      taggedNonUsers: enhancedFields?.taggedNonUsers,
      createdAt: Timestamp.now(),
      likedBy: [],
    };
    
    // Clean undefined values before writing to Firestore
    const cleanedPostData = cleanObject(postData);
    const docRef = await addDoc(collection(db, 'posts_v2'), cleanedPostData);
    console.log('✅ Created post v2:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating post v2:', error);
    throw error;
  }
};

export const getPostsV2 = async (limitCount: number = 50): Promise<PostV2[]> => {
  try {
    const q = query(
      collection(db, 'posts_v2'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const posts: PostV2[] = [];
    
    querySnapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() } as PostV2);
    });
    
    return posts;
  } catch (error) {
    console.error('Error getting posts v2:', error);
    return [];
  }
};

export const likePostV2 = async (postId: string, userId: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts_v2', postId);
    await updateDoc(postRef, {
      likedBy: arrayUnion(userId),
    });
    console.log('👍 Liked post v2:', postId);
  } catch (error) {
    console.error('Error liking post v2:', error);
    throw error;
  }
};

export const unlikePostV2 = async (postId: string, userId: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts_v2', postId);
    await updateDoc(postRef, {
      likedBy: arrayRemove(userId),
    });
    console.log('👎 Unliked post v2:', postId);
  } catch (error) {
    console.error('Error unliking post v2:', error);
    throw error;
  }
};

export const updatePostV2 = async (
  postId: string,
  updates: {
    content?: string;
    rating?: number;
    photos?: string[];
  }
): Promise<void> => {
  try {
    const postRef = doc(db, 'posts_v2', postId);
    
    // Build update object with only defined values
    const updateData: {
      content?: string;
      rating?: number;
      photos?: string[];
    } = {};
    
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.rating !== undefined) updateData.rating = updates.rating;
    if (updates.photos !== undefined) updateData.photos = updates.photos;
    
    await updateDoc(postRef, updateData);
    console.log('✏️ Updated post v2:', postId);
  } catch (error) {
    console.error('Error updating post v2:', error);
    throw error;
  }
};

export const deletePostV2 = async (postId: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts_v2', postId);
    await deleteDoc(postRef);
    console.log('🗑️ Deleted post v2:', postId);
    
    // Also delete all comments for this post
    const commentsQuery = query(
      collection(db, 'comments'),
      where('postId', '==', postId)
    );
    const commentsSnapshot = await getDocs(commentsQuery);
    
    const batch = writeBatch(db);
    commentsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    console.log(`🗑️ Deleted ${commentsSnapshot.size} comments for post ${postId}`);
  } catch (error) {
    console.error('Error deleting post v2:', error);
    throw error;
  }
};

// ============================================================================
// FEED AND DATA LOADING FUNCTIONS (NEW SYSTEM)
// ============================================================================

/**
 * Get feed things - groups interactions by thing for cleaner feed display
 * Shows one card per thing with all friends who've interacted with it
 */
export const getFeedThings = async (
  following: string[],
  currentUserId: string
): Promise<FeedThing[]> => {
  try {
    console.log('📱 Loading feed things (grouped by thing)...');
    console.log('👥 Following:', following.length, 'users');
    console.log('👤 Current user:', currentUserId);
    
    const allUserIds = [...following, currentUserId];
    console.log('📊 Total user IDs to query:', allUserIds.length);
    
    if (allUserIds.length === 0) {
      console.log('⚠️ No users to query (not following anyone)');
      return [];
    }
    
    // Get all public interactions from followed users + yourself
    const interactionsRef = collection(db, 'user_thing_interactions');
    const q = query(
      interactionsRef,
      where('userId', 'in', allUserIds),
      where('visibility', 'in', ['friends']),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    
    console.log('🔍 Querying user_thing_interactions collection...');
    const snapshot = await getDocs(q);
    console.log('📦 Query returned', snapshot.size, 'documents');
    
    const interactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as UserThingInteraction));
    
    // Group by thingId
    const thingsMap = new Map<string, UserThingInteraction[]>();
    interactions.forEach(int => {
      if (!thingsMap.has(int.thingId)) {
        thingsMap.set(int.thingId, []);
      }
      thingsMap.get(int.thingId)!.push(int);
    });
    
    console.log(`📊 Grouped into ${thingsMap.size} unique things`);
    
    // Build FeedThing objects
    const feedThings: FeedThing[] = [];
    
    for (const [thingId, ints] of thingsMap.entries()) {
      const thing = await getThing(thingId);
      if (!thing) {
        console.warn('⚠️ Thing not found:', thingId);
        continue;
      }
      
      // Sort interactions by createdAt (earliest first for display order)
      ints.sort((a, b) => {
        const aTime = (a.createdAt as Timestamp)?.seconds || 0;
        const bTime = (b.createdAt as Timestamp)?.seconds || 0;
        return aTime - bTime;
      });
      
      // Find most recent interaction for sorting feed
      const mostRecent = ints[ints.length - 1];
      
      feedThings.push({
        thing,
        interactions: ints,
        myInteraction: ints.find(i => i.userId === currentUserId),
        avgRating: await getThingAverageRating(thingId),
        mostRecentUpdate: mostRecent.createdAt.toDate()
      });
    }
    
    // Sort by most recent update
    feedThings.sort((a, b) => {
      const aTime = a.mostRecentUpdate?.getTime() || 0;
      const bTime = b.mostRecentUpdate?.getTime() || 0;
      return bTime - aTime;
    });
    
    console.log(`✅ Loaded ${feedThings.length} feed things`);
    return feedThings;
  } catch (error) {
    console.error('Error loading feed things:', error);
    return [];
  }
};

// Get feed posts using new system (posts_v2 with things data)
// Get feed interactions (replaces getFeedPostsV2)
export const getFeedInteractions = async (following: string[], currentUserId: string): Promise<UserThingInteraction[]> => {
  try {
    console.log('📱 Loading feed interactions...');
    console.log('👥 Following:', following.length, 'users');
    console.log('👤 Current user:', currentUserId);
    
    // Include current user's interactions in the feed
    const allUserIds = [...new Set([...following, currentUserId])];
    console.log('📊 Total user IDs to query:', allUserIds.length);
    
    if (allUserIds.length === 0) {
      console.log('⚠️ No user IDs to query');
      return [];
    }
    
    const feedInteractions: UserThingInteraction[] = [];
    
    try {
      // Get public/friends interactions from followed users + current user
      const interactionsQuery = query(
        collection(db, 'user_thing_interactions'),
        where('userId', 'in', allUserIds),
        where('visibility', 'in', ['friends']),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      console.log('🔍 Querying user_thing_interactions collection...');
      const snapshot = await getDocs(interactionsQuery);
      console.log('📦 Query returned', snapshot.size, 'documents');
      
      snapshot.forEach((doc) => {
        feedInteractions.push({ id: doc.id, ...doc.data() } as UserThingInteraction);
      });
    } catch (queryError) {
      console.error('❌ Error with filtered query:', queryError);
      console.log('🔄 Falling back to all public interactions...');
      
      // Fallback: get all public interactions
      const allPublicQuery = query(
        collection(db, 'user_thing_interactions'),
        where('visibility', 'in', ['friends']),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const allSnapshot = await getDocs(allPublicQuery);
      allSnapshot.forEach((doc) => {
        const interaction = { id: doc.id, ...doc.data() } as UserThingInteraction;
        // Filter client-side
        if (allUserIds.includes(interaction.userId)) {
          feedInteractions.push(interaction);
        }
      });
    }
    
    // If no interactions from following, get recent public interactions
    if (feedInteractions.length === 0) {
      console.log('📭 No interactions from followed users, loading all recent public...');
      const allPublicQuery = query(
        collection(db, 'user_thing_interactions'),
        where('visibility', '==', 'friends'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      const allSnapshot = await getDocs(allPublicQuery);
      console.log('📦 All public query returned', allSnapshot.size, 'documents');
      allSnapshot.forEach((doc) => {
        feedInteractions.push({ id: doc.id, ...doc.data() } as UserThingInteraction);
      });
    }
    
    console.log(`✅ Loaded ${feedInteractions.length} feed interactions`);
    return feedInteractions;
  } catch (error) {
    console.error('❌ Error loading feed interactions:', error);
    return [];
  }
};

// LEGACY: Keep for backwards compatibility during migration
export const getFeedPostsV2 = async (following: string[], currentUserId: string): Promise<PostV2[]> => {
  try {
    console.log('⚠️ getFeedPostsV2 is deprecated, use getFeedInteractions instead');
    const allUserIds = [...new Set([...following, currentUserId])];
    
    const followingPostsQuery = query(
      collection(db, 'posts_v2'),
      where('authorId', 'in', allUserIds),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const snapshot = await getDocs(followingPostsQuery);
    const posts: PostV2[] = [];
    snapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() } as PostV2);
    });
    
    return posts;
  } catch (error) {
    console.error('Error loading feed posts v2:', error);
    return [];
  }
};

// Get user's thing interactions
export const getUserThingInteractionsWithThings = async (userId: string): Promise<{
  interactions: UserThingInteraction[];
  things: Thing[];
}> => {
  try {
    console.log('📋 Loading user interactions with things...');
    
    // Get user interactions
    const interactions = await getUserThingInteractions(userId);
    
    // Get unique thing IDs
    const thingIds = [...new Set(interactions.map(i => i.thingId))];
    
    // Get things data
    const things: Thing[] = [];
    for (const thingId of thingIds) {
      const thing = await getThing(thingId);
      if (thing) {
        things.push(thing);
      }
    }
    
    console.log(`✅ Loaded ${interactions.length} interactions and ${things.length} things`);
    return { interactions, things };
  } catch (error) {
    console.error('Error loading user interactions with things:', error);
    return { interactions: [], things: [] };
  }
};

// Get user's posts using new system
export const getUserPostsV2 = async (userId: string): Promise<PostV2[]> => {
  try {
    console.log('📝 Loading user posts with new system...');
    
    const q = query(
      collection(db, 'posts_v2'),
      where('authorId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const posts: PostV2[] = [];
    
    querySnapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() } as PostV2);
    });
    
    console.log(`✅ Loaded ${posts.length} user posts with new system`);
    return posts;
  } catch (error) {
    console.error('Error loading user posts v2:', error);
    return [];
  }
};

// Get average rating for a thing across all users
export const getThingAverageRating = async (thingId: string): Promise<number | null> => {
  try {
    const interactionsQuery = query(
      collection(db, 'user_thing_interactions'),
      where('thingId', '==', thingId),
      where('rating', '>', 0)
    );
    
    const snapshot = await getDocs(interactionsQuery);
    
    if (snapshot.empty) return null;
    
    const ratings = snapshot.docs
      .map(doc => doc.data().rating)
      .filter((rating): rating is number => rating !== undefined && rating > 0);
    
    if (ratings.length === 0) return null;
    
    const sum = ratings.reduce((acc, rating) => acc + rating, 0);
    const average = sum / ratings.length;
    
    return Math.round(average * 10) / 10; // Round to 1 decimal
  } catch (error) {
    console.error('Error calculating average rating:', error);
    return null;
  }
};

// Get recommendations received by user
export const getRecommendationsWithThings = async (userId: string): Promise<{
  recommendations: Recommendation[];
  things: Thing[];
}> => {
  try {
    console.log('🎯 Loading recommendations with things...');
    
    // Get recommendations
    const recommendations = await getRecommendationsReceived(userId);
    
    // Get unique thing IDs
    const thingIds = [...new Set(recommendations.map(r => r.thingId))];
    
    // Get things data
    const things: Thing[] = [];
    for (const thingId of thingIds) {
      const thing = await getThing(thingId);
      if (thing) {
        things.push(thing);
      }
    }
    
    console.log(`✅ Loaded ${recommendations.length} recommendations and ${things.length} things`);
    return { recommendations, things };
  } catch (error) {
    console.error('Error loading recommendations with things:', error);
    return { recommendations: [], things: [] };
  }
};

// ============================================================================
// DUAL SYSTEM POST CREATION (NEW + OLD)
// ============================================================================
// DEPRECATED: Old dual-system implementation - no longer used
// Replaced by direct calls to createOrGetThing + createUserThingInteraction
// Can be safely removed after confirming production stability
// ============================================================================

export const createPostWithNewSystem = async (
  authorId: string,
  authorName: string,
  category: Category,
  title: string,
  description?: string,
  status: 'want_to_try' | 'completed' = 'want_to_try',
  postToFeed: boolean = true,
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
): Promise<{
  thingId: string;
  interactionId: string;
  postId?: string;
  recommendationId?: string;
}> => {
  try {
    console.log('🚀 Creating post with new system for:', title);
    
    // 1. Create UniversalItem from the data
    const universalItem: UniversalItem = {
      id: '', // Will be set by createOrGetThing
      title,
      category,
      description,
      image: undefined,
      metadata: {
        // For manual items, we don't have rich metadata
        // This could be enhanced later with location, tags, etc.
        ...(enhancedFields?.location && { address: enhancedFields.location }),
        ...(enhancedFields?.tags && { tags: enhancedFields.tags }),
      },
      source: 'manual',
    };
    
    // 2. Create or get the thing
    const thingId = await createOrGetThing(universalItem, authorId);
    console.log('✅ Thing created/found:', thingId);
    
    // 3. Create user interaction
    const interactionState: UserThingInteractionState = status === 'completed' ? 'completed' : 'bucketList';
    const visibility = postToFeed ? 'friends' : 'private';
    const interactionId = await createUserThingInteraction(
      authorId,
      authorName,
      thingId,
      interactionState,
      visibility
    );
    console.log('✅ User interaction created:', interactionId);
    
    let postId: string | undefined;
    let recommendationId: string | undefined;
    
    // 4. If posting to feed, create post
    if (postToFeed) {
      postId = await createPostV2(
        authorId,
        authorName,
        thingId,
        description || '',
        {
          rating: enhancedFields?.rating,
          location: enhancedFields?.location,
          priceRange: enhancedFields?.priceRange,
          customPrice: enhancedFields?.customPrice,
          tags: enhancedFields?.tags,
          experienceDate: enhancedFields?.experienceDate,
          taggedUsers: enhancedFields?.taggedUsers,
          taggedNonUsers: enhancedFields?.taggedNonUsers,
        }
      );
      console.log('✅ Post created:', postId);
    }
    
    // 5. If there's a recommendation, create recommendation record
    if (enhancedFields?.recommendedByUserId && enhancedFields?.recommendedByUserId !== authorId) {
      recommendationId = await createRecommendation(
        enhancedFields.recommendedByUserId,
        authorId,
        thingId,
        enhancedFields.recommendedBy ? `Recommended: ${enhancedFields.recommendedBy}` : undefined
      );
      console.log('✅ Recommendation created:', recommendationId);
    }
    
    return {
      thingId,
      interactionId,
      postId,
      recommendationId,
    };
  } catch (error) {
    console.error('❌ Error creating post with new system:', error);
    throw error;
  }
};

// ===== MIGRATION FUNCTIONS =====
// DEPRECATED: One-time migration helpers - no longer needed
// Used during initial migration from posts/personal_items to new system
// Can be safely removed after confirming all data is migrated
// ============================================================================

// Helper function to convert old Post to new system data
export const migratePostToNewSystem = async (post: Post): Promise<{
  thingId: string;
  interactionId: string;
  postId: string;
}> => {
  try {
    console.log('🔄 Migrating post to new system:', post.title);
    
    // Create UniversalItem from old post
    const universalItem: UniversalItem = {
      id: '',
      title: post.title,
      category: post.category,
      description: post.description,
      image: post.universalItem?.image,
      metadata: post.universalItem?.metadata || {},
      source: post.universalItem?.source || 'manual',
    };
    
    // Create thing
    const thingId = await createOrGetThing(universalItem, post.authorId);
    
    // Create user interaction (assume bucketList since it was posted)
    const interactionId = await createUserThingInteraction(
      post.authorId,
      post.authorName,
      thingId,
      'bucketList',
      'friends' // Keep as friends for old posts
    );
    
    // Create new post
    const postId = await createPostV2(
      post.authorId,
      post.authorName,
      thingId,
      post.description,
      {
        rating: post.rating,
        location: post.location,
        priceRange: post.priceRange,
        customPrice: post.customPrice,
        tags: post.tags,
        experienceDate: post.experienceDate?.toDate(),
        taggedUsers: post.taggedUsers,
        taggedNonUsers: post.taggedNonUsers,
      }
    );
    
    console.log('✅ Post migrated successfully');
    return { thingId, interactionId, postId };
  } catch (error) {
    console.error('❌ Error migrating post:', error);
    throw error;
  }
};

// Helper function to convert PersonalItem to new system data
export const migratePersonalItemToNewSystem = async (personalItem: PersonalItem): Promise<{
  thingId: string;
  interactionId: string;
  postId?: string;
}> => {
  try {
    console.log('🔄 Migrating personal item to new system:', personalItem.title);
    
    // Create UniversalItem from personal item
    const universalItem: UniversalItem = {
      id: '',
      title: personalItem.title,
      category: personalItem.category,
      description: personalItem.description,
      image: undefined,
      metadata: {},
      source: 'manual',
    };
    
    // Create thing
    const thingId = await createOrGetThing(universalItem, personalItem.userId);
    
    // Map old status to new interaction state
    const interactionState: UserThingInteractionState = 
      personalItem.status === 'completed' ? 'completed' : 'bucketList';
    
    // Create user interaction
    // For old personal items, we don't have userName, so use empty string  
    const interactionId = await createUserThingInteraction(
      personalItem.userId,
      '', // No userName in old PersonalItem
      thingId,
      interactionState,
      'private' // Old personal items were private
    );
    
    let postId: string | undefined;
    
    // If it was shared, create a post
    if (personalItem.status === 'shared' && personalItem.sharedPostId) {
      // Try to get the original post data
      const originalPost = await getPost(personalItem.sharedPostId);
      if (originalPost) {
        postId = await createPostV2(
          personalItem.userId,
          originalPost.authorName,
          thingId,
          personalItem.description,
          {
            rating: personalItem.rating,
            location: personalItem.location,
            priceRange: personalItem.priceRange,
            customPrice: personalItem.customPrice,
            tags: personalItem.tags,
            experienceDate: personalItem.experienceDate?.toDate(),
            taggedUsers: personalItem.taggedUsers,
            taggedNonUsers: personalItem.taggedNonUsers,
          }
        );
      }
    }
    
    console.log('✅ Personal item migrated successfully');
    return { thingId, interactionId, postId };
  } catch (error) {
    console.error('❌ Error migrating personal item:', error);
    throw error;
  }
};

// ============================================================================
// COMMENTS COLLECTION FUNCTIONS
// ============================================================================

export const createComment = async (
  thingId: string,
  authorId: string,
  authorName: string,
  content: string,
  taggedUsers?: string[],
  voiceNoteUrl?: string,
  voiceNoteDuration?: number
): Promise<string> => {
  try {
    const commentData: Omit<Comment, 'id'> = {
      thingId,
      authorId,
      authorName,
      content,
      createdAt: Timestamp.now(),
      likedBy: [],
      taggedUsers: taggedUsers || [],
      ...(voiceNoteUrl && { voiceNoteUrl }),
      ...(voiceNoteDuration && { voiceNoteDuration }),
    };
    
    const docRef = await addDoc(collection(db, 'comments'), commentData);
    console.log('✅ Created comment:', docRef.id);
    
    // Increment comment count on the thing
    const thingRef = doc(db, 'things', thingId);
    await updateDoc(thingRef, {
      commentCount: increment(1)
    });
    
    // Get thing title for notification
    const thingDoc = await getDoc(thingRef);
    const thingTitle = thingDoc.exists() ? thingDoc.data().title : 'an item';
    
    // Notify tagged users first
    if (taggedUsers && taggedUsers.length > 0) {
      for (const taggedUsername of taggedUsers) {
        // Look up user ID from username
        const userQuery = query(
          collection(db, 'users'),
          where('username', '==', taggedUsername)
        );
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty && userSnapshot.docs[0].id !== authorId) {
          const taggedUserId = userSnapshot.docs[0].id;
          await createNotification(
            taggedUserId,
            'tagged',
            'Tagged in comment',
            `${authorName} tagged you in a comment on ${thingTitle}`,
            {
              fromUserId: authorId,
              fromUserName: authorName,
              thingId,
              thingTitle,
            }
          );
        }
      }
    }
    
    // Notify users who have interacted with this thing (except the commenter and tagged users)
    const interactionsQuery = query(
      collection(db, 'user_thing_interactions'),
      where('thingId', '==', thingId),
      where('userId', '!=', authorId) // Exclude the commenter
    );
    
    const interactionsSnapshot = await getDocs(interactionsQuery);
    const notifiedUsers = new Set<string>();
    
    // Add tagged users to the set so we don't notify them twice
    if (taggedUsers) {
      for (const taggedUsername of taggedUsers) {
        // Look up user ID from username
        const userQuery = query(
          collection(db, 'users'),
          where('username', '==', taggedUsername)
        );
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
          notifiedUsers.add(userSnapshot.docs[0].id);
        }
      }
    }
    
    for (const interactionDoc of interactionsSnapshot.docs) {
      const interactionData = interactionDoc.data();
      const userId = interactionData.userId;
      
      // Don't notify the same user multiple times
      if (!notifiedUsers.has(userId)) {
        notifiedUsers.add(userId);
        
        await createNotification(
          userId,
          'comment',
          'New comment',
          `${authorName} commented on ${thingTitle}`,
          {
            fromUserId: authorId,
            fromUserName: authorName,
            thingId,
            thingTitle,
          }
        );
      }
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};

export const getCommentsForThing = async (
  thingId: string,
  currentUserId: string,
  following: string[] = []
): Promise<Comment[]> => {
  try {
    const q = query(
      collection(db, 'comments'),
      where('thingId', '==', thingId),
      orderBy('createdAt', 'asc') // Oldest first for natural conversation flow
    );
    
    const querySnapshot = await getDocs(q);
    const allComments: Comment[] = [];
    
    querySnapshot.forEach((doc) => {
      allComments.push({ id: doc.id, ...doc.data() } as Comment);
    });
    
    // Filter comments based on following
    const visibleComments = allComments.filter(comment => {
      // Always show your own comments
      if (comment.authorId === currentUserId) return true;
      
      // Show comments from people you follow
      if (following.includes(comment.authorId)) return true;
      
      // Don't show comments from people you don't follow
      return false;
    });
    
    console.log(`✅ Loaded ${visibleComments.length} visible comments (${allComments.length} total) for thing ${thingId}`);
    return visibleComments;
  } catch (error) {
    console.error('Error getting comments:', error);
    return [];
  }
};

// LEGACY: Keep for backwards compatibility
export const getCommentsForInteraction = async (): Promise<Comment[]> => {
  console.log('⚠️ getCommentsForInteraction is deprecated, use getCommentsForThing instead');
  // This will need to be updated to work with the new system
  // For now, return empty array to avoid breaking existing code
  return [];
};

// LEGACY: Keep for backwards compatibility
export const getCommentsForPost = async (): Promise<Comment[]> => {
  console.log('⚠️ getCommentsForPost is deprecated, use getCommentsForThing instead');
  return getCommentsForInteraction();
};

// Migration function to initialize commentCount for existing things
export const initializeCommentCounts = async (): Promise<void> => {
  try {
    console.log('🔄 Starting commentCount migration...');
    
    // Get all things
    const thingsSnapshot = await getDocs(collection(db, 'things'));
    console.log(`📊 Found ${thingsSnapshot.docs.length} total things`);
    
    let updatedCount = 0;
    
    // Process each thing
    for (const thingDoc of thingsSnapshot.docs) {
      const thingId = thingDoc.id;
      const thingData = thingDoc.data();
      
      // Check if commentCount field exists and is a number
      if (typeof thingData.commentCount !== 'number') {
        // Count actual comments for this thing
        const commentsQuery = query(
          collection(db, 'comments'),
          where('thingId', '==', thingId)
        );
        
        const commentsSnapshot = await getDocs(commentsQuery);
        const actualCommentCount = commentsSnapshot.docs.length;
        
        // Update the thing with the correct comment count
        await updateDoc(doc(db, 'things', thingId), {
          commentCount: actualCommentCount
        });
        
        console.log(`✅ Updated ${thingData.title}: ${actualCommentCount} comments`);
        updatedCount++;
      } else {
        console.log(`⏭️ Skipped ${thingData.title}: already has commentCount (${thingData.commentCount})`);
      }
    }
    
    console.log(`✅ CommentCount migration completed. Updated ${updatedCount} things.`);
  } catch (error) {
    console.error('❌ Error during commentCount migration:', error);
    throw error;
  }
};

// Make migration function available globally for console access
if (typeof window !== 'undefined') {
  (window as unknown as Window & { initializeCommentCounts: typeof initializeCommentCounts }).initializeCommentCounts = initializeCommentCounts;
}

export const deleteComment = async (commentId: string, thingId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'comments', commentId));
    
    // Decrement comment count on the thing
    const thingRef = doc(db, 'things', thingId);
    await updateDoc(thingRef, {
      commentCount: increment(-1)
    });
    
    console.log('✅ Deleted comment:', commentId);
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

export const likeComment = async (commentId: string, userId: string): Promise<void> => {
  try {
    const commentRef = doc(db, 'comments', commentId);
    await updateDoc(commentRef, {
      likedBy: arrayUnion(userId)
    });
  } catch (error) {
    console.error('Error liking comment:', error);
    throw error;
  }
};

export const unlikeComment = async (commentId: string, userId: string): Promise<void> => {
  try {
    const commentRef = doc(db, 'comments', commentId);
    await updateDoc(commentRef, {
      likedBy: arrayRemove(userId)
    });
  } catch (error) {
    console.error('Error unliking comment:', error);
    throw error;
  }
};

// ===== MIGRATION HELPERS =====

/**
 * Migration: Convert all inProgress interactions to bucketList
 * Run this once to clean up the removed state
 */
export const migrateInProgressToBucketList = async (userId: string): Promise<void> => {
  try {
    console.log('🔄 Migrating inProgress → bucketList for user:', userId);
    
    const interactionsRef = collection(db, 'user_thing_interactions');
    const q = query(interactionsRef, where('userId', '==', userId), where('state', '==', 'inProgress'));
    const snapshot = await getDocs(q);
    
    let updated = 0;
    for (const docSnap of snapshot.docs) {
      await updateDoc(doc(db, 'user_thing_interactions', docSnap.id), {
        state: 'bucketList'
      });
      updated++;
      console.log(`✅ Updated ${docSnap.id}: inProgress → bucketList`);
    }
    
    console.log(`✅ Migration complete! Updated ${updated} interaction(s)`);
    if (updated > 0) {
      alert(`Converted ${updated} in-progress item(s) to bucket list. Refresh the page.`);
    } else {
      alert('No in-progress items found!');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

/**
 * Cleanup: Remove duplicate user_thing_interactions
 * Keeps the most recent one for each user+thing combination
 */
export const cleanupDuplicateInteractions = async (userId: string): Promise<void> => {
  try {
    console.log('🔄 Starting duplicate cleanup for user:', userId);
    
    // Get all interactions for this user
    const interactionsRef = collection(db, 'user_thing_interactions');
    const q = query(interactionsRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    // Group by thingId
    type InteractionDoc = { id: string; data: Record<string, unknown> };
    const thingMap = new Map<string, InteractionDoc[]>();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const thingId = data.thingId as string;
      if (!thingMap.has(thingId)) {
        thingMap.set(thingId, []);
      }
      thingMap.get(thingId)!.push({ id: doc.id, data });
    });
    
    // Find and delete duplicates (keep most recent)
    let deletedCount = 0;
    for (const [thingId, interactions] of thingMap.entries()) {
      if (interactions.length > 1) {
        console.log(`⚠️ Found ${interactions.length} interactions for thing: ${thingId}`);
        
        // Sort by createdAt (most recent first)
        interactions.sort((a, b) => {
          const aCreatedAt = a.data.createdAt as { seconds: number } | undefined;
          const bCreatedAt = b.data.createdAt as { seconds: number } | undefined;
          const aTime = aCreatedAt?.seconds || 0;
          const bTime = bCreatedAt?.seconds || 0;
          return bTime - aTime;
        });
        
        // Keep first (most recent), delete rest
        for (let i = 1; i < interactions.length; i++) {
          await deleteDoc(doc(db, 'user_thing_interactions', interactions[i].id));
          console.log(`🗑️ Deleted duplicate: ${interactions[i].id}`);
          deletedCount++;
        }
      }
    }
    
    console.log(`✅ Cleanup complete! Deleted ${deletedCount} duplicate(s)`);
    if (deletedCount > 0) {
      alert(`Removed ${deletedCount} duplicate interaction(s). Refresh the page.`);
    } else {
      alert('No duplicates found!');
    }
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
};

/**
 * Migration: Add userName to existing user_thing_interactions
 * Run this once to populate missing userName fields
 */
export const migrateAddUserNameToInteractions = async (): Promise<void> => {
  try {
    console.log('🔄 Starting migration: Adding userName to interactions...');
    
    // Get all interactions
    const interactionsRef = collection(db, 'user_thing_interactions');
    const snapshot = await getDocs(interactionsRef);
    
    console.log(`📊 Found ${snapshot.size} interactions to check`);
    
    let updated = 0;
    let skipped = 0;
    
    // Get all users for lookup
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    const usersMap = new Map<string, string>();
    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      usersMap.set(doc.id, data.name || 'User');
    });
    
    // Update each interaction that's missing userName
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
      if (!data.userName) {
        const userName = usersMap.get(data.userId) || 'User';
        await updateDoc(doc(db, 'user_thing_interactions', docSnap.id), {
          userName
        });
        updated++;
        console.log(`✅ Updated ${docSnap.id} with userName: ${userName}`);
      } else {
        skipped++;
      }
    }
    
    console.log(`✅ Migration complete! Updated: ${updated}, Skipped: ${skipped}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// ============================================================================
// INVITATION SYSTEM
// ============================================================================

/**
 * Generate a short random invite code (7 characters)
 */
const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Create an invitation for sharing a thing
 */
export const createInvitation = async (
  inviterId: string,
  inviterName: string,
  inviterUsername: string,
  thingId: string,
  thingTitle: string,
  interactionId?: string,
  recipientName?: string
): Promise<string> => {
  try {
    // Generate unique code
    let code = generateInviteCode();
    let attempts = 0;
    
    // Ensure code is unique (very unlikely to collide, but check anyway)
    while (attempts < 5) {
      const existingDoc = await getDoc(doc(db, 'invitations', code));
      if (!existingDoc.exists()) break;
      code = generateInviteCode();
      attempts++;
    }
    
    const invitationData: Omit<Invitation, 'id'> = {
      inviterId,
      inviterName,
      inviterUsername,
      thingId,
      thingTitle,
      interactionId,
      recipientName,
      createdAt: Timestamp.now(),
      usedBy: [],
      convertedUsers: [],
    };
    
    await setDoc(doc(db, 'invitations', code), invitationData);
    console.log('✅ Created invitation code:', code);
    return code;
  } catch (error) {
    console.error('Error creating invitation:', error);
    throw error;
  }
};

/**
 * Get invitation by code
 */
export const getInvitation = async (code: string): Promise<Invitation | null> => {
  try {
    const inviteDoc = await getDoc(doc(db, 'invitations', code));
    
    if (!inviteDoc.exists()) {
      console.log('⚠️ Invitation not found:', code);
      return null;
    }
    
    return {
      id: inviteDoc.id,
      ...inviteDoc.data()
    } as Invitation;
  } catch (error) {
    console.error('Error getting invitation:', error);
    return null;
  }
};

/**
 * Process invitation after user signs up/in
 * Auto-follows inviter and saves thing to bucket list
 */
export const processInvitation = async (
  userId: string,
  userName: string,
  inviteCode: string,
  isNewUser: boolean
): Promise<boolean> => {
  try {
    console.log('🎁 Processing invitation:', inviteCode, 'for user:', userId);
    
    const invitation = await getInvitation(inviteCode);
    
    if (!invitation) {
      console.log('⚠️ Invitation not found or expired');
      return false;
    }
    
    // 1. Follow the inviter
    console.log('👥 Auto-following inviter:', invitation.inviterId);
    await followUser(userId, invitation.inviterId);
    
    // 2. Save thing as completed (not bucket list)
    console.log('📌 Auto-saving thing as completed:', invitation.thingId);
    await createUserThingInteraction(
      userId,
      userName,
      invitation.thingId,
      'completed',
      'friends' // Visible to followers by default
    );
    
    // 3. Create recommendation record (you → inviter)
    // The invited user recommended this thing to the inviter
    console.log('🎁 Creating recommendation record');
    await createRecommendation(
      userId,                 // The person who gave the recommendation (invited user)
      invitation.inviterId,   // The person who received the recommendation (inviter)
      invitation.thingId,
      `Via invite link`
    );
    
    // 4. Mark invitation as used
    const inviteRef = doc(db, 'invitations', inviteCode);
    await updateDoc(inviteRef, {
      usedBy: arrayUnion(userId),
      ...(isNewUser && { convertedUsers: arrayUnion(userId) })
    });
    
    // 5. Notify inviter (optional - new user joined)
    if (isNewUser) {
      await createNotification(
        invitation.inviterId,
        'followed',
        `${userName} joined Rex!`,
        `${userName} joined Rex via your invite and is now following you.`,
        {
          fromUserId: userId,
          fromUserName: userName,
        }
      );
    }
    
    console.log('✅ Invitation processed successfully');
    return true;
  } catch (error) {
    console.error('❌ Error processing invitation:', error);
    return false;
  }
};

// ============================================
// TAG FUNCTIONS (for "Experienced With")
// ============================================

/**
 * Create a tag for a user (existing or non-user)
 */
export const createTag = async (
  sourceInteractionId: string,
  taggerId: string,
  taggerName: string,
  taggedUserId: string,
  taggedName: string,
  taggedUserEmail: string | undefined,
  thingId: string,
  thingTitle: string,
  state: 'bucketList' | 'completed',
  rating: number | undefined,
  inviteCode: string | undefined
): Promise<string> => {
  try {
    const tagData: Omit<Tag, 'id'> = {
      sourceInteractionId,
      taggerId,
      taggerName,
      taggedUserId,
      taggedName,
      taggedUserEmail,
      thingId,
      thingTitle,
      state,
      rating,
      status: 'pending',
      inviteCode,
      createdAt: Timestamp.now(),
    };
    
    const cleanedData = cleanObject(tagData);
    const docRef = await addDoc(collection(db, 'tags'), cleanedData);
    console.log('✅ Created tag:', docRef.id, 'for', taggedName);
    return docRef.id;
  } catch (error) {
    console.error('Error creating tag:', error);
    throw error;
  }
};

/**
 * Get all pending tags for a user
 */
export const getPendingTags = async (userId: string): Promise<Tag[]> => {
  try {
    const q = query(
      collection(db, 'tags'),
      where('taggedUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Tag));
  } catch (error) {
    console.error('Error getting pending tags:', error);
    return [];
  }
};

/**
 * Get tag by ID
 */
export const getTag = async (tagId: string): Promise<Tag | null> => {
  try {
    const tagDoc = await getDoc(doc(db, 'tags', tagId));
    
    if (!tagDoc.exists()) {
      return null;
    }
    
    return {
      id: tagDoc.id,
      ...tagDoc.data()
    } as Tag;
  } catch (error) {
    console.error('Error getting tag:', error);
    return null;
  }
};

/**
 * Accept a tag - creates a UserThingInteraction mirroring the tagger's state
 */
export const acceptTag = async (
  tagId: string,
  userId: string,
  userName: string
): Promise<boolean> => {
  try {
    const tag = await getTag(tagId);
    
    if (!tag) {
      console.error('Tag not found:', tagId);
      return false;
    }
    
    if (tag.taggedUserId !== userId) {
      console.error('User mismatch for tag acceptance');
      return false;
    }
    
    // Create user's own interaction mirroring the tagger's state
    await createUserThingInteraction(
      userId,
      userName,
      tag.thingId,
      tag.state,
      'private', // Default to private
      {
        rating: tag.rating,
      }
    );
    
    // Update tag status
    await updateDoc(doc(db, 'tags', tagId), {
      status: 'accepted',
    });
    
    console.log('✅ Tag accepted:', tagId);
    return true;
  } catch (error) {
    console.error('Error accepting tag:', error);
    return false;
  }
};

/**
 * Decline a tag
 */
export const declineTag = async (tagId: string, userId: string): Promise<boolean> => {
  try {
    const tag = await getTag(tagId);
    
    if (!tag) {
      console.error('Tag not found:', tagId);
      return false;
    }
    
    if (tag.taggedUserId !== userId) {
      console.error('User mismatch for tag decline');
      return false;
    }
    
    // Update tag status
    await updateDoc(doc(db, 'tags', tagId), {
      status: 'declined',
    });
    
    console.log('✅ Tag declined:', tagId);
    return true;
  } catch (error) {
    console.error('Error declining tag:', error);
    return false;
  }
};

/**
 * Get tags for a specific interaction
 */
export const getTagsForInteraction = async (interactionId: string): Promise<Tag[]> => {
  try {
    const q = query(
      collection(db, 'tags'),
      where('sourceInteractionId', '==', interactionId)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Tag));
  } catch (error) {
    console.error('Error getting tags for interaction:', error);
    return [];
  }
}; 