'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { universalSearch, followUser, unfollowUser, getFeedPostsV2, getThing, getUserThingInteraction, getThingAverageRating } from '@/lib/firestore';
import { User, PostV2, Thing, UserThingInteraction } from '@/lib/types';
import PostCardV2 from './PostCardV2';
import { UserPlusIcon, MagnifyingGlassIcon, UserMinusIcon } from '@heroicons/react/24/outline';

interface FeedScreenProps {
  onUserProfileClick?: (authorId: string) => void;
  onNavigateToAdd?: () => void;
}

export default function FeedScreen({ onUserProfileClick, onNavigateToAdd }: FeedScreenProps = {}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{ users: User[] }>({ users: [] });
  const [searching, setSearching] = useState(false);
  const [showingSearchResults, setShowingSearchResults] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);
  
  const [postsV2, setPostsV2] = useState<PostV2[]>([]);
  const [things, setThings] = useState<Thing[]>([]);
  const [userInteractions, setUserInteractions] = useState<Map<string, UserThingInteraction>>(new Map());
  const [avgRatings, setAvgRatings] = useState<Map<string, number>>(new Map());
  
  const { user, userProfile, setUserProfile } = useAuthStore();

  const loadFeedPosts = useCallback(async () => {
    if (!userProfile || !user) return;
    
    try {
      console.log('📱 Loading feed...');
      const feedPostsV2 = await getFeedPostsV2(userProfile.following, user.uid);
      setPostsV2(feedPostsV2);
      
      // Load things data for posts
      const uniqueThingIds = [...new Set(feedPostsV2.map(post => post.thingId))];
      const thingsData: Thing[] = [];
      for (const thingId of uniqueThingIds) {
        const thing = await getThing(thingId);
        if (thing) {
          thingsData.push(thing);
        }
      }
      setThings(thingsData);
      
      // Load user interactions for these things
      const interactionsMap = new Map<string, UserThingInteraction>();
      for (const thingId of uniqueThingIds) {
        const interaction = await getUserThingInteraction(user.uid, thingId);
        if (interaction) {
          interactionsMap.set(thingId, interaction);
        }
      }
      setUserInteractions(interactionsMap);
      
      // Load average ratings for all things in parallel
      console.log('📊 Loading average ratings...');
      const avgRatingsResults = await Promise.all(
        uniqueThingIds.map(thingId => getThingAverageRating(thingId))
      );
      
      const avgRatingsMap = new Map<string, number>();
      uniqueThingIds.forEach((thingId, index) => {
        const avgRating = avgRatingsResults[index];
        if (avgRating !== null) {
          avgRatingsMap.set(thingId, avgRating);
        }
      });
      setAvgRatings(avgRatingsMap);
      
      console.log(`✅ Loaded ${feedPostsV2.length} posts with ${avgRatingsMap.size} avg ratings`);
    } catch (error) {
      console.error('Error loading feed posts:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeedPosts();
    setRefreshing(false);
  };

  const performSearch = async (term: string) => {
    if (!term.trim() || !user) {
      setSearchResults({ users: [] });
      setShowingSearchResults(false);
      return;
    }
    
    setSearching(true);
    setShowingSearchResults(true);
    try {
      const results = await universalSearch(term);
      // Filter out current user from user results
      setSearchResults({
        users: results.users.filter(u => u.id !== user.uid)
      });
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = () => {
    performSearch(searchTerm);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults({ users: [] });
    setShowingSearchResults(false);
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


  useEffect(() => {
    if (userProfile && user) {
      loadFeedPosts();
    }
  }, [userProfile, user, loadFeedPosts]);

  // Refresh feed when component becomes visible (e.g., when switching from Add tab back to Feed)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && userProfile && user) {
        // Refresh feed when tab becomes visible
        loadFeedPosts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userProfile, user, loadFeedPosts]);

  // Debounced live search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        performSearch(searchTerm);
      } else {
        setSearchResults({ users: [] });
        setShowingSearchResults(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
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
              className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            {searching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchTerm.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {searching ? 'Searching...' : 'Search'}
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
            {searchResults.users.length === 0 && !searching && (
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
            {/* Feed Header with Refresh */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Your Feed</h2>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm disabled:opacity-50"
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {postsV2.length === 0 ? (
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
            ) : (
              <div className="space-y-4">
                {postsV2.map((post) => {
                  const thing = things.find(t => t.id === post.thingId);
                  const userInteraction = userInteractions.get(post.thingId);
                  
                  if (!thing) {
                    console.warn('Thing not found for post:', post.id, 'thingId:', post.thingId);
                    return null;
                  }
                  
                  return (
                    <PostCardV2
                      key={post.id}
                      post={post}
                      thing={thing}
                      userInteraction={userInteraction}
                      avgRating={avgRatings.get(post.thingId) || null}
                      onAuthorClick={onUserProfileClick}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 