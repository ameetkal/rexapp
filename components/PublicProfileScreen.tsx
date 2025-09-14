'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, UserPlusIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/store';
import { getFeedPosts, followUser, unfollowUser, getUserRecsGivenCount } from '@/lib/firestore';
import { User, Post } from '@/lib/types';
import PostCard from './PostCard';

interface PublicProfileScreenProps {
  user: User;
  onBack: () => void;
}

export default function PublicProfileScreen({ user: profileUser, onBack }: PublicProfileScreenProps) {
  const router = useRouter();
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [recsGivenCount, setRecsGivenCount] = useState(0);
  
  const { user: currentUser, userProfile, setUserProfile } = useAuthStore();

  const isFollowing = userProfile?.following.includes(profileUser.id) || false;

  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Get all posts from this specific user
        const allPosts = await getFeedPosts([profileUser.id], profileUser.id);
        const userOnlyPosts = allPosts.filter(post => post.authorId === profileUser.id);
        setUserPosts(userOnlyPosts);

        // Get recs given count
        const recsCount = await getUserRecsGivenCount(profileUser.id);
        setRecsGivenCount(recsCount);
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [profileUser.id]);

  const handleFollowToggle = async () => {
    if (!currentUser || !userProfile || followLoading) return;

    setFollowLoading(true);

    try {
      if (isFollowing) {
        await unfollowUser(currentUser.uid, profileUser.id);
        const updatedFollowing = userProfile.following.filter(id => id !== profileUser.id);
        setUserProfile({
          ...userProfile,
          following: updatedFollowing
        });
      } else {
        await followUser(currentUser.uid, profileUser.id);
        setUserProfile({
          ...userProfile,
          following: [...userProfile.following, profileUser.id]
        });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handlePostClick = (postId: string) => {
    router.push(`/post/${postId}?from=profile&userId=${profileUser.id}&userName=${encodeURIComponent(profileUser.name)}`);
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
          </div>
        </div>

        {/* User Profile Section */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            {profileUser.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{profileUser.name}</h2>
          <p className="text-gray-600 text-sm">
            {profileUser.username ? `@${profileUser.username}` : 'Rex user'}
          </p>
          
          <div className="flex justify-center space-x-4 mt-4">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">{profileUser.following.length || 0}</div>
              <div className="text-sm text-gray-500">Following</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">{userPosts.length || 0}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">{recsGivenCount}</div>
              <div className="text-sm text-gray-500">Recs Given</div>
            </div>
          </div>

          {/* Follow/Unfollow Button */}
          {currentUser?.uid !== profileUser.id && (
            <div className="mt-6">
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto ${
                  isFollowing
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {followLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    <span>...</span>
                  </>
                ) : isFollowing ? (
                  <>
                    <UserMinusIcon className="h-4 w-4" />
                    <span>Unfollow</span>
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="h-4 w-4" />
                    <span>Follow</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* User's Posts Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {profileUser.name}&apos;s Activity
          </h3>
          
          {loading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : userPosts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📝</span>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h4>
              <p className="text-gray-500 text-sm">
                {profileUser.name} hasn&apos;t shared any activity yet
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {userPosts.map((post) => (
                <PostCard key={post.id} post={post} onPostClick={handlePostClick} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 