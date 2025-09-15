'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PostV2, Thing, UserThingInteraction } from '@/lib/types';
import { 
  createUserThingInteraction, 
  deleteUserThingInteraction,
  likePostV2,
  unlikePostV2
} from '@/lib/firestore';
import { useAuthStore, useAppStore } from '@/lib/store';
import { CATEGORIES } from '@/lib/types';
import { 
  HeartIcon, 
  BookmarkIcon, 
  ShareIcon,
  ChatBubbleLeftIcon,
  EllipsisVerticalIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconFilled } from '@heroicons/react/24/solid';

interface PostCardV2Props {
  post: PostV2;
  thing: Thing;
  userInteraction?: UserThingInteraction;
  onAuthorClick?: (userId: string) => void;
  onPostClick?: (postId: string) => void;
}

export default function PostCardV2({ post, thing, userInteraction, onAuthorClick, onPostClick }: PostCardV2Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likedBy?.length || 0);
  const [showMenu, setShowMenu] = useState(false);

  const { user } = useAuthStore();
  const { 
    addUserInteraction, 
    removeUserInteraction
  } = useAppStore();
  
  const category = CATEGORIES.find(c => c.id === thing.category);
  const isInBucketList = userInteraction?.state === 'bucketList';
  const isCompleted = userInteraction?.state === 'completed';
  
  // Check if user has liked this post
  useEffect(() => {
    if (user && post.likedBy) {
      setIsLiked(post.likedBy.includes(user.uid));
    }
  }, [user, post.likedBy]);

  const formatDate = (timestamp: { toDate: () => Date }) => {
    const date = timestamp.toDate();
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
    return `${Math.floor(diffInDays / 30)}mo ago`;
  };

  const handleBucketListToggle = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      if (isInBucketList) {
        // Remove from bucket list
        if (userInteraction) {
          await deleteUserThingInteraction(userInteraction.id);
          removeUserInteraction(userInteraction.id);
          console.log('🗑️ Removed from bucket list');
        }
      } else {
        // Add to bucket list
        const interactionId = await createUserThingInteraction(
          user.uid,
          thing.id,
          'bucketList',
          'friends'
        );
        
        const newInteraction: UserThingInteraction = {
          id: interactionId,
          userId: user.uid,
          thingId: thing.id,
          state: 'bucketList',
          date: post.createdAt,
          visibility: 'friends',
          createdAt: post.createdAt,
        };
        
        addUserInteraction(newInteraction);
        console.log('✅ Added to bucket list');
      }
    } catch (error) {
      console.error('Error toggling bucket list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLikeToggle = async () => {
    if (!user) return;
    
    try {
      if (isLiked) {
        await unlikePostV2(post.id, user.uid);
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await likePostV2(post.id, user.uid);
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handlePostClick = () => {
    if (onPostClick) {
      onPostClick(post.id);
    } else {
      router.push(`/post/${post.id}`);
    }
  };

  const handleAuthorClick = () => {
    if (onAuthorClick) {
      onAuthorClick(post.authorId);
    } else {
      router.push(`/user/${post.authorId}`);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Check out ${thing.title}`,
        text: post.content,
        url: `${window.location.origin}/post/${post.id}`
      });
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
      // You could show a toast notification here
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAuthorClick}
            className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm hover:bg-blue-200 transition-colors"
          >
            {post.authorName.charAt(0).toUpperCase()}
          </button>
          <div>
            <button
              onClick={handleAuthorClick}
              className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
            >
              {post.authorName}
            </button>
            <p className="text-xs text-gray-500">{formatDate(post.createdAt)}</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {/* Thing Title & Category */}
      <div className="mb-3">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-lg">{category?.emoji}</span>
          <h3 className="font-semibold text-gray-900 text-lg">{thing.title}</h3>
        </div>
        <p className="text-sm text-gray-600">{category?.name}</p>
      </div>

      {/* Post Content */}
      {post.content && (
        <div className="mb-4">
          <p className="text-gray-700 leading-relaxed">{post.content}</p>
        </div>
      )}

      {/* Thing Metadata */}
      {thing.metadata && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {thing.metadata.author && (
              <div>
                <span className="text-gray-500">Author:</span>
                <span className="ml-1 text-gray-900">{thing.metadata.author}</span>
              </div>
            )}
            {thing.metadata.director && (
              <div>
                <span className="text-gray-500">Director:</span>
                <span className="ml-1 text-gray-900">{thing.metadata.director}</span>
              </div>
            )}
            {thing.metadata.year && (
              <div>
                <span className="text-gray-500">Year:</span>
                <span className="ml-1 text-gray-900">{thing.metadata.year}</span>
              </div>
            )}
            {thing.metadata.placeType && (
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-1 text-gray-900 capitalize">{thing.metadata.placeType.replace('_', ' ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rating */}
      {post.rating && post.rating > 0 && (
        <div className="mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Rating:</span>
            <div className="flex items-center space-x-1">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className={`text-lg ${
                    i < post.rating! ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                >
                  ★
                </span>
              ))}
              <span className="text-sm text-gray-600 ml-1">({post.rating}/5)</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center space-x-4">
          {/* Like Button */}
          <button
            onClick={handleLikeToggle}
            className={`flex items-center space-x-1 px-3 py-1 rounded-full transition-colors ${
              isLiked 
                ? 'text-red-500 bg-red-50 hover:bg-red-100' 
                : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
            }`}
          >
            {isLiked ? (
              <HeartIconFilled className="h-4 w-4" />
            ) : (
              <HeartIcon className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">{likesCount}</span>
          </button>

          {/* Comment Button */}
          <button
            onClick={handlePostClick}
            className="flex items-center space-x-1 px-3 py-1 rounded-full text-gray-500 hover:text-blue-500 hover:bg-blue-50 transition-colors"
          >
            <ChatBubbleLeftIcon className="h-4 w-4" />
            <span className="text-sm font-medium">Comment</span>
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="flex items-center space-x-1 px-3 py-1 rounded-full text-gray-500 hover:text-green-500 hover:bg-green-50 transition-colors"
          >
            <ShareIcon className="h-4 w-4" />
            <span className="text-sm font-medium">Share</span>
          </button>
        </div>

        {/* Bucket List Button */}
        <button
          onClick={handleBucketListToggle}
          disabled={loading}
          className={`flex items-center space-x-1 px-3 py-1 rounded-full transition-colors disabled:opacity-50 ${
            isInBucketList
              ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
              : 'text-gray-500 hover:text-blue-500 hover:bg-blue-50'
          }`}
        >
          <BookmarkIcon className="h-4 w-4" />
          <span className="text-sm font-medium">
            {loading ? '...' : isInBucketList ? 'In Bucket List' : 'Add to Bucket List'}
          </span>
        </button>
      </div>

      {/* Status Indicators */}
      {(isCompleted || isInBucketList) && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center space-x-2">
            {isCompleted && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✅ Completed
              </span>
            )}
            {isInBucketList && !isCompleted && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                📝 In Bucket List
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
