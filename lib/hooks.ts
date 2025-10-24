/**
 * Custom Hooks for Data Management
 * Provides reusable hooks that use the centralized DataService
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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

  const loadInteractions = useCallback(async (targetId: string) => {
    if (!targetId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await dataService.loadUserInteractions(targetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load interactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (targetUserId) {
      loadInteractions(targetUserId);
    }
  }, [targetUserId, loadInteractions]);

  // Return data directly from Zustand store (which gets updated by other components)
  // Filter by userId if viewing someone else's profile
  const filteredInteractions = targetUserId === user?.uid 
    ? userInteractions 
    : userInteractions.filter(interaction => interaction.userId === targetUserId);

  return {
    interactions: filteredInteractions,
    loading,
    error,
    refetch: () => targetUserId ? loadInteractions(targetUserId) : Promise.resolve(),
  };
};

/**
 * Hook for loading any user's interactions without affecting global state
 */
export const useAnyUserInteractions = (userId: string) => {
  const [interactions, setInteractions] = useState<UserThingInteraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInteractions = useCallback(async (targetId: string) => {
    if (!targetId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const userInteractions = await dataService.loadAnyUserInteractions(targetId);
      setInteractions(userInteractions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load interactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      loadInteractions(userId);
    }
  }, [userId, loadInteractions]);

  return {
    interactions,
    loading,
    error,
    refetch: () => userId ? loadInteractions(userId) : Promise.resolve(),
  };
};

/**
 * Hook for loading and accessing things
 */
export const useThings = (thingIds?: string[]) => {
  const { things } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize the thingIds array to prevent infinite loops
  const memoizedThingIds = useMemo(() => thingIds, [thingIds?.join(',')]);

  const loadThings = useCallback(async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await dataService.loadThings(ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load things');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (memoizedThingIds && memoizedThingIds.length > 0) {
      loadThings(memoizedThingIds);
    }
  }, [memoizedThingIds, loadThings]);

  return {
    things,
    loading,
    error,
    refetch: () => memoizedThingIds ? loadThings(memoizedThingIds) : Promise.resolve(),
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

  const loadRecommendations = useCallback(async (targetId: string) => {
    if (!targetId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await dataService.loadRecommendations(targetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (targetUserId) {
      loadRecommendations(targetUserId);
    }
  }, [targetUserId, loadRecommendations]);

  return {
    recommendations,
    loading,
    error,
    refetch: () => targetUserId ? loadRecommendations(targetUserId) : Promise.resolve(),
  };
};

/**
 * Hook for loading and accessing feed data
 */
export const useFeedData = () => {
  const { things } = useAppStore();
  const { userProfile } = useAuthStore();
  const [feedInteractions, setFeedInteractions] = useState<UserThingInteraction[]>([]);
  const [myInteractions, setMyInteractions] = useState<UserThingInteraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug when userProfile changes
  useEffect(() => {
    console.log('🔍 useFeedData: userProfile changed', {
      userId: userProfile?.id,
      userName: userProfile?.name,
      followingCount: userProfile?.following?.length,
      following: userProfile?.following
    });
  }, [userProfile]);

  // Memoize the following array to prevent infinite loops
  const memoizedFollowing = useMemo(() => {
    console.log('🔍 useFeedData: memoizedFollowing recalculated', {
      following: userProfile?.following,
      followingLength: userProfile?.following?.length,
      userId: userProfile?.id
    });
    return userProfile?.following;
  }, [userProfile?.following?.join(',')]);
  
  const memoizedUserId = useMemo(() => {
    console.log('🔍 useFeedData: memoizedUserId recalculated', {
      userId: userProfile?.id,
      userName: userProfile?.name
    });
    return userProfile?.id;
  }, [userProfile?.id]);

  const loadFeedData = useCallback(async (following: string[], userId: string) => {
    console.log('🔍 useFeedData: loadFeedData function called', {
      following: following?.length,
      userId,
      stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });
    
    if (!following || !userId) {
      console.log('📱 useFeedData: Skipping load - no following list or user ID', {
        following,
        userId
      });
      return;
    }
    
    console.log('📱 useFeedData: Loading feed data...', {
      following,
      userId,
      followingCount: following.length
    });
    
    setLoading(true);
    setError(null);
    
    try {
      const feedData = await dataService.loadFeedData(following, userId);
      // Store feed interactions and my interactions locally
      setFeedInteractions(feedData.interactions);
      setMyInteractions(feedData.myInteractions);
      console.log('✅ useFeedData: Feed data loaded successfully');
    } catch (err) {
      console.error('❌ useFeedData: Error loading feed data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load feed data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Use refs to store current values for event listener
  const followingRef = useRef(memoizedFollowing);
  const userIdRef = useRef(memoizedUserId);
  const loadFeedDataRef = useRef<typeof loadFeedData>();
  
  // Update refs when values change
  useEffect(() => {
    followingRef.current = memoizedFollowing;
    userIdRef.current = memoizedUserId;
    loadFeedDataRef.current = loadFeedData;
  }, [memoizedFollowing, memoizedUserId, loadFeedData]);

  // Single effect to load feed data
  useEffect(() => {
    console.log('🔍 useFeedData: Main effect triggered', {
      memoizedFollowing: memoizedFollowing?.length,
      memoizedUserId,
      hasFollowing: !!memoizedFollowing,
      hasUserId: !!memoizedUserId
    });
    
    if (memoizedFollowing && memoizedFollowing.length > 0 && memoizedUserId) {
      console.log('📱 useFeedData: Loading feed data... (MAIN EFFECT)', {
        following: memoizedFollowing,
        userId: memoizedUserId,
        followingCount: memoizedFollowing.length
      });
      loadFeedData(memoizedFollowing, memoizedUserId);
    }
  }, [memoizedFollowing, memoizedUserId]); // Removed loadFeedData from dependencies

  // Listen for invitation processing events to reload feed
  useEffect(() => {
    console.log('🔍 useFeedData: Event listener effect triggered');
    
    const handleInvitationProcessed = (event: CustomEvent) => {
      console.log('🎁 useFeedData: Invitation processed, reloading feed... (EVENT LISTENER)', event.detail);
      if (followingRef.current && userIdRef.current && loadFeedDataRef.current) {
        loadFeedDataRef.current(followingRef.current, userIdRef.current);
      }
    };

    window.addEventListener('invitationProcessed', handleInvitationProcessed as EventListener);
    
    return () => {
      console.log('🔍 useFeedData: Event listener cleanup');
      window.removeEventListener('invitationProcessed', handleInvitationProcessed as EventListener);
    };
  }, []); // Empty dependency array - only set up listener once

  return {
    things,
    interactions: feedInteractions,
    myInteractions,
    loading,
    error,
    refetch: () => memoizedFollowing && memoizedUserId ? loadFeedData(memoizedFollowing, memoizedUserId) : Promise.resolve(),
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
 * Hook for loading any user's profile without affecting global state
 */
export const useAnyUserProfile = (userId: string) => {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const userProfile = await dataService.loadAnyUserProfile(userId);
      setProfile(userProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return {
    userProfile: profile,
    loading,
    error,
    refetch: loadProfile,
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

  // Memoize filtered interactions to prevent unnecessary re-renders
  const filteredInteractions = useMemo(() => {
    if (!interactions) return [];
    
    if (filter === 'all' || !filter) {
      return interactions;
    } else {
      return interactions.filter(interaction => interaction.state === filter);
    }
  }, [interactions, filter]);

  return {
    interactions: filteredInteractions,
    loading,
    error,
  };
};

/**
 * Hook for filtered interactions of any user without affecting global state
 */
export const useAnyFilteredInteractions = (userId: string, filter?: 'bucketList' | 'completed' | 'inProgress' | 'all') => {
  const { interactions, loading, error } = useAnyUserInteractions(userId);

  // Memoize filtered interactions to prevent unnecessary re-renders
  const filteredInteractions = useMemo(() => {
    if (!interactions) return [];
    
    if (filter === 'all' || !filter) {
      return interactions;
    } else {
      return interactions.filter(interaction => interaction.state === filter);
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
