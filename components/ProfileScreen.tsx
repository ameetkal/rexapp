'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { searchUsers, followUser, unfollowUser } from '@/lib/firestore';
import { getUserProfile } from '@/lib/auth';
import { User } from '@/lib/types';
import { MagnifyingGlassIcon, UserPlusIcon, UserMinusIcon } from '@heroicons/react/24/outline';

export default function ProfileScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [followingUsers, setFollowingUsers] = useState<User[]>([]);
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);
  
  const { user, userProfile, setUserProfile } = useAuthStore();

  const loadFollowingUsers = useCallback(async () => {
    if (!userProfile) return;
    
    try {
      const users = await Promise.all(
        userProfile.following.map(async (userId) => {
          const user = await getUserProfile(userId);
          return user;
        })
      );
      setFollowingUsers(users.filter(Boolean) as User[]);
    } catch (error) {
      console.error('Error loading following users:', error);
    }
  }, [userProfile]);

  useEffect(() => {
    loadFollowingUsers();
  }, [loadFollowingUsers]);

  const handleSearch = async () => {
    if (!searchTerm.trim() || !user) return;
    
    setSearching(true);
    try {
      const results = await searchUsers(searchTerm);
      // Filter out current user from results
      setSearchResults(results.filter(u => u.id !== user.uid));
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
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
      
      // Refresh following users list
      loadFollowingUsers();
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
      
      // Refresh following users list
      loadFollowingUsers();
    } catch (error) {
      console.error('Error unfollowing user:', error);
    } finally {
      setLoadingFollow(null);
    }
  };

  const isFollowing = (userId: string) => {
    return userProfile?.following.includes(userId) || false;
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 py-6">
        {/* User Profile Section */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            {userProfile?.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{userProfile?.name}</h2>
          <p className="text-gray-600 text-sm">{userProfile?.email}</p>
          <div className="flex justify-center space-x-6 mt-4">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">{userProfile?.following.length || 0}</div>
              <div className="text-sm text-gray-500">Following</div>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Find Friends</h3>
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !searchTerm.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="font-medium text-gray-900">Search Results</h4>
              {searchResults.map((searchUser) => (
                <div key={searchUser.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {searchUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{searchUser.name}</p>
                      <p className="text-sm text-gray-500">{searchUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => isFollowing(searchUser.id) ? handleUnfollow(searchUser.id) : handleFollow(searchUser.id)}
                    disabled={loadingFollow === searchUser.id}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 ${
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
              ))}
            </div>
          )}
        </div>

        {/* Following Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Following ({followingUsers.length})</h3>
          {followingUsers.length === 0 ? (
            <div className="text-center py-8">
              <UserPlusIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                             <p className="text-gray-500">You&apos;re not following anyone yet</p>
              <p className="text-sm text-gray-400 mt-1">Search for friends to start seeing their recommendations</p>
            </div>
          ) : (
            <div className="space-y-3">
              {followingUsers.map((followedUser) => (
                <div key={followedUser.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {followedUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{followedUser.name}</p>
                      <p className="text-sm text-gray-500">{followedUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnfollow(followedUser.id)}
                    disabled={loadingFollow === followedUser.id}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 flex items-center space-x-1 disabled:opacity-50"
                  >
                    {loadingFollow === followedUser.id ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <UserMinusIcon className="h-4 w-4" />
                    )}
                    <span>Unfollow</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 