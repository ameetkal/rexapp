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
import { Post, User, Category, PersonalItem, PersonalItemStatus, UniversalItem } from './types';

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
    
    console.log(`👥 Searching ${querySnapshot.size} users for: "${searchTerm}"`);
    
    querySnapshot.forEach((doc) => {
      const user = doc.data() as User;
      const nameMatch = user.name.toLowerCase().includes(searchTerm.toLowerCase());
      const emailMatch = user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (nameMatch || emailMatch) {
        console.log(`✅ User match: ${user.name} (${user.email})`, { nameMatch, emailMatch });
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
      }),
    };
    
    const docRef = await addDoc(collection(db, 'posts'), postData);
    const postId = docRef.id;

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