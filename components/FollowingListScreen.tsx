'use client';

import { useState, useEffect } from 'react';
import { ArrowLeftIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/store';
import { getUsersByIds, unfollowUser } from '@/lib/firestore';
import { User } from '@/lib/types';

interface FollowingListScreenProps {
  onBack: () => void;
  onUserClick: (user: User) => void;
}

export default function FollowingListScreen({ onBack, onUserClick }: FollowingListScreenProps) {
  const [followingUsers, setFollowingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [unfollowingIds, setUnfollowingIds] = useState<Set<string>>(new Set());
  
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

  if (loading) {
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
            <h1 className="text-xl font-semibold text-gray-900">Following</h1>
          </div>

          {/* Loading State */}
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
        </div>
      </div>
    );
  }

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

        {/* Following List */}
        {followingUsers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserMinusIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No one yet</h3>
            <p className="text-gray-500 text-sm">
              Start following people to see their recommendations
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
                      <p className="text-sm text-gray-500">{followedUser.email}</p>
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
        )}
      </div>
    </div>
  );
} 