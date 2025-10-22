/**
 * Custom Hooks for Data Management
 * Provides reusable hooks that use the centralized DataService
 */

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from './store';
import { useAuthStore } from './store';
import { dataService } from './dataService';
import { User, UserThingInteraction, Post } from './types';

/**
 * Hook for loading and accessing user interactions
 */
export const useUserInteractions = (userId?: string) => {
  const { userInteractions } = useAppStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.uid;

  const loadInteractions = useCallback(async () => {
    if (!targetUserId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await dataService.loadUserInteractions(targetUserId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load interactions');
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    loadInteractions();
  }, [loadInteractions]);

  // Return data directly from Zustand store (which gets updated by other components)
  // Filter by userId if viewing someone else's profile
  const filteredInteractions = targetUserId === user?.uid 
    ? userInteractions 
    : userInteractions.filter(interaction => interaction.userId === targetUserId);

  return {
    interactions: filteredInteractions,
    loading,
    error,
    refetch: loadInteractions,
  };
};

/**
 * Hook for loading and accessing things
 */
export const useThings = (thingIds?: string[]) => {
  const { things } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThings = useCallback(async () => {
    if (!thingIds || thingIds.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await dataService.loadThings(thingIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load things');
    } finally {
      setLoading(false);
    }
  }, [thingIds]);

  useEffect(() => {
    loadThings();
  }, [loadThings]);

  return {
    things,
    loading,
    error,
    refetch: loadThings,
  };
};

/**
 * Hook for loading and accessing recommendations
 */
export const useRecommendations = (userId?: string) => {
  const { recommendations } = useAppStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.uid;

  const loadRecommendations = useCallback(async () => {
    if (!targetUserId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await dataService.loadRecommendations(targetUserId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  return {
    recommendations,
    loading,
    error,
    refetch: loadRecommendations,
  };
};

/**
 * Hook for loading and accessing feed data
 */
export const useFeedData = () => {
  const { things, userInteractions } = useAppStore();
  const { userProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeedData = useCallback(async () => {
    if (!userProfile?.following || !userProfile.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await dataService.loadFeedData(userProfile.following, userProfile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed data');
    } finally {
      setLoading(false);
    }
  }, [userProfile?.following, userProfile?.id]);

  useEffect(() => {
    loadFeedData();
  }, [loadFeedData]);

  return {
    things,
    interactions: userInteractions,
    loading,
    error,
    refetch: loadFeedData,
  };
};

/**
 * Hook for loading and accessing user profile
 */
export const useUserProfile = (userId?: string) => {
  const { userProfile } = useAuthStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.uid;

  const loadUserProfile = useCallback(async () => {
    if (!targetUserId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await dataService.loadUserProfile(targetUserId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  return {
    userProfile,
    loading,
    error,
    refetch: loadUserProfile,
  };
};

/**
 * Hook for performing searches
 */
export const useSearch = () => {
  const [searchResults, setSearchResults] = useState<{ users: User[]; posts: Post[] }>({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults({ users: [], posts: [] });
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const results = await dataService.performSearch(searchTerm);
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform search');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    searchResults,
    loading,
    error,
    search: performSearch,
  };
};

/**
 * Hook for filtered user interactions (bucket list, completed, etc.)
 */
export const useFilteredInteractions = (userId?: string, filter?: 'bucketList' | 'completed' | 'inProgress' | 'all') => {
  const { interactions, loading, error } = useUserInteractions(userId);
  const [filteredInteractions, setFilteredInteractions] = useState<UserThingInteraction[]>([]);

  useEffect(() => {
    if (!interactions) {
      setFilteredInteractions([]);
      return;
    }

    if (filter === 'all' || !filter) {
      setFilteredInteractions(interactions);
    } else {
      setFilteredInteractions(interactions.filter(interaction => interaction.state === filter));
    }
  }, [interactions, filter]);

  return {
    interactions: filteredInteractions,
    loading,
    error,
  };
};

/**
 * Hook for getting a specific thing by ID
 */
export const useThing = (thingId: string) => {
  const { getThingById } = useAppStore();
  const thing = getThingById(thingId);
  
  return {
    thing,
    exists: !!thing,
  };
};

/**
 * Hook for getting a specific user interaction by thing ID
 */
export const useUserInteraction = (thingId: string) => {
  const { getUserInteractionByThingId } = useAppStore();
  const interaction = getUserInteractionByThingId(thingId);
  
  return {
    interaction,
    exists: !!interaction,
  };
};
