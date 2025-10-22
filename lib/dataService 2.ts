/**
 * Centralized Data Service
 * Manages Firestore ↔ Zustand sync and provides consistent data loading patterns
 */

import { useAppStore } from './store';
import { useAuthStore } from './store';
import { 
  getUserThingInteractions, 
  getThing, 
  getRecommendationsReceived,
  universalSearch
} from './firestore';
import { getUserProfile } from './auth';
import { User, Thing, UserThingInteraction, Recommendation, Post } from './types';

/**
 * Data loading service that syncs Firestore data with Zustand store
 */
export class DataService {
  private static instance: DataService;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds
  
  static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  private getCacheKey(method: string, ...args: unknown[]): string {
    return `${method}:${args.join(':')}`;
  }

  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data as T;
    }
    return null;
  }

  private setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Load user interactions and sync with store
   */
  async loadUserInteractions(userId: string): Promise<UserThingInteraction[]> {
    const cacheKey = this.getCacheKey('loadUserInteractions', userId);
    const cached = this.getCachedData<UserThingInteraction[]>(cacheKey);
    
    if (cached) {
      // Use cached data if available
      return cached;
    }
    
    try {
      // Load user interactions from Firestore
      const interactions = await getUserThingInteractions(userId);
      
      // Sync with Zustand store
      const { setUserInteractions } = useAppStore.getState();
      setUserInteractions(interactions);
      
      // Cache the result
      this.setCachedData(cacheKey, interactions);
      
      // Interactions loaded successfully
      return interactions;
    } catch (error) {
      console.error('❌ DataService: Error loading user interactions:', error);
      throw error;
    }
  }

  /**
   * Load things by IDs and sync with store
   */
  async loadThings(thingIds: string[]): Promise<Thing[]> {
    try {
      // Load things from Firestore
      const things: Thing[] = [];
      
      // Load each thing individually since there's no batch function
      for (const thingId of thingIds) {
        const thing = await getThing(thingId);
        if (thing) {
          things.push(thing);
        }
      }
      
      // Sync with Zustand store
      const { setThings } = useAppStore.getState();
      setThings(things);
      
      // Things loaded successfully
      return things;
    } catch (error) {
      console.error('❌ DataService: Error loading things:', error);
      throw error;
    }
  }

  /**
   * Load recommendations and sync with store
   */
  async loadRecommendations(userId: string): Promise<Recommendation[]> {
    try {
      // Load recommendations from Firestore
      const recommendations = await getRecommendationsReceived(userId);
      
      // Sync with Zustand store
      const { setRecommendations } = useAppStore.getState();
      setRecommendations(recommendations);
      
      // Recommendations loaded successfully
      return recommendations;
    } catch (error) {
      console.error('❌ DataService: Error loading recommendations:', error);
      throw error;
    }
  }

  /**
   * Get interactions for multiple users (for feed data)
   */
  private async getInteractionsForUsers(userIds: string[]): Promise<UserThingInteraction[]> {
    try {
      const { collection, query, where, orderBy, getDocs, limit } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      
      const interactionsRef = collection(db, 'user_thing_interactions');
      const q = query(
        interactionsRef,
        where('userId', 'in', userIds),
        where('visibility', 'in', ['public', 'friends']),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UserThingInteraction));
    } catch (error) {
      console.error('Error getting interactions for users:', error);
      return [];
    }
  }

  /**
   * Load feed data (things + interactions) and sync with store
   */
  async loadFeedData(following: string[], userId: string): Promise<{ things: Thing[]; interactions: UserThingInteraction[] }> {
    const cacheKey = this.getCacheKey('loadFeedData', following.join(','), userId);
    const cached = this.getCachedData<{ things: Thing[]; interactions: UserThingInteraction[] }>(cacheKey);
    
    if (cached) {
      // Use cached feed data if available
      return cached;
    }
    
    try {
      // Load feed data from Firestore
      
      // Get all interactions from followed users + current user
      const allUserIds = [...following, userId];
      const interactions = await this.getInteractionsForUsers(allUserIds);
      
      // Get unique thing IDs
      const thingIds = [...new Set(interactions.map(i => i.thingId))];
      
      // Load things in parallel (more efficient than sequential)
      const things = await Promise.all(
        thingIds.map(async (thingId) => {
          try {
            return await getThing(thingId);
          } catch (error) {
            console.warn('Failed to load thing:', thingId, error);
            return null;
          }
        })
      );
      
      // Filter out null things
      const validThings = things.filter(thing => thing !== null) as Thing[];
      
      // Sync with Zustand store
      const { setThings, setUserInteractions } = useAppStore.getState();
      setThings(validThings);
      setUserInteractions(interactions);
      
      // Cache the result
      const result = { things: validThings, interactions };
      this.setCachedData(cacheKey, result);
      
      // Feed data loaded successfully
      return result;
    } catch (error) {
      console.error('❌ DataService: Error loading feed data:', error);
      throw error;
    }
  }

  /**
   * Load user profile and sync with auth store
   */
  async loadUserProfile(userId: string): Promise<User | null> {
    try {
      // Load user profile from Firestore
      const userProfile = await getUserProfile(userId);
      
      // Sync with auth store
      const { setUserProfile } = useAuthStore.getState();
      setUserProfile(userProfile);
      
      // User profile loaded successfully
      return userProfile;
    } catch (error) {
      console.error('❌ DataService: Error loading user profile:', error);
      throw error;
    }
  }

  /**
   * Perform universal search
   */
  async performSearch(searchTerm: string): Promise<{ users: User[]; posts: Post[] }> {
    try {
      // Perform search
      const results = await universalSearch(searchTerm);
      
      // Search completed successfully
      return results;
    } catch (error) {
      console.error('❌ DataService: Error performing search:', error);
      throw error;
    }
  }

  /**
   * Update user interaction in both Firestore and store
   */
  async updateUserInteraction(interactionId: string, updates: Partial<UserThingInteraction>): Promise<void> {
    try {
      // Update user interaction
      
      // Update in Zustand store immediately (optimistic update)
      const { updateUserInteraction } = useAppStore.getState();
      updateUserInteraction(interactionId, updates);
      
      // TODO: Update in Firestore (this would be implemented in firestore.ts)
      // await updateUserInteractionInFirestore(interactionId, updates);
      
      // User interaction updated successfully
    } catch (error) {
      console.error('❌ DataService: Error updating user interaction:', error);
      throw error;
    }
  }

  /**
   * Remove user interaction from both Firestore and store
   */
  async removeUserInteraction(interactionId: string): Promise<void> {
    try {
      // Remove user interaction
      
      // Remove from Zustand store immediately (optimistic update)
      const { removeUserInteraction } = useAppStore.getState();
      removeUserInteraction(interactionId);
      
      // TODO: Remove from Firestore (this would be implemented in firestore.ts)
      // await removeUserInteractionFromFirestore(interactionId);
      
      // User interaction removed successfully
    } catch (error) {
      console.error('❌ DataService: Error removing user interaction:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const dataService = DataService.getInstance();
