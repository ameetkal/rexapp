'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore, useAppStore } from '@/lib/store';
import { getFeedPosts } from '@/lib/firestore';
import PostCard from './PostCard';
import { UserPlusIcon } from '@heroicons/react/24/outline';

export default function FeedScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, userProfile } = useAuthStore();
  const { posts, setPosts } = useAppStore();

  const loadFeedPosts = useCallback(async () => {
    if (!userProfile || !user) return;
    
    try {
      const feedPosts = await getFeedPosts(userProfile.following, user.uid);
      setPosts(feedPosts);
    } catch (error) {
      console.error('Error loading feed posts:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile, user, setPosts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeedPosts();
    setRefreshing(false);
  };

  useEffect(() => {
    if (userProfile && user) {
      loadFeedPosts();
    }
  }, [userProfile, user, loadFeedPosts]);

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
      {/* Header with refresh */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Your Feed</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-blue-600 hover:text-blue-700 font-medium text-sm disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="px-4 py-4">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <UserPlusIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Your feed is empty
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              You haven't posted any recommendations yet, and you're not following anyone. Start by sharing your first recommendation or finding friends to follow!
            </p>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Try these actions:
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>• Go to Profile to find and follow friends</p>
                <p>• Share your first recommendation in the Post tab</p>
                <p>• Invite friends to join Rex</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 