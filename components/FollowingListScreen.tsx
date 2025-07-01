'use client';

import { useState, useEffect } from 'react';
import { ArrowLeftIcon, UserMinusIcon, UserPlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/store';
import { getUsersByIds, unfollowUser, followUser, universalSearch } from '@/lib/firestore';
import { User } from '@/lib/types';

interface FollowingListScreenProps {
  onBack: () => void;
  onUserClick: (user: User) => void;
}

export default function FollowingListScreen({ onBack, onUserClick }: FollowingListScreenProps) {
  const [followingUsers, setFollowingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [unfollowingIds, setUnfollowingIds] = useState<Set<string>>(new Set());
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [showingSearchResults, setShowingSearchResults] = useState(false);
  
  const { user, userProfile, setUserProfile } = useAuthStore();

  useEffect(() => {
    const loadFollowingUsers = async () => {
      if (!userProfile?.following.length) {
        setLoading(false);
        return;
      }

      try {
        const users = await getUsersByIds(userProfile.following);
        setFollowingUsers(users);
      } catch (error) {
        console.error('Error loading following users:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFollowingUsers();
  }, [userProfile?.following]);

  // Debounced live search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        performSearch(searchTerm);
      } else {
        setSearchResults([]);
        setShowingSearchResults(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnfollow = async (targetUserId: string) => {
    if (!user || unfollowingIds.has(targetUserId)) return;

    setUnfollowingIds(prev => new Set(prev).add(targetUserId));

    try {
      await unfollowUser(user.uid, targetUserId);
      
      // Update local state
      setFollowingUsers(prev => prev.filter(u => u.id !== targetUserId));
      
      // Update user profile in store
      if (userProfile) {
        const updatedFollowing = userProfile.following.filter(id => id !== targetUserId);
        setUserProfile({
          ...userProfile,
          following: updatedFollowing
        });
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
    } finally {
      setUnfollowingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });
    }
  };

  const handleFollow = async (targetUserId: string) => {
    if (!user || !userProfile || followingIds.has(targetUserId)) return;
    
    setFollowingIds(prev => new Set(prev).add(targetUserId));
    
    try {
      await followUser(user.uid, targetUserId);
      
      // Update local state
      const updatedProfile = {
        ...userProfile,
        following: [...userProfile.following, targetUserId],
      };
      setUserProfile(updatedProfile);
    } catch (error) {
      console.error('Error following user:', error);
    } finally {
      setFollowingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });
    }
  };

  const performSearch = async (term: string) => {
    if (!term.trim() || !user) {
      setSearchResults([]);
      setShowingSearchResults(false);
      return;
    }
    
    setSearching(true);
    setShowingSearchResults(true);
    try {
      const results = await universalSearch(term);
      // Filter out current user from user results
      const filteredUsers = results.users.filter(u => u.id !== user.uid);
      setSearchResults(filteredUsers);
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
    setSearchResults([]);
    setShowingSearchResults(false);
  };

  const isFollowing = (userId: string) => {
    return userProfile?.following.includes(userId) || false;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded w-32 animate-pulse"></div>
                  </div>
                </div>
                <div className="w-20 h-8 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (showingSearchResults) {
      return (
        <div>
          {searchResults.length > 0 ? (
            <div className="space-y-3">
              {searchResults.map((searchUser) => (
                <div
                  key={searchUser.id}
                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => onUserClick(searchUser)}
                      className="flex items-center space-x-3 flex-1 text-left hover:opacity-75 transition-opacity"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                        {searchUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{searchUser.name}</h3>
                        <p className="text-sm text-gray-500">
                          {searchUser.username ? `@${searchUser.username}` : 'Rex user'}
                        </p>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => isFollowing(searchUser.id) ? handleUnfollow(searchUser.id) : handleFollow(searchUser.id)}
                      disabled={unfollowingIds.has(searchUser.id) || followingIds.has(searchUser.id)}
                      className={`ml-4 px-3 py-1.5 text-sm rounded-lg font-medium flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isFollowing(searchUser.id)
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      {(unfollowingIds.has(searchUser.id) || followingIds.has(searchUser.id)) ? (
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
          ) : !searching ? (
            <div className="text-center py-12">
              <MagnifyingGlassIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No results found
              </h3>
              <p className="text-gray-500">
                Try different keywords or check your spelling
              </p>
            </div>
          ) : null}
        </div>
      );
    }

    // Regular Following List
    return followingUsers.length === 0 ? (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <UserMinusIcon className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No one yet</h3>
        <p className="text-gray-500 text-sm mb-4">
          Start following people to see their recommendations
        </p>
        <p className="text-gray-400 text-xs">
          Use the search bar above to find people to follow
        </p>
      </div>
    ) : (
      <div className="space-y-3">
        {followingUsers.map((followedUser) => (
          <div
            key={followedUser.id}
            className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => onUserClick(followedUser)}
                className="flex items-center space-x-3 flex-1 text-left hover:opacity-75 transition-opacity"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                  {followedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{followedUser.name}</h3>
                  <p className="text-sm text-gray-500">
                    {followedUser.username ? `@${followedUser.username}` : 'Rex user'}
                  </p>
                </div>
              </button>
              
              <button
                onClick={() => handleUnfollow(followedUser.id)}
                disabled={unfollowingIds.has(followedUser.id)}
                className="ml-4 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                {unfollowingIds.has(followedUser.id) ? (
                  <>
                    <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>...</span>
                  </>
                ) : (
                  <>
                    <UserMinusIcon className="h-4 w-4" />
                    <span>Unfollow</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            Following ({followingUsers.length})
          </h1>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                disabled={loading}
                placeholder="Search for people to follow..."
                className={`w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500 ${
                  loading ? 'bg-gray-50' : ''
                }`}
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
              disabled={loading || searching || !searchTerm.trim()}
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

        {/* Content */}
        {renderContent()}
      </div>
    </div>
  );
} 