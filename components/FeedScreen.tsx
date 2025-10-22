'use client';

import { useState, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { followUser, unfollowUser } from '@/lib/firestore';
import { Thing, UserThingInteraction, FeedThing } from '@/lib/types';
import ThingFeedCard from './ThingFeedCard';
import { UserPlusIcon, MagnifyingGlassIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import { useFeedData, useSearch } from '@/lib/hooks';

interface FeedScreenProps {
  onUserProfileClick?: (authorId: string) => void;
  onNavigateToAdd?: () => void;
  onEditInteraction?: (interaction: UserThingInteraction, thing: Thing) => void;
}

export default function FeedScreen({ onUserProfileClick, onNavigateToAdd, onEditInteraction }: FeedScreenProps = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);
  const [useThingFeed, setUseThingFeed] = useState(true); // Toggle between Things and Map
  
  const { user, userProfile, setUserProfile } = useAuthStore();
  
  // Use our new custom hooks for clean data access
  const { things, interactions, loading: feedLoading } = useFeedData();
  const { searchResults, loading: searchLoading, search } = useSearch();

  // Convert feed data to FeedThing format for compatibility
  const feedThings: FeedThing[] = things
    .filter((thing, index, self) => {
      // Remove duplicates based on thing.id
      const isDuplicate = index !== self.findIndex(t => t.id === thing.id);
      // Silently filter out duplicates
      return !isDuplicate;
    })
    .map(thing => {
      const thingInteractions = interactions.filter(i => i.thingId === thing.id);
      const myInteraction = thingInteractions.find(i => i.userId === user?.uid);
      
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

  const handleSearch = useCallback(() => {
    if (searchTerm.trim()) {
      search(searchTerm);
    }
  }, [searchTerm, search]);

  const clearSearch = () => {
    setSearchTerm('');
  };

  const handleFollow = async (targetUserId: string) => {
    if (!user || !userProfile) return;
    
    setLoadingFollow(targetUserId);
    try {
      await followUser(user.uid, targetUserId);
      
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

  const showingSearchResults = searchResults.users.length > 0;

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
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search people, posts, places..."
              className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500 bg-white"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={searchLoading || !searchTerm.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 font-medium"
          >
            {searchLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {showingSearchResults && (
          <div className="mt-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              Search results for &quot;{searchTerm}&quot;
            </h3>
            <button
              onClick={clearSearch}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear search
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {showingSearchResults ? (
          /* Search Results */
          <div className="space-y-6">
            {/* People Results */}
            {searchResults.users.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  👥 PEOPLE ({searchResults.users.length})
                </h4>
                <div className="space-y-3">
                  {searchResults.users.map((searchUser) => (
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
              </div>
            )}

            {/* No Results */}
            {searchResults.users.length === 0 && !searchLoading && (
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
          </div>
        ) : (
          /* Regular Feed */
          <>
            {/* Feed Mode Toggle Header */}
            <div className="flex items-center justify-start mb-6">
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setUseThingFeed(true)}
                  className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                    useThingFeed 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Things
                </button>
                <button
                  onClick={() => setUseThingFeed(false)}
                  className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                    !useThingFeed 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Map
                </button>
              </div>
            </div>

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
                  <ThingFeedCard
                    key={feedThing.thing.id}
                    feedThing={feedThing}
                    onEdit={onEditInteraction}
                    onUserClick={onUserProfileClick}
                  />
                ))}
              </div>
            ) : (
              /* Map View - Coming Soon */
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Map View</h3>
                <p className="text-gray-500 max-w-sm">
                  Discover recommendations near you with our interactive map view. Coming soon!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 