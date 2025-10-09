'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { PostV2, Thing, UserThingInteraction } from '@/lib/types';
import { 
  createUserThingInteraction, 
  deleteUserThingInteraction,
  createRecommendation
} from '@/lib/firestore';
import { useAuthStore, useAppStore } from '@/lib/store';
import { CATEGORIES } from '@/lib/types';
import { 
  BookmarkIcon, 
  ChatBubbleLeftIcon,
  EllipsisVerticalIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import CommentSection from './CommentSection';
import StarRating from './StarRating';

interface PostCardV2Props {
  post: PostV2;
  thing: Thing;
  userInteraction?: UserThingInteraction;
  avgRating?: number | null;
  onAuthorClick?: (userId: string) => void;
  onPostClick?: (postId: string) => void;
}

export default function PostCardV2({ post, thing, userInteraction, avgRating, onAuthorClick }: PostCardV2Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [tempRating, setTempRating] = useState(0);

  const { user } = useAuthStore();
  const { 
    addUserInteraction, 
    removeUserInteraction,
    updateUserInteraction
  } = useAppStore();
  
  const category = CATEGORIES.find(c => c.id === thing.category);
  const isInBucketList = userInteraction?.state === 'bucketList';
  const isCompleted = userInteraction?.state === 'completed';

  const formatDate = (timestamp: unknown) => {
    let date: Date;
    
    // Handle different timestamp formats
    type TimestampLike = { toDate: () => Date };
    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof (timestamp as TimestampLike).toDate === 'function') {
      // Firestore Timestamp
      date = (timestamp as TimestampLike).toDate();
    } else if (timestamp instanceof Date) {
      // Already a Date object
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      // Unix timestamp
      date = new Date(timestamp);
    } else {
      // Fallback if format is unknown
      console.warn('Unknown timestamp format:', timestamp);
      return 'Recently';
    }
    
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
    return `${Math.floor(diffInDays / 30)}mo ago`;
  };

  const handleSaveToggle = async () => {
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
      } else if (isCompleted) {
        // Change from completed to bucket list
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
        
        // Update or add the interaction
        if (userInteraction) {
          updateUserInteraction(userInteraction.id, { state: 'bucketList' });
        } else {
          addUserInteraction(newInteraction);
        }
        console.log('✅ Changed to bucket list');
        
        // Create recommendation (post author recommended to you)
        if (post.authorId !== user.uid) {
          await createRecommendation(
            post.authorId,
            user.uid,
            thing.id,
            'Saved from feed'
          );
          console.log('🎁 Recommendation created');
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
        
        // Create recommendation (post author recommended to you)
        if (post.authorId !== user.uid) {
          await createRecommendation(
            post.authorId,
            user.uid,
            thing.id,
            'Saved from feed'
          );
          console.log('🎁 Recommendation created');
        }
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteToggle = async () => {
    if (!user) return;
    
    if (isCompleted) {
      // Change from completed back to bucket list
      setLoading(true);
      try {
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
        
        // Update or add the interaction
        if (userInteraction) {
          updateUserInteraction(userInteraction.id, { state: 'bucketList' });
        } else {
          addUserInteraction(newInteraction);
        }
        console.log('✅ Changed back to bucket list');
      } catch (error) {
        console.error('Error updating to bucket list:', error);
      } finally {
        setLoading(false);
      }
    } else {
      // Show rating modal
      setTempRating(0);
      setShowRatingModal(true);
    }
  };

  const handleRatingSubmit = async (skipRating = false) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const rating = skipRating ? undefined : (tempRating > 0 ? tempRating : undefined);
      
      const interactionId = await createUserThingInteraction(
        user.uid,
        thing.id,
        'completed',
        'friends',
        rating
      );
      
      const newInteraction: UserThingInteraction = {
        id: interactionId,
        userId: user.uid,
        thingId: thing.id,
        state: 'completed',
        date: post.createdAt,
        visibility: 'friends',
        createdAt: post.createdAt,
        rating
      };
      
      // Update or add the interaction
      if (userInteraction) {
        updateUserInteraction(userInteraction.id, { state: 'completed', rating });
      } else {
        addUserInteraction(newInteraction);
      }
      console.log('✅ Marked as completed', rating ? `with rating ${rating}/5` : '');
      
      // Note: No recommendation created for completing items
      
      setShowRatingModal(false);
      setTempRating(0);
    } catch (error) {
      console.error('Error marking as completed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostClick = () => {
    // Toggle comments section instead of navigating
    setShowComments(!showComments);
  };

  const handleAuthorClick = () => {
    if (onAuthorClick) {
      onAuthorClick(post.authorId);
    } else {
      router.push(`/user/${post.authorId}`);
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

      {/* Thing Title (emoji + title only) */}
      <div className="mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{category?.emoji}</span>
          <h3 className="font-semibold text-gray-900 text-lg">{thing.title}</h3>
        </div>
      </div>

      {/* Ratings */}
      {(post.rating || avgRating) && (
        <div className="mb-3 space-y-1.5">
          {/* User's Rating */}
          {post.rating && post.rating > 0 && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
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
              </div>
              <span className="text-sm font-medium text-gray-900">
                {post.rating}/5
              </span>
              <span className="text-xs text-gray-500">(You)</span>
            </div>
          )}
          
          {/* Average Rating */}
          {avgRating && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => {
                  const isFullStar = i < Math.floor(avgRating);
                  const isPartialStar = i < avgRating && !isFullStar;
                  return (
                    <span
                      key={i}
                      className={`text-lg ${
                        isFullStar ? 'text-yellow-400' : 
                        isPartialStar ? 'text-yellow-300' : 
                        'text-gray-300'
                      }`}
                    >
                      ★
                    </span>
                  );
                })}
              </div>
              <span className="text-sm font-medium text-gray-700">
                {avgRating.toFixed(1)}/5
              </span>
              <span className="text-xs text-gray-500">(Rex Avg)</span>
            </div>
          )}
        </div>
      )}

      {/* Post Content */}
      {post.content && (
        <div className="mb-4">
          <p className="text-gray-700 leading-relaxed">{post.content}</p>
        </div>
      )}

      {/* Photos */}
      {post.photos && post.photos.length > 0 && (
        <div className="mb-4">
          {post.photos.length === 1 ? (
            <div className="relative w-full h-96 rounded-lg overflow-hidden">
              <Image
                src={post.photos[0]}
                alt="Post photo"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 600px"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {post.photos.map((photo, index) => (
                <div key={index} className="relative w-full h-48 rounded-lg overflow-hidden">
                  <Image
                    src={photo}
                    alt={`Photo ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 300px"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center space-x-1">
          {/* Comment Button */}
          <button
            onClick={handlePostClick}
            className="flex items-center space-x-1 px-3 py-2 rounded-full text-gray-500 hover:text-blue-500 hover:bg-blue-50 transition-colors"
          >
            <ChatBubbleLeftIcon className="h-5 w-5" />
            <span className="text-sm font-medium">{post.commentCount || 0}</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSaveToggle}
            disabled={loading}
            className={`flex items-center space-x-1 px-3 py-2 rounded-full transition-colors disabled:opacity-50 ${
              isInBucketList
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-blue-500 hover:bg-blue-50'
            }`}
          >
            <BookmarkIcon className={`h-5 w-5 ${isInBucketList ? 'fill-current' : ''}`} />
            <span className="text-sm font-medium">Save</span>
          </button>

          {/* Complete Button */}
          <button
            onClick={handleCompleteToggle}
            disabled={loading}
            className={`flex items-center space-x-1 px-3 py-2 rounded-full transition-colors disabled:opacity-50 ${
              isCompleted
                ? 'text-green-600 bg-green-50'
                : 'text-gray-500 hover:text-green-500 hover:bg-green-50'
            }`}
          >
            <CheckCircleIcon className={`h-5 w-5 ${isCompleted ? 'fill-current' : ''}`} />
            <span className="text-sm font-medium">Complete</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <CommentSection postId={post.id} />
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRatingModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Mark as Completed
              </h3>
              <p className="text-gray-600 text-sm">
                {thing.title}
              </p>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                How would you rate it? (optional)
              </label>
              <div className="flex justify-center">
                <StarRating 
                  rating={tempRating} 
                  onRatingChange={setTempRating}
                  maxRating={5}
                  showLabel={false}
                  size="lg"
                />
              </div>
              {tempRating > 0 && (
                <p className="text-center text-sm text-gray-600 mt-2">
                  {tempRating}/5
                </p>
              )}
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => handleRatingSubmit(false)}
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : (tempRating > 0 ? `Complete with ${tempRating}/5 Rating` : 'Complete')}
              </button>
              <button
                onClick={() => handleRatingSubmit(true)}
                disabled={loading}
                className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Skip Rating
              </button>
              <button
                onClick={() => setShowRatingModal(false)}
                disabled={loading}
                className="w-full text-gray-500 py-2 px-4 rounded-lg font-medium hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
