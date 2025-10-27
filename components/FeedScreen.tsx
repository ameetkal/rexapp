'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuthStore, useAppStore } from '@/lib/store';
import { followUser, unfollowUser } from '@/lib/firestore';
import { Thing, UserThingInteraction, FeedThing } from '@/lib/types';
import ThingCard from './ThingCard';
import ThingDetailModal from './ThingDetailModal';
import MapView from './MapView';
import { UserPlusIcon, MagnifyingGlassIcon, UserMinusIcon, MapIcon } from '@heroicons/react/24/outline';
import { useFeedData, useSearch, usePlaceSearch, useAPISearch } from '@/lib/hooks';
import { dataService } from '@/lib/dataService';

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
  const [selectedPlaceLocation, setSelectedPlaceLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedThing, setSelectedThing] = useState<Thing | null>(null);
  
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
  const { searchResults, loading: searchLoading, search } = useSearch();
  const { places, loading: placesLoading, searchPlaces } = usePlaceSearch();
  const { results: apiResults, loading: apiLoading, searchAPIs } = useAPISearch();

  // Define search-related variables early
  const showingSearchResults = (searchResults.users.length > 0 || searchResults.things.length > 0 || apiResults.length > 0 || searchLoading || apiLoading) && useThingFeed && searchTerm.trim().length > 0;
  const showingPlaceResults = (places.length > 0 || placesLoading) && !useThingFeed && searchTerm.trim().length > 0;
  
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

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setShowAllResults(false);
    setIsMobileSearchOpen(false);
    // Manually clear search results
    if (useThingFeed) {
      search('');
    } else {
      searchPlaces('');
    }
  }, [useThingFeed, search, searchPlaces]);

  // Detect mobile screen size
  const [isMobile, setIsMobile] = useState(false);
  
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
    
    setLoadingFollow(targetUserId);
    try {
      await followUser(user.uid, targetUserId);
      
      // Clear feed cache to force fresh data load
      dataService.clearFeedCache(user.uid);
      
      // Update local profile
      const updatedProfile = {
        ...userProfile,
        following: [...userProfile.following, targetUserId],
      };
      setUserProfile(updatedProfile);
    } catch (error) {
      console.error('Error following user:', error);
    } finally {
      setLoadingFollow(null);
    }
  };

  const handleUnfollow = async (targetUserId: string) => {
    if (!user || !userProfile) return;
    
    setLoadingFollow(targetUserId);
    try {
      await unfollowUser(user.uid, targetUserId);
      
      // Clear feed cache to force fresh data load
      dataService.clearFeedCache(user.uid);
      
      // Update local profile
      const updatedProfile = {
        ...userProfile,
        following: userProfile.following.filter(id => id !== targetUserId),
      };
      setUserProfile(updatedProfile);
    } catch (error) {
      console.error('Error unfollowing user:', error);
    } finally {
      setLoadingFollow(null);
    }
  };

  const isFollowing = (userId: string) => {
    return userProfile?.following.includes(userId) || false;
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
              onFocus={() => isMobile && setIsMobileSearchOpen(true)}
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
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
          {/* Mobile Search Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsMobileSearchOpen(false)}
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

          {/* Mobile Search Results */}
      <div className="px-4 py-4">
            {showingSearchResults ? (
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

                {/* Empty Search State */}
                {!searchLoading && searchTerm.trim().length === 0 && (
                  <div className="text-center py-12">
                    <MagnifyingGlassIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {useThingFeed ? 'Discover People' : 'Search for Places'}
                    </h3>
                    <p className="text-gray-500">
                      {useThingFeed ? 'Search for friends and discover new connections' : 'Search locations, restaurants, attractions, etc.'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <MagnifyingGlassIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {useThingFeed ? 'Discover People' : 'Search for Places'}
                </h3>
                <p className="text-gray-500">
                  {useThingFeed ? 'Search for friends and discover new connections' : 'Search locations, restaurants, attractions, etc.'}
                </p>
              </div>
            )}
          </div>
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
                      // Center map on this place
                      if (place.geometry && place.geometry.location) {
                        const location = {
                          lat: place.geometry.location.lat,
                          lng: place.geometry.location.lng,
                        };
                        console.log('🗺️ Setting location to center:', location);
                        setSelectedPlaceLocation(location);
                        // Clear search and return to map view
                        setSearchTerm('');
                        searchPlaces('');
                      }
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

      {/* Thing Detail Modal */}
      {selectedThing && (
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