'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthStore, useAppStore } from '@/lib/store';
import { followUser, unfollowUser, getSuggestedUsers } from '@/lib/firestore';
import { Thing, UserThingInteraction, FeedThing, User } from '@/lib/types';
import ThingCard from './ThingCard';
import ThingDetailModal from './ThingDetailModal';
import MapView from './MapView';
import MapPopup from './MapPopup';
import { UserPlusIcon, MagnifyingGlassIcon, UserMinusIcon, MapIcon } from '@heroicons/react/24/outline';
import { useFeedData, useSearch, usePlaceSearch, useAPISearch } from '@/lib/hooks';
import { Timestamp } from 'firebase/firestore';

interface FeedScreenProps {
  onUserProfileClick?: (authorId: string) => void;
  onNavigateToAdd?: () => void;
  onEditInteraction?: (interaction: UserThingInteraction, thing: Thing) => void;
}

export default function FeedScreen({ onUserProfileClick, onNavigateToAdd, onEditInteraction }: FeedScreenProps = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);
  const [useThingFeed, setUseThingFeed] = useState(true); // Toggle between Things and Map
  const [showAllResults, setShowAllResults] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  // Track locally followed users to avoid triggering feed reload
  const [locallyFollowed, setLocallyFollowed] = useState<Set<string>>(new Set());
  // Detect mobile screen size
  const [isMobile, setIsMobile] = useState(false);
  // Track if mobile overlay transition is happening to prevent focus clearing
  const mobileOverlayOpeningRef = useRef(false);
  // Track if suggestions were visible when follow action started (to maintain longer delay)
  const suggestionsWereVisibleRef = useRef(false);
  const [selectedPlaceLocation, setSelectedPlaceLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedThing, setSelectedThing] = useState<Thing | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  
  const { user, userProfile, setUserProfile } = useAuthStore();
  const { autoOpenThingId } = useAppStore();

  // Listen for switchToThingsFeed event
  useEffect(() => {
    const handleSwitchToThingsFeed = () => {
      setUseThingFeed(true);
    };

    window.addEventListener('switchToThingsFeed', handleSwitchToThingsFeed);
    return () => {
      window.removeEventListener('switchToThingsFeed', handleSwitchToThingsFeed);
    };
  }, []);

  // Reset selectedPlaceLocation after a short delay to allow map to center
  useEffect(() => {
    if (selectedPlaceLocation) {
      const timer = setTimeout(() => {
        console.log('🗺️ Clearing selectedPlaceLocation after centering');
        setSelectedPlaceLocation(null);
      }, 3000); // Give map 3 seconds to load and center
      return () => clearTimeout(timer);
    }
  }, [selectedPlaceLocation]);

  // Wrapper function to handle both user IDs and usernames
  const handleUserClick = async (userIdOrUsername: string) => {
    if (!onUserProfileClick) return;
    
    // If it looks like a username (starts with @ or is a short string without underscores), look up user ID
    if (userIdOrUsername.startsWith('@') || (!userIdOrUsername.includes('_') && userIdOrUsername.length < 20)) {
      const username = userIdOrUsername.startsWith('@') ? userIdOrUsername.slice(1) : userIdOrUsername;
      
      try {
        // Search for user by username
        const { searchUsers } = await import('@/lib/firestore');
        const users = await searchUsers(username);
        const matchingUser = users.find(u => u.username === username);
        
        if (matchingUser) {
          onUserProfileClick(matchingUser.id);
        } else {
          console.log('User not found:', username);
        }
      } catch (error) {
        console.error('Error looking up user:', error);
      }
    } else {
      // Assume it's a user ID, pass it directly
      onUserProfileClick(userIdOrUsername);
    }
  };
  
  // Use our new custom hooks for clean data access
  const { things, interactions, myInteractions, loading: feedLoading } = useFeedData();
  
  // Helper function to find an existing Thing for a place
  const findExistingThingForPlace = useCallback((placeId: string, placeName: string): Thing | null => {
    // First try to find by sourceId (if it exists)
    let foundThing = things.find(
      thing => thing.category === 'places' && thing.sourceId === placeId
    ) || null;
    
    // If not found by sourceId, try matching by title (for backwards compatibility)
    if (!foundThing) {
      foundThing = things.find(
        thing => thing.category === 'places' && thing.title.toLowerCase() === placeName.toLowerCase()
      ) || null;
    }
    
    if (foundThing) {
      console.log('✅ Found existing Thing for place:', placeId, foundThing);
    } else {
      console.log('❌ No existing Thing found for place:', placeId, `(checked ${things.length} things)`);
    }
    
    return foundThing;
  }, [things]);
  const { searchResults, loading: searchLoading, search } = useSearch();
  const { places, loading: placesLoading, searchPlaces } = usePlaceSearch();
  const { results: apiResults, loading: apiLoading, searchAPIs } = useAPISearch();

  // Define search-related variables early
  const showingSearchResults = (searchResults.users.length > 0 || searchResults.things.length > 0 || apiResults.length > 0 || searchLoading || apiLoading) && useThingFeed && searchTerm.trim().length > 0;
  const showingPlaceResults = (places.length > 0 || placesLoading) && !useThingFeed && searchTerm.trim().length > 0;
  
  // Debug logging for place search
  useEffect(() => {
    if (!useThingFeed && searchTerm.trim().length > 0) {
      console.log('🎯 Place search state:', { 
        showingPlaceResults, 
        placesCount: places.length, 
        placesLoading,
        searchTerm,
        useThingFeed
      });
    }
  }, [showingPlaceResults, places.length, placesLoading, searchTerm, useThingFeed, places]);
  
  // Debug logging for search results
  useEffect(() => {
    if (useThingFeed && searchTerm.trim().length > 0) {
      console.log('🔍 Search results:', {
        usersCount: searchResults.users.length,
        thingsCount: searchResults.things.length,
        searchLoading
      });
    }
  }, [searchResults, searchLoading, useThingFeed, searchTerm]);
  
  // Debug logging
  useEffect(() => {
    if (!useThingFeed) {
      console.log('🗺️ Map view state:', {
        searchTerm: searchTerm.trim(),
        placesCount: places.length,
        placesLoading,
        showingPlaceResults,
      });
    }
  }, [searchTerm, places.length, placesLoading, showingPlaceResults, useThingFeed]);
  const INITIAL_RESULT_LIMIT = 5;
  const displayedUsers = showAllResults 
    ? searchResults.users 
    : searchResults.users.slice(0, INITIAL_RESULT_LIMIT);
  const hasMoreResults = searchResults.users.length > INITIAL_RESULT_LIMIT;

  // Convert feed data to FeedThing format for compatibility
  const feedThings: FeedThing[] = things
    .filter((thing, index, self) => {
      // Remove duplicates based on thing.id
      const isDuplicate = index !== self.findIndex(t => t.id === thing.id);
      // Silently filter out duplicates
      return !isDuplicate;
    })
    .filter(thing => {
      // Show things that have interactions from followed users OR your own interactions
      const thingInteractions = interactions.filter(i => i.thingId === thing.id);
      const myInteraction = myInteractions.find(i => i.thingId === thing.id);
      return thingInteractions.length > 0 || !!myInteraction; // Show if interactions from followed users OR your own interaction
    })
    .map(thing => {
      const thingInteractions = interactions.filter(i => i.thingId === thing.id);
      const myInteraction = myInteractions.find(i => i.thingId === thing.id);
      
      // Calculate average rating
      const completedWithRatings = thingInteractions.filter(i => i.state === 'completed' && i.rating && i.rating > 0);
      const avgRating = completedWithRatings.length > 0 
        ? completedWithRatings.reduce((sum, i) => sum + (i.rating || 0), 0) / completedWithRatings.length
        : null;
      
      // Safe conversion: handle both Timestamp and Date objects
      const getDate = (dateObj: Date | { seconds: number; nanoseconds?: number } | { toDate: () => Date } | null): Date | null => {
        if (!dateObj) return null;
        if (dateObj instanceof Date) return dateObj;
        
        // Type guard for objects with toDate method
        if ('toDate' in dateObj && typeof dateObj.toDate === 'function') {
          return dateObj.toDate();
        }
        
        // Handle plain timestamp objects with seconds/nanoseconds
        if ('seconds' in dateObj && typeof dateObj.seconds === 'number') {
          return new Date(dateObj.seconds * 1000 + (dateObj.nanoseconds || 0) / 1000000);
        }
        
        return null;
      };
      
      // Find most recent interaction creation (when someone first interacted with this thing)
      const mostRecentUpdate = thingInteractions.reduce((latest, i) => {
        // Use createdAt to show when the interaction was first created
        const interactionCreatedAt = i.createdAt;
        
        const currentDate = getDate(interactionCreatedAt);
        if (!latest) return currentDate;
        if (!currentDate) return latest;
        return currentDate > latest ? currentDate : latest;
      }, null as Date | null);
      
      // If no valid dates found, use thing creation date as fallback
      const finalMostRecentUpdate = mostRecentUpdate || (thing.createdAt ? 
        getDate(thing.createdAt) : null);
      
      return {
        thing,
        interactions: thingInteractions,
        myInteraction,
        avgRating,
        mostRecentUpdate: finalMostRecentUpdate
      };
    })
    .sort((a, b) => {
      // Sort by most recent activity (newest first)
      const getTimestamp = (timestamp: Date | null): number => {
        if (!timestamp) return 0;
        return timestamp.getTime();
      };
      
      const aTime = getTimestamp(a.mostRecentUpdate);
      const bTime = getTimestamp(b.mostRecentUpdate);
      
      // Sort by most recent activity (newest first)
      return bTime - aTime;
    });

  // Auto-search with debouncing (300ms delay) - Things view
  useEffect(() => {
    if (!useThingFeed) return; // Only run for Things view
    
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        search(searchTerm.trim());
        setShowAllResults(false); // Reset "show all" when new search
      } else if (searchTerm.trim().length === 0) {
        // Clear results when search is empty
        search('');
        setShowAllResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, search, useThingFeed]);

  // Auto-search with debouncing (300ms delay) - Map view
  useEffect(() => {
    if (useThingFeed) return; // Only run for Map view
    
    console.log('🗺️ Map auto-search triggered with term:', searchTerm);
    
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        console.log('🔍 Calling searchPlaces with:', searchTerm.trim());
        searchPlaces(searchTerm.trim());
        setShowAllResults(false); // Reset "show all" when new search
      } else if (searchTerm.trim().length === 0) {
        // Clear results when search is empty
        console.log('🗑️ Clearing search results');
        searchPlaces('');
        setShowAllResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchPlaces, useThingFeed]);

  const handleSearch = useCallback(() => {
    if (searchTerm.trim()) {
      if (useThingFeed) {
        // First search database
        search(searchTerm);
        // Then search APIs (on Enter key)
        searchAPIs(searchTerm);
      } else {
        searchPlaces(searchTerm);
      }
      setShowAllResults(false);
    }
  }, [searchTerm, search, searchPlaces, useThingFeed, searchAPIs]);

  // Debounced batch update of userProfile to prevent multiple feed reloads
  // Track both follows and unfollows: Set contains user IDs
  // For unfollows, we check if the user is already in following list when applying
  const pendingFollowsRef = useRef<Set<string>>(new Set());
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [pendingFollowsCount, setPendingFollowsCount] = useState(0);
  // Track which pending actions are unfollows
  const pendingUnfollowsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Clean up locallyFollowed when userProfile actually updates
    if (userProfile?.following) {
      setLocallyFollowed(prev => {
        const next = new Set(prev);
        // Remove any IDs that are now in the actual following list
        userProfile.following.forEach(id => {
          if (next.has(id)) {
            next.delete(id);
            pendingFollowsRef.current.delete(id);
            pendingUnfollowsRef.current.delete(id);
            setPendingFollowsCount(prevCount => Math.max(0, prevCount - 1));
          }
        });
        return next;
      });
    }
  }, [userProfile?.following]);

  // Batch update userProfile after debounce period
  // Delay longer if suggestions are visible to avoid disrupting the UI
  useEffect(() => {
    if (pendingFollowsCount === 0) return;

    console.log('🟡 FeedScreen: Batch update effect triggered', { 
      pendingFollowsCount, 
      pendingFollowsSize: pendingFollowsRef.current.size,
      pendingUnfollowsSize: pendingUnfollowsRef.current.size,
      pendingFollows: Array.from(pendingFollowsRef.current),
      pendingUnfollows: Array.from(pendingUnfollowsRef.current),
      isSearchFocused,
      showingSuggestions: isSearchFocused && suggestedUsers.length > 0
    });

    // Clear existing timeout
    if (updateTimeoutRef.current) {
      console.log('🟡 FeedScreen: Clearing existing timeout');
      clearTimeout(updateTimeoutRef.current);
    }

    // Use longer delay if suggestions were visible when follow started (even if blur occurred)
    // Check both current state and ref (in case click caused blur)
    const suggestionsVisible = (isSearchFocused && suggestedUsers.length > 0) || suggestionsWereVisibleRef.current;
    const delay = suggestionsVisible ? 5000 : 1000;

    // Set new timeout to batch update
    console.log('🟡 FeedScreen: Setting debounce timeout', { delay, ms: `${delay}ms` });
    updateTimeoutRef.current = setTimeout(() => {
      console.log('🟢 FeedScreen: Debounce timeout fired, updating userProfile', {
        pendingSize: pendingFollowsRef.current.size,
        currentFollowingCount: userProfile?.following.length,
        isSearchFocused
      });
      if (userProfile && (pendingFollowsRef.current.size > 0 || pendingUnfollowsRef.current.size > 0)) {
        // Handle both follows and unfollows in the pending batch
        const currentFollowing = [...userProfile.following];
        const updatedFollowing = [...currentFollowing];
        
        // Process unfollows first (remove from list)
        pendingUnfollowsRef.current.forEach(userId => {
          const index = updatedFollowing.indexOf(userId);
          if (index > -1) {
            updatedFollowing.splice(index, 1);
          }
        });
        
        // Then process follows (add to list if not already there)
        pendingFollowsRef.current.forEach(userId => {
          if (!updatedFollowing.includes(userId)) {
            updatedFollowing.push(userId);
          }
        });
        
        const updatedProfile = {
          ...userProfile,
          following: updatedFollowing,
        };
        console.log('🟢 FeedScreen: Calling setUserProfile', {
          oldCount: userProfile.following.length,
          newCount: updatedProfile.following.length,
          pendingFollows: Array.from(pendingFollowsRef.current),
          pendingUnfollows: Array.from(pendingUnfollowsRef.current)
        });
        setUserProfile(updatedProfile);
        pendingFollowsRef.current.clear();
        pendingUnfollowsRef.current.clear();
        setPendingFollowsCount(0);
        console.log('🟢 FeedScreen: userProfile updated, pending cleared');
        // Reset the flag after updating
        suggestionsWereVisibleRef.current = false;
      }
    }, delay); // Longer delay when suggestions are visible to avoid disrupting UI

    return () => {
      if (updateTimeoutRef.current) {
        console.log('🟡 FeedScreen: Cleanup - clearing timeout');
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [pendingFollowsCount, userProfile, setUserProfile, isSearchFocused, suggestedUsers.length]);

  // Ensure isSearchFocused is true when mobile overlay opens and prevent it from being cleared
  useEffect(() => {
    if (isMobileSearchOpen && isMobile) {
      console.log('🔍 FeedScreen: Mobile overlay opened, ensuring focus state');
      mobileOverlayOpeningRef.current = true;
      setIsSearchFocused(true);
      // Reset the flag after a delay to allow mobile input to take focus
      setTimeout(() => {
        mobileOverlayOpeningRef.current = false;
      }, 300);
    } else {
      mobileOverlayOpeningRef.current = false;
    }
  }, [isMobileSearchOpen, isMobile]);

  // Update userProfile immediately when suggestions view closes (if there are pending follows/unfollows)
  useEffect(() => {
    // If we were showing suggestions and now we're not, update userProfile immediately
    // But only if we haven't already set a timeout (avoid double updates)
    const hasPendingActions = pendingFollowsRef.current.size > 0 || pendingUnfollowsRef.current.size > 0;
    if (!isSearchFocused && hasPendingActions && userProfile && !updateTimeoutRef.current) {
      console.log('🟢 FeedScreen: Suggestions closed, updating userProfile immediately', {
        pendingFollowsSize: pendingFollowsRef.current.size,
        pendingUnfollowsSize: pendingUnfollowsRef.current.size
      });
      
      // Apply both follows and unfollows
      const currentFollowing = [...userProfile.following];
      const updatedFollowing = [...currentFollowing];
      
      // Process unfollows first
      pendingUnfollowsRef.current.forEach(userId => {
        const index = updatedFollowing.indexOf(userId);
        if (index > -1) {
          updatedFollowing.splice(index, 1);
        }
      });
      
      // Then process follows
      pendingFollowsRef.current.forEach(userId => {
        if (!updatedFollowing.includes(userId)) {
          updatedFollowing.push(userId);
        }
      });
      
      const updatedProfile = {
        ...userProfile,
        following: updatedFollowing,
      };
      setUserProfile(updatedProfile);
      pendingFollowsRef.current.clear();
      pendingUnfollowsRef.current.clear();
      setPendingFollowsCount(0);
      suggestionsWereVisibleRef.current = false;
    }
  }, [isSearchFocused, userProfile, setUserProfile]);

  // Load suggested users when search is focused and empty
  useEffect(() => {
    const loadSuggestions = async () => {
      console.log('🔍 FeedScreen: loadSuggestions effect running', {
        useThingFeed,
        hasUser: !!user,
        hasUserProfile: !!userProfile,
        isSearchFocused,
        searchTermLength: searchTerm.trim().length
      });
      
      if (!useThingFeed || !user || !userProfile) {
        console.log('🔍 FeedScreen: Skipping suggestions - missing requirements');
        return;
      }
      if (!isSearchFocused || searchTerm.trim().length > 0) {
        console.log('🔍 FeedScreen: Clearing suggestions - not focused or has search term');
        setSuggestedUsers([]);
        return;
      }
      
      console.log('🔍 FeedScreen: Loading suggested users...');
      setLoadingSuggestions(true);
      try {
        const suggestions = await getSuggestedUsers(user.uid, userProfile.following || [], 8);
        console.log('🔍 FeedScreen: Loaded suggested users', { count: suggestions.length });
        setSuggestedUsers(suggestions);
      } catch (error) {
        console.error('🔍 FeedScreen: Error loading suggested users:', error);
        setSuggestedUsers([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };
    
    loadSuggestions();
  }, [isSearchFocused, searchTerm, user, userProfile, useThingFeed]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setShowAllResults(false);
    setIsMobileSearchOpen(false);
    setIsSearchFocused(false);
    // Manually clear search results
    if (useThingFeed) {
      search('');
    } else {
      searchPlaces('');
    }
  }, [useThingFeed, search, searchPlaces]);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showingSearchResults) {
        clearSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showingSearchResults, clearSearch]);

  // Handle click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Don't close if clicking on search input or results
      if (target.closest('.search-container') || target.closest('.search-results')) {
        return;
      }
      
      if (showingSearchResults) {
        clearSearch();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showingSearchResults, clearSearch]);

  const handleFollow = async (targetUserId: string) => {
    if (!user || !userProfile) return;
    
    // Use the ref that was set in onMouseDown (captures state before blur)
    const wereSuggestionsVisible = suggestionsWereVisibleRef.current;
    
    console.log('🔵 FeedScreen: handleFollow called', { 
      targetUserId, 
      currentFollowing: userProfile.following.length,
      wereSuggestionsVisible,
      isSearchFocused,
      suggestedUsersCount: suggestedUsers.length
    });
    
    setLoadingFollow(targetUserId);
    
    // Track locally for suggestions (avoids triggering feed reload)
    setLocallyFollowed(prev => {
      const next = new Set(prev).add(targetUserId);
      console.log('🔵 FeedScreen: locallyFollowed updated', { size: next.size, ids: Array.from(next) });
      return next;
    });
    
    // Remove from suggested users list immediately (smooth UX)
    setSuggestedUsers(prev => prev.filter(u => u.id !== targetUserId));
    
    try {
      console.log('🔵 FeedScreen: Calling followUser...');
      await followUser(user.uid, targetUserId);
      console.log('🔵 FeedScreen: followUser completed successfully');
      
      // Add to pending follows batch (will update userProfile after debounce)
      pendingFollowsRef.current.add(targetUserId);
      // Remove from pending unfollows if it was there (user unfollowed then followed quickly)
      pendingUnfollowsRef.current.delete(targetUserId);
      const newCount = pendingFollowsRef.current.size + pendingUnfollowsRef.current.size;
      setPendingFollowsCount(newCount);
      console.log('🔵 FeedScreen: Added to pending batch', { 
        targetUserId, 
        pendingCount: newCount,
        pendingFollows: Array.from(pendingFollowsRef.current),
        pendingUnfollows: Array.from(pendingUnfollowsRef.current),
        suggestionsWereVisible: wereSuggestionsVisible
      });
      // This triggers the batch update effect after debounce
    } catch (error) {
      console.error('🔴 FeedScreen: Error following user:', error);
      // Rollback on error
      setLocallyFollowed(prev => {
        const next = new Set(prev);
        next.delete(targetUserId);
        console.log('🔴 FeedScreen: Rolled back locallyFollowed', { size: next.size });
        return next;
      });
      pendingFollowsRef.current.delete(targetUserId);
      pendingUnfollowsRef.current.delete(targetUserId);
      setPendingFollowsCount(prev => Math.max(0, prev - 1));
      suggestionsWereVisibleRef.current = false;
    } finally {
      setLoadingFollow(null);
    }
  };

  const handleUnfollow = async (targetUserId: string) => {
    if (!user || !userProfile) return;
    
    // Use the ref that was set in onMouseDown (captures state before blur)
    const wereSuggestionsVisible = suggestionsWereVisibleRef.current;
    
    console.log('🔵 FeedScreen: handleUnfollow called', { 
      targetUserId, 
      currentFollowing: userProfile.following.length,
      wereSuggestionsVisible,
      isSearchFocused,
      suggestedUsersCount: suggestedUsers.length
    });
    
    setLoadingFollow(targetUserId);
    
    // Track locally for search results (avoids triggering feed reload immediately)
    setLocallyFollowed(prev => {
      const next = new Set(prev);
      next.delete(targetUserId);
      console.log('🔵 FeedScreen: locallyFollowed updated (unfollow)', { size: next.size, ids: Array.from(next) });
      return next;
    });
    
    try {
      await unfollowUser(user.uid, targetUserId);
      
      // Add to pending unfollows batch (will update userProfile after debounce)
      pendingUnfollowsRef.current.add(targetUserId);
      // Remove from pending follows if it was there
      pendingFollowsRef.current.delete(targetUserId);
      const newCount = pendingFollowsRef.current.size + pendingUnfollowsRef.current.size;
      setPendingFollowsCount(newCount);
      console.log('🔵 FeedScreen: Added to pending batch (unfollow)', { 
        targetUserId, 
        pendingCount: newCount,
        pendingFollows: Array.from(pendingFollowsRef.current),
        pendingUnfollows: Array.from(pendingUnfollowsRef.current),
        suggestionsWereVisible: wereSuggestionsVisible
      });
      // This triggers the batch update effect after debounce
    } catch (error) {
      console.error('🔴 FeedScreen: Error unfollowing user:', error);
      // Rollback on error
      setLocallyFollowed(prev => {
        const next = new Set(prev);
        next.add(targetUserId);
        console.log('🔴 FeedScreen: Rolled back locallyFollowed (unfollow)', { size: next.size });
        return next;
      });
      pendingFollowsRef.current.delete(targetUserId);
      pendingUnfollowsRef.current.delete(targetUserId);
      setPendingFollowsCount(prev => Math.max(0, prev - 1));
      suggestionsWereVisibleRef.current = false;
    } finally {
      setLoadingFollow(null);
    }
  };

  const isFollowing = (userId: string) => {
    // Check actual following list and locally tracked state
    const inFollowing = userProfile?.following.includes(userId) || false;
    
    // Optimistic updates:
    // - If in locallyFollowed, we're optimistically following
    // - If in pendingUnfollows, we're optimistically NOT following (even if in following list)
    // - Otherwise, use the actual following list state
    if (pendingUnfollowsRef.current.has(userId)) {
      return false; // Optimistically unfollowed
    }
    if (locallyFollowed.has(userId)) {
      return true; // Optimistically following
    }
    return inFollowing;
  };

  if (feedLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      {/* Universal Search */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10 search-container">
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onFocus={() => {
                console.log('🔍 FeedScreen: Search input focused (desktop/main)');
                setIsSearchFocused(true);
                if (isMobile) {
                  // Set mobile overlay open first, then ensure focus stays
                  setIsMobileSearchOpen(true);
                  // Use a longer delay to ensure mobile input gets focus before clearing
                  setTimeout(() => setIsSearchFocused(true), 100);
                }
              }}
              onBlur={() => {
                // Don't clear focus if mobile overlay is opening (will be handled by mobile input)
                // Check if overlay is open or opening
                if (isMobile && (isMobileSearchOpen || mobileOverlayOpeningRef.current)) {
                  console.log('🔍 FeedScreen: Desktop input blur - ignoring because mobile overlay is opening');
                  return; // Don't clear focus, mobile overlay will handle it
                }
                
                // Desktop: normal blur handling
                if (!isMobile) {
                  setTimeout(() => setIsSearchFocused(false), 200);
                }
              }}
              placeholder={!useThingFeed ? "Search for places..." : "Search people, books, places, movies..."}
              className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500 bg-white text-base"
              autoComplete="off"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
            {searchLoading && !searchTerm && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          {useThingFeed && (
          <button
              onClick={() => setUseThingFeed(false)}
              className="flex-shrink-0 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
              aria-label="View Map"
              title="View Map"
            >
              <MapIcon className="w-6 h-6" />
          </button>
          )}
        </div>
        
        {showingSearchResults && !isMobileSearchOpen && (
          <div className="mt-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              {searchLoading ? 'Searching...' : `Search results for "${searchTerm}"`}
            </h3>
            <button
              onClick={clearSearch}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Mobile Search Overlay */}
      {isMobileSearchOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-white z-50 overflow-y-auto"
          onFocus={() => {
            // Ensure focus state is set when overlay is mounted
            if (!isSearchFocused) {
              console.log('🔍 FeedScreen: Mobile overlay mounted, setting focus state');
              setIsSearchFocused(true);
            }
          }}
        >
          {/* Mobile Search Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setIsMobileSearchOpen(false);
                  setIsSearchFocused(false);
                }}
                className="text-gray-600 hover:text-gray-800"
                aria-label="Close search"
              >
                ←
              </button>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  onFocus={() => {
                    console.log('🔍 FeedScreen: Search input focused (mobile overlay)');
                    setIsSearchFocused(true);
                  }}
                  onBlur={() => {
                    // Delay to allow click events on suggestions to fire
                    // Only clear if overlay is still open (not closing)
                    setTimeout(() => {
                      if (isMobileSearchOpen) {
                        setIsSearchFocused(false);
                      }
                    }, 200);
                  }}
                  placeholder={!useThingFeed ? "Search for places..." : "Search people, books, places, movies..."}
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500 bg-white text-base"
                  autoComplete="off"
                  autoFocus
                />
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                {searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
                {searchLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
            
            {showingSearchResults && (
              <div className="mt-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">
                  {searchLoading ? 'Searching...' : `Search results for "${searchTerm}"`}
                </h3>
                <button
                  onClick={clearSearch}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Suggested Users (when search is focused and empty) */}
          {isSearchFocused && !searchTerm.trim() && useThingFeed && !showingSearchResults && (
            <div className="px-4 py-4">
              {loadingSuggestions ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center space-x-2 text-gray-500">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading suggestions...</span>
                  </div>
                </div>
              ) : suggestedUsers.length > 0 ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      👥 People you might want to follow
                    </h4>
                    <div className="space-y-3">
                      {suggestedUsers.map((suggestedUser) => (
                        <div key={suggestedUser.id} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between p-3">
                            <button
                              onClick={() => {
                                onUserProfileClick?.(suggestedUser.id);
                                setIsMobileSearchOpen(false);
                              }}
                              className="flex items-center space-x-3 flex-1 text-left hover:opacity-75 transition-opacity"
                            >
                              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {suggestedUser.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{suggestedUser.name}</p>
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm text-gray-500">
                                    {suggestedUser.username ? `@${suggestedUser.username}` : 'Rex user'}
                                  </p>
                                  {suggestedUser.followers && suggestedUser.followers.length > 0 && (
                                    <span className="text-xs text-gray-400">
                                      • {suggestedUser.followers.length} {suggestedUser.followers.length === 1 ? 'follower' : 'followers'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                            <button
                              onMouseDown={(e) => {
                                // Capture suggestions visibility before blur happens
                                suggestionsWereVisibleRef.current = isSearchFocused && suggestedUsers.length > 0;
                                e.preventDefault(); // Prevent input blur
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFollow(suggestedUser.id);
                              }}
                              disabled={loadingFollow === suggestedUser.id || isFollowing(suggestedUser.id)}
                              className={`ml-3 px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 ${
                                isFollowing(suggestedUser.id)
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                              } disabled:opacity-50`}
                            >
                              {loadingFollow === suggestedUser.id ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <UserPlusIcon className="h-4 w-4" />
                              )}
                              <span>{isFollowing(suggestedUser.id) ? 'Following' : 'Follow'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">
                    All caught up! Try searching for more users.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Mobile Search Results - only show if there are actual results */}
          {(showingSearchResults || showingPlaceResults) && (
            <div className="px-4 py-4">
              <div className="space-y-6 search-results">
                {/* Loading State */}
                {(searchLoading || placesLoading) && (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center space-x-2 text-gray-500">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Searching...</span>
                    </div>
                  </div>
                )}

                {/* People Results */}
                {!searchLoading && searchResults.users.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      👥 PEOPLE ({searchResults.users.length})
                    </h4>
                    <div className="space-y-3">
                      {displayedUsers.map((searchUser) => (
                        <div key={searchUser.id} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between p-3">
                            <button
                              onClick={() => {
                                onUserProfileClick?.(searchUser.id);
                                setIsMobileSearchOpen(false);
                              }}
                              className="flex items-center space-x-3 flex-1 text-left hover:opacity-75 transition-opacity"
                            >
                              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {searchUser.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{searchUser.name}</p>
                                <p className="text-sm text-gray-500">
                                  {searchUser.username ? `@${searchUser.username}` : 'Rex user'}
                                </p>
                              </div>
                            </button>
                            <button
                              onMouseDown={(e) => {
                                // Capture suggestions visibility before blur happens
                                suggestionsWereVisibleRef.current = isSearchFocused && suggestedUsers.length > 0;
                                e.preventDefault(); // Prevent input blur
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isFollowing(searchUser.id)) {
                                  handleUnfollow(searchUser.id);
                                } else {
                                  handleFollow(searchUser.id);
                                }
                              }}
                              disabled={loadingFollow === searchUser.id}
                              className={`ml-3 px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 ${
                                isFollowing(searchUser.id)
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                              } disabled:opacity-50`}
                            >
                              {loadingFollow === searchUser.id ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : isFollowing(searchUser.id) ? (
                                <UserMinusIcon className="h-4 w-4" />
                              ) : (
                                <UserPlusIcon className="h-4 w-4" />
                              )}
                              <span>{isFollowing(searchUser.id) ? 'Unfollow' : 'Follow'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* See More Button */}
                    {hasMoreResults && !showAllResults && (
                      <div className="mt-4 text-center">
                        <button
                          onClick={() => setShowAllResults(true)}
                          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                        >
                          See More ({searchResults.users.length - INITIAL_RESULT_LIMIT} more)
                        </button>
                      </div>
                    )}
                    
                    {/* Show Less Button */}
                    {hasMoreResults && showAllResults && (
                      <div className="mt-4 text-center">
                        <button
                          onClick={() => setShowAllResults(false)}
                          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                        >
                          Show Less
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Things Results */}
                {!searchLoading && searchResults.things.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      📦 THINGS ({searchResults.things.length})
                    </h4>
                    <div className="space-y-3">
                      {searchResults.things.slice(0, 10).map((thing) => (
                        <button
                          key={thing.id}
                          onClick={() => setSelectedThing(thing)}
                          className="w-full bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow p-4 text-left"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900 mb-1">{thing.title}</h5>
                              <p className="text-sm text-gray-500 capitalize mb-2">{thing.category}</p>
                              {thing.description && (
                                <p className="text-sm text-gray-600 line-clamp-2">{thing.description}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* API Results */}
                {!apiLoading && apiResults.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Results ({apiResults.length})
                    </h4>
                    <div className="space-y-3">
                      {apiResults.slice(0, 10).map((thing, index) => {
                        const uniqueKey = thing.id || (thing as Thing & { sourceId?: string }).sourceId || `api-preview-${index}`;
                        return (
                        <button
                          key={uniqueKey}
                          onClick={() => setSelectedThing(thing)}
                          className="w-full bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow p-4 text-left"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900 mb-1">{thing.title}</h5>
                              <p className="text-sm text-gray-500 capitalize mb-2">{thing.category}</p>
                              {thing.description && (
                                <p className="text-sm text-gray-600 line-clamp-2">{thing.description}</p>
                              )}
                            </div>
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* No Results */}
                {!searchLoading && !apiLoading && !placesLoading && searchResults.users.length === 0 && searchResults.things.length === 0 && apiResults.length === 0 && places.length === 0 && searchTerm.trim().length >= 2 && (
                  <div className="text-center py-12">
                    <MagnifyingGlassIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No results found
                    </h3>
                    <p className="text-gray-500">
                      Try different keywords or check your spelling
                    </p>
                  </div>
                )}

                {/* Place Results for Map View */}
                {showingPlaceResults && (
                  <>
                    {/* Place Loading State */}
                    {placesLoading && (
                      <div className="text-center py-8">
                        <div className="inline-flex items-center space-x-2 text-gray-500">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <span>Searching places...</span>
                        </div>
                      </div>
                    )}

                    {/* Place Results */}
                    {!placesLoading && places.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                          📍 PLACES ({places.length})
                        </h4>
                        <div className="space-y-3">
                          {places.map((place: { place_id: string; name: string; formatted_address?: string; geometry?: { location: { lat: number; lng: number } }; photos?: Array<{ photo_reference: string }>; rating?: number }) => (
                            <div
                              key={place.place_id}
                              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => {
                                // Check if this place already exists as a Thing
                                const existingThing = findExistingThingForPlace(place.place_id, place.name);
                                const placeThing = existingThing || {
                                  id: '', // Preview - not in DB yet
                                  title: place.name,
                                  category: 'places',
                                  description: place.formatted_address || '',
                                  image: place.photos && place.photos.length > 0 && place.photos[0].photo_reference
                                    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`
                                    : undefined,
                                  metadata: {
                                    address: place.formatted_address,
                                    latitude: place.geometry?.location?.lat,
                                    longitude: place.geometry?.location?.lng,
                                    rating: place.rating,
                                  },
                                  source: 'google_places',
                                  sourceId: place.place_id,
                                  createdAt: Timestamp.now(),
                                  createdBy: '',
                                };
                                
                                setSelectedThing(placeThing);
                                
                                // Position popup at center of screen
                                setPopupPosition({
                                  x: window.innerWidth / 2,
                                  y: window.innerHeight / 2,
                                });
                                
                                // Center map on this place
                                if (place.geometry && place.geometry.location) {
                                  const location = {
                                    lat: place.geometry.location.lat,
                                    lng: place.geometry.location.lng,
                                  };
                                  setSelectedPlaceLocation(location);
                                }
                                
                                // Clear search after a brief delay to allow popup to position
                                setTimeout(() => {
                                  setSearchTerm('');
                                  searchPlaces('');
                                }, 100);
                              }}
                            >
                              <div className="flex items-start space-x-3">
                                {place.photos && place.photos.length > 0 && place.photos[0].photo_reference ? (
                                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`}
                                      alt={place.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center">
                                    <span className="text-gray-400 text-xs">No photo</span>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-base font-medium text-gray-900 truncate">
                                    {place.name}
                                  </h3>
                                  {place.formatted_address && (
                                    <p className="text-sm text-gray-500 truncate mt-1">
                                      {place.formatted_address}
                                    </p>
                                  )}
                                  <div className="flex items-center space-x-4 mt-2">
                                    {place.rating && (
                                      <div className="flex items-center space-x-1">
                                        <span className="text-sm text-yellow-600">⭐</span>
                                        <span className="text-sm text-gray-600">{place.rating.toFixed(1)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No Places Found */}
                    {!placesLoading && places.length === 0 && searchTerm.trim().length >= 2 && (
                      <div className="text-center py-12">
                        <MagnifyingGlassIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          No places found
                        </h3>
                        <p className="text-gray-500">
                          Try different keywords or check your spelling
                        </p>
                      </div>
                    )}
                  </>
                )}

              </div>
            </div>
          )}
            
          {/* Empty Search State - only show if no results and not focused (suggestions will show when focused and empty) */}
          {!showingSearchResults && !showingPlaceResults && !isSearchFocused && (
            <div className="px-4 py-4">
              <div className="text-center py-12">
                <MagnifyingGlassIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {useThingFeed ? 'Discover' : 'Search for Places'}
                </h3>
                <p className="text-gray-500">
                  {useThingFeed ? 'Search for people, books, places, movies, and more' : 'Search locations, restaurants, attractions, etc.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggested Users (Desktop - when search is focused and empty) */}
      {isSearchFocused && !searchTerm.trim() && useThingFeed && !showingSearchResults && !isMobileSearchOpen && (
        <div className="px-4 py-4">
          {loadingSuggestions ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center space-x-2 text-gray-500">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading suggestions...</span>
              </div>
            </div>
          ) : suggestedUsers.length > 0 ? (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  👥 People you might want to follow
                </h4>
                <div className="space-y-3">
                  {suggestedUsers.map((suggestedUser) => (
                    <div key={suggestedUser.id} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between p-3">
                        <button
                          onClick={() => onUserProfileClick?.(suggestedUser.id)}
                          className="flex items-center space-x-3 flex-1 text-left hover:opacity-75 transition-opacity"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {suggestedUser.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{suggestedUser.name}</p>
                            <div className="flex items-center space-x-2">
                              <p className="text-sm text-gray-500">
                                {suggestedUser.username ? `@${suggestedUser.username}` : 'Rex user'}
                              </p>
                              {suggestedUser.followers && suggestedUser.followers.length > 0 && (
                                <span className="text-xs text-gray-400">
                                  • {suggestedUser.followers.length} {suggestedUser.followers.length === 1 ? 'follower' : 'followers'}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        <button
                          onMouseDown={(e) => {
                            // Capture suggestions visibility before blur happens
                            suggestionsWereVisibleRef.current = isSearchFocused && suggestedUsers.length > 0;
                            e.preventDefault(); // Prevent input blur
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollow(suggestedUser.id);
                          }}
                          disabled={loadingFollow === suggestedUser.id || isFollowing(suggestedUser.id)}
                          className={`ml-3 px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 ${
                            isFollowing(suggestedUser.id)
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          } disabled:opacity-50`}
                        >
                          {loadingFollow === suggestedUser.id ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <UserPlusIcon className="h-4 w-4" />
                          )}
                          <span>{isFollowing(suggestedUser.id) ? 'Following' : 'Follow'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">
                All caught up! Try searching for more users.
              </p>
            </div>
          )}
        </div>
      )}

      <div className={!showingSearchResults && !useThingFeed ? 'pb-4' : 'px-4 py-4'}>
        {showingSearchResults ? (
          /* Search Results */
          <div className="space-y-6 search-results">
            {/* Loading State */}
            {searchLoading && (
              <div className="text-center py-8">
                <div className="inline-flex items-center space-x-2 text-gray-500">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Searching...</span>
                </div>
              </div>
            )}

            {/* People Results */}
            {!searchLoading && searchResults.users.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  👥 PEOPLE ({searchResults.users.length})
                </h4>
                <div className="space-y-3">
                  {displayedUsers.map((searchUser) => (
                    <div key={searchUser.id} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between p-3">
                        <button
                          onClick={() => onUserProfileClick?.(searchUser.id)}
                          className="flex items-center space-x-3 flex-1 text-left hover:opacity-75 transition-opacity"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {searchUser.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{searchUser.name}</p>
                            <p className="text-sm text-gray-500">
                              {searchUser.username ? `@${searchUser.username}` : 'Rex user'}
                            </p>
                          </div>
                        </button>
                        <button
                          onMouseDown={(e) => {
                            // Capture suggestions visibility before blur happens
                            suggestionsWereVisibleRef.current = isSearchFocused && suggestedUsers.length > 0;
                            e.preventDefault(); // Prevent input blur
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isFollowing(searchUser.id)) {
                              handleUnfollow(searchUser.id);
                            } else {
                              handleFollow(searchUser.id);
                            }
                          }}
                          disabled={loadingFollow === searchUser.id}
                          className={`ml-3 px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 ${
                            isFollowing(searchUser.id)
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          } disabled:opacity-50`}
                        >
                          {loadingFollow === searchUser.id ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : isFollowing(searchUser.id) ? (
                            <UserMinusIcon className="h-4 w-4" />
                          ) : (
                            <UserPlusIcon className="h-4 w-4" />
                          )}
                          <span>{isFollowing(searchUser.id) ? 'Unfollow' : 'Follow'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* See More Button */}
                {hasMoreResults && !showAllResults && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setShowAllResults(true)}
                      className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      See More ({searchResults.users.length - INITIAL_RESULT_LIMIT} more)
                    </button>
                  </div>
                )}
                
                {/* Show Less Button */}
                {hasMoreResults && showAllResults && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setShowAllResults(false)}
                      className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      Show Less
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Things Results */}
            {!searchLoading && searchResults.things.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  📦 THINGS ({searchResults.things.length})
                </h4>
                <div className="space-y-3">
                  {searchResults.things.slice(0, 10).map((thing) => (
                    <button
                      key={thing.id}
                      onClick={() => setSelectedThing(thing)}
                      className="w-full bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow p-4 text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 mb-1">{thing.title}</h5>
                          <p className="text-sm text-gray-500 capitalize mb-2">{thing.category}</p>
                          {thing.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">{thing.description}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* API Results */}
            {!apiLoading && apiResults.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Results ({apiResults.length})
                </h4>
                <div className="space-y-3">
                  {apiResults.slice(0, 10).map((thing, index) => {
                    const uniqueKey = thing.id || (thing as Thing & { sourceId?: string }).sourceId || `api-preview-${index}`;
                    return (
                    <button
                      key={uniqueKey}
                      onClick={() => setSelectedThing(thing)}
                      className="w-full bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow p-4 text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 mb-1">{thing.title}</h5>
                          <p className="text-sm text-gray-500 capitalize mb-2">{thing.category}</p>
                          {thing.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">{thing.description}</p>
                          )}
                        </div>
                      </div>
                    </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No Results */}
            {!searchLoading && !apiLoading && searchResults.users.length === 0 && searchResults.things.length === 0 && apiResults.length === 0 && searchTerm.trim().length >= 2 && (
              <div className="text-center py-12">
                <MagnifyingGlassIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No results found
                </h3>
                <p className="text-gray-500">
                  Try different keywords or check your spelling
                </p>
              </div>
            )}

            {/* Empty Search State - Things View - only show if not focused */}
            {!searchLoading && searchTerm.trim().length === 0 && !isSearchFocused && (
              <div className="text-center py-12">
                <MagnifyingGlassIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Discover
                </h3>
                <p className="text-gray-500">
                  Search for people, books, places, movies, and more
                </p>
              </div>
            )}
          </div>
        ) : showingPlaceResults ? (
          /* Place Search Results */
          <div className="space-y-4">
            {/* Loading State */}
            {placesLoading && (
              <div className="text-center py-8">
                <div className="inline-flex items-center space-x-2 text-gray-500">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Searching places...</span>
                </div>
              </div>
            )}

            {/* Place Results */}
            {!placesLoading && places.length > 0 && (
              <div className="space-y-3">
                {places.map((place: { place_id: string; name: string; formatted_address?: string; geometry?: { location: { lat: number; lng: number } }; photos?: Array<{ photo_reference: string }>; rating?: number }) => (
                  <div
                    key={place.place_id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => {
                      // Check if this place already exists as a Thing
                      const existingThing = findExistingThingForPlace(place.place_id, place.name);
                      const placeThing = existingThing || {
                        id: '', // Preview - not in DB yet
                        title: place.name,
                        category: 'places',
                        description: place.formatted_address || '',
                        image: place.photos && place.photos.length > 0 && place.photos[0].photo_reference
                          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`
                          : undefined,
                        metadata: {
                          address: place.formatted_address,
                          latitude: place.geometry?.location?.lat,
                          longitude: place.geometry?.location?.lng,
                          rating: place.rating,
                        },
                        source: 'google_places',
                        sourceId: place.place_id,
                        createdAt: Timestamp.now(),
                        createdBy: '',
                      };
                      
                      setSelectedThing(placeThing);
                      
                      // Position popup at center of screen
                      setPopupPosition({
                        x: window.innerWidth / 2,
                        y: window.innerHeight / 2,
                      });
                      
                      // Center map on this place
                      if (place.geometry && place.geometry.location) {
                        const location = {
                          lat: place.geometry.location.lat,
                          lng: place.geometry.location.lng,
                        };
                        setSelectedPlaceLocation(location);
                      }
                      
                      // Clear search after a brief delay to allow popup to position
                      setTimeout(() => {
                        setSearchTerm('');
                        searchPlaces('');
                      }, 100);
                    }}
                  >
                    <div className="flex items-start space-x-3">
                      {place.photos && place.photos.length > 0 && place.photos[0].photo_reference ? (
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`}
                            alt={place.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Hide broken images
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">No photo</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-gray-900 truncate">
                          {place.name}
                        </h3>
                        {place.formatted_address && (
                          <p className="text-sm text-gray-500 truncate mt-1">
                            {place.formatted_address}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 mt-2">
                          {place.rating && (
                            <div className="flex items-center space-x-1">
                              <span className="text-sm text-yellow-600">⭐</span>
                              <span className="text-sm text-gray-600">{place.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No Results */}
            {!placesLoading && places.length === 0 && searchTerm.trim().length >= 2 && (
              <div className="text-center py-12">
                <MagnifyingGlassIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No places found
                </h3>
                <p className="text-gray-500">
                  Try different keywords or check your spelling
                </p>
              </div>
            )}

            {/* Empty Search State */}
            {!placesLoading && searchTerm.trim().length === 0 && (
              <div className="text-center py-12">
                <MagnifyingGlassIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Search for Places
                </h3>
                <p className="text-gray-500">
                  Search locations, restaurants, attractions, etc.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Regular Feed */
          <>
            {useThingFeed && feedThings.length === 0 ? (
              <div className="text-center py-12">
                <UserPlusIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Welcome to Rex!
                </h3>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                  Search for people to follow above, or{' '}
                  <button
                    onClick={() => onNavigateToAdd?.()}
                    className="text-blue-600 hover:text-blue-700 font-medium underline"
                  >
                    create your first post
                  </button>
                  {' '}to get started.
                </p>
              </div>
            ) : useThingFeed ? (
              /* Thing-Centric Feed */
              <div className="space-y-4">
                {feedThings.map((feedThing) => (
                  <ThingCard
                    key={feedThing.thing.id}
                    feedThing={feedThing}
                    onEdit={onEditInteraction}
                    onUserClick={handleUserClick}
                    autoOpen={autoOpenThingId === feedThing.thing.id}
                  />
                ))}
              </div>
            ) : (
              /* Map View */
              (() => {
                console.log('🗺️ Rendering MapView with centerOnLocation:', selectedPlaceLocation);
                return (
                  <MapView 
                    things={things}
                    interactions={interactions}
                    myInteractions={myInteractions}
                    centerOnLocation={selectedPlaceLocation}
                    onThingClick={(thing) => {
                      // Find the thing in feedThings and open modal
                      const feedThing = feedThings.find(ft => ft.thing.id === thing.id);
                      if (feedThing) {
                        // TODO: Open ThingDetailModal
                      }
                    }}
                  />
                );
              })()
            )}
          </>
        )}
      </div>

      {/* Map Popup - shown when clicking a search result */}
      {selectedThing && popupPosition && (
        <MapPopup
          thing={selectedThing}
          position={popupPosition}
          onClose={() => {
            setPopupPosition(null);
            setSelectedThing(null);
          }}
          onSeeMore={() => {
            // Clear popup position to switch to full modal
            setPopupPosition(null);
          }}
          onThingCreated={(realThing) => {
            console.log('🔄 MapPopup: Thing created, updating...');
            setSelectedThing(realThing);
          }}
        />
      )}

      {/* Thing Detail Modal - shown when clicking "See More" or from other sources */}
      {selectedThing && !popupPosition && (
        <ThingDetailModal
          thing={selectedThing}
          onClose={() => setSelectedThing(null)}
          onUserClick={(userId) => onUserProfileClick?.(userId)}
          onThingCreated={(realThing) => {
            // Update the modal to show the real thing instead of preview
            console.log('🔄 Updating modal with real thing:', realThing.id);
            setSelectedThing(realThing);
          }}
        />
      )}
    </div>
  );
} 