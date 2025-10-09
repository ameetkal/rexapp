'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Thing, UserThingInteraction } from '@/lib/types';
import { 
  createUserThingInteraction, 
  deleteUserThingInteraction,
  createRecommendation,
  updateInteractionContent
} from '@/lib/firestore';
import { useAuthStore, useAppStore } from '@/lib/store';
import { CATEGORIES } from '@/lib/types';
import { 
  BookmarkIcon, 
  ChatBubbleLeftIcon,
  CheckCircleIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import CommentSection from './CommentSection';
import StarRating from './StarRating';

interface PostCardV2Props {
  interaction: UserThingInteraction; // The interaction being displayed (could be anyone's)
  thing: Thing;
  myInteraction?: UserThingInteraction; // Current user's interaction with this thing (for button states)
  avgRating?: number | null;
  isOwnInteraction?: boolean; // Whether current user owns the displayed interaction
  onAuthorClick?: (userId: string) => void;
}

export default function PostCardV2({ interaction, thing, myInteraction, avgRating, isOwnInteraction, onAuthorClick }: PostCardV2Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [tempRating, setTempRating] = useState(0);
  
  // Local state to track MY interaction for immediate UI updates (button highlighting)
  const [localMyInteraction, setLocalMyInteraction] = useState<UserThingInteraction | undefined>(myInteraction);
  
  // Edit form state (for editing the displayed interaction if it's yours)
  const [editContent, setEditContent] = useState(interaction.content || '');
  const [editRating, setEditRating] = useState(interaction.rating || 0);
  
  const menuRef = useRef<HTMLDivElement>(null);

  const { user, userProfile } = useAuthStore();
  const { 
    addUserInteraction, 
    removeUserInteraction,
    updateUserInteraction
  } = useAppStore();
  
  const isOwnPost = isOwnInteraction || (user?.uid === interaction.userId);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);
  
  const category = CATEGORIES.find(c => c.id === thing.category);
  
  // Use myInteraction to determine button states (what YOU have done with this thing)
  const currentMyInteraction = localMyInteraction || myInteraction;
  const isInBucketList = currentMyInteraction?.state === 'bucketList';
  const isCompleted = currentMyInteraction?.state === 'completed';

  const formatDate = (timestamp: unknown) => {
    let date: Date;
    
    // Handle different timestamp formats
    type TimestampLike = { toDate: () => Date };
    type TimestampObject = { seconds: number; nanoseconds: number };
    
    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof (timestamp as TimestampLike).toDate === 'function') {
      // Firestore Timestamp with toDate method
      date = (timestamp as TimestampLike).toDate();
    } else if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp && 'nanoseconds' in timestamp) {
      // Firestore Timestamp object (raw format)
      const ts = timestamp as TimestampObject;
      date = new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000);
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
    if (!user || !userProfile) return;
    
    setLoading(true);
    try {
      if (isInBucketList) {
        // Remove from bucket list
        if (currentMyInteraction) {
          // Optimistic update - remove immediately
          setLocalMyInteraction(undefined);
          
          await deleteUserThingInteraction(currentMyInteraction.id);
          removeUserInteraction(currentMyInteraction.id);
          console.log('🗑️ Removed from bucket list');
        }
      } else if (isCompleted) {
        // Change YOUR interaction from completed to bucket list
        if (currentMyInteraction) {
          const updated = { ...currentMyInteraction, state: 'bucketList' as const };
          setLocalMyInteraction(updated);
          
          await createUserThingInteraction(
            user.uid,
            userProfile.name,
            thing.id,
            'bucketList',
            'private'
          );
          
          updateUserInteraction(currentMyInteraction.id, { state: 'bucketList' });
          console.log('✅ Changed to bucket list');
        }
        
        // Create recommendation (post author recommended to you)
        if (interaction.userId !== user.uid) {
          await createRecommendation(
            interaction.userId,
            user.uid,
            thing.id,
            'Saved from feed'
          );
          console.log('🎁 Recommendation created');
        }
      } else {
        // Create YOUR interaction (private, bucket list)
        const newInteraction: UserThingInteraction = {
          id: '',
          userId: user.uid,
          userName: userProfile.name,
          thingId: thing.id,
          state: 'bucketList',
          date: interaction.createdAt,
          visibility: 'private', // Private - not shown in feed
          createdAt: interaction.createdAt,
          likedBy: [],
          commentCount: 0,
        };
        
        // Optimistic update
        setLocalMyInteraction(newInteraction);
        
        const interactionId = await createUserThingInteraction(
          user.uid,
          userProfile.name,
          thing.id,
          'bucketList',
          'private'
        );
        
        newInteraction.id = interactionId;
        setLocalMyInteraction(newInteraction);
        addUserInteraction(newInteraction);
        console.log('✅ Added to your bucket list (private)');
        
        // Create recommendation: the original poster recommended this to you
        if (interaction.userId !== user.uid) {
          await createRecommendation(
            interaction.userId, // FROM: the person who posted it
            user.uid,          // TO: you (the person saving it)
            thing.id,
            'Saved from feed'
          );
          console.log('🎁 Recommendation created: ' + interaction.userName + ' → You');
        }
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      setLocalMyInteraction(myInteraction);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteToggle = async () => {
    if (!user || !userProfile) return;
    
    if (isCompleted) {
      // Change YOUR interaction back to bucket list
      setLoading(true);
      try {
        if (currentMyInteraction) {
          const updated = { ...currentMyInteraction, state: 'bucketList' as const };
          setLocalMyInteraction(updated);
          
          await createUserThingInteraction(
            user.uid,
            userProfile.name,
            thing.id,
            'bucketList',
            'private'
          );
          
          updateUserInteraction(currentMyInteraction.id, { state: 'bucketList' });
          console.log('✅ Changed back to bucket list');
        }
      } catch (error) {
        console.error('Error updating:', error);
        setLocalMyInteraction(myInteraction);
      } finally {
        setLoading(false);
      }
    } else {
      // Show rating modal to mark as completed
      setTempRating(0);
      setShowRatingModal(true);
    }
  };

  const handleRatingSubmit = async (skipRating = false) => {
    if (!user || !userProfile) return;
    
    setLoading(true);
    try {
      const rating = skipRating ? undefined : (tempRating > 0 ? tempRating : undefined);
      
      const newInteraction: UserThingInteraction = {
        id: currentMyInteraction?.id || '',
        userId: user.uid,
        userName: userProfile.name,
        thingId: thing.id,
        state: 'completed',
        date: interaction.createdAt,
        visibility: 'private', // Private by default
        rating,
        createdAt: currentMyInteraction?.createdAt || interaction.createdAt,
        likedBy: [],
        commentCount: 0,
      };
      
      // Optimistic update
      setLocalMyInteraction(newInteraction);
      setShowRatingModal(false);
      
      await createUserThingInteraction(
        user.uid,
        userProfile.name,
        thing.id,
        'completed',
        'private',
        { rating }
      );
      
      if (currentMyInteraction) {
        updateUserInteraction(currentMyInteraction.id, { state: 'completed', rating });
      } else {
        addUserInteraction(newInteraction);
      }
      
      console.log('✅ Marked as completed', rating ? `with rating ${rating}/5` : '');
      setTempRating(0);
    } catch (error) {
      console.error('Error marking as completed:', error);
      setLocalMyInteraction(myInteraction);
      setShowRatingModal(true);
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
      onAuthorClick(interaction.userId);
    } else {
      router.push(`/user/${interaction.userId}`);
    }
  };

  const handleEditPost = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await updateInteractionContent(interaction.id, {
        content: editContent,
        rating: editRating > 0 ? editRating : undefined,
      });
      
      // Update myInteraction if this is in your list
      if (currentMyInteraction) {
        setLocalMyInteraction({
          ...currentMyInteraction,
          rating: editRating > 0 ? editRating : undefined
        });
        updateUserInteraction(currentMyInteraction.id, { 
          rating: editRating > 0 ? editRating : undefined 
        });
      }
      
      console.log('✅ Interaction updated');
      setShowEditModal(false);
      
      // Refresh to show updated content (since we mutated the prop)
      window.location.reload();
    } catch (error) {
      console.error('Error updating interaction:', error);
      alert('Failed to update. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async () => {
    if (!user) return;
    
    if (!confirm(`Are you sure you want to delete "${thing.title}"? This will remove it from your list and the feed. This cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    try {
      await deleteUserThingInteraction(interaction.id);
      removeUserInteraction(interaction.id);
      console.log('🗑️ Interaction deleted');
      
      // Refresh feed to remove deleted interaction
      window.location.reload();
    } catch (error) {
      console.error('Error deleting interaction:', error);
      alert('Failed to delete. Please try again.');
    } finally {
      setLoading(false);
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
            {(interaction.userName || 'User').charAt(0).toUpperCase()}
          </button>
          <div>
            <button
              onClick={handleAuthorClick}
              className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
            >
              {interaction.userName || 'User'}
            </button>
            <p className="text-xs text-gray-500">{formatDate(interaction.createdAt)}</p>
          </div>
        </div>
        
        {/* Menu for own posts only */}
        {isOwnPost && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
            </button>
            
            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-10">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowEditModal(true);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <PencilIcon className="h-4 w-4" />
                  <span>Edit</span>
                </button>
                
                <button
                  onClick={async () => {
                    setShowMenu(false);
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: `Check out ${thing.title}`,
                          text: interaction.content,
                          url: `${window.location.origin}/post/${interaction.id}`
                        });
                      } catch (error: unknown) {
                        if (error instanceof Error && error.name === 'AbortError') {
                          console.log('Share cancelled by user');
                          return;
                        }
                        console.error('Error sharing:', error);
                      }
                    } else {
                      try {
                        await navigator.clipboard.writeText(`${window.location.origin}/post/${interaction.id}`);
                        alert('Link copied to clipboard!');
                      } catch (error) {
                        console.error('Error copying to clipboard:', error);
                      }
                    }
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <ShareIcon className="h-4 w-4" />
                  <span>Share</span>
                </button>
                
                <div className="border-t border-gray-100 my-1"></div>
                
                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleDeletePost();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                >
                  <TrashIcon className="h-4 w-4" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Thing Title (emoji + title only) */}
      <div className="mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{category?.emoji}</span>
          <h3 className="font-semibold text-gray-900 text-lg">{thing.title}</h3>
        </div>
      </div>

      {/* Ratings */}
      {(interaction.rating || avgRating) && (
        <div className="mb-3 space-y-1.5">
          {/* User's Rating */}
          {interaction.rating && interaction.rating > 0 && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`text-lg ${
                      i < interaction.rating! ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="text-sm font-medium text-gray-900">
                {interaction.rating}/5
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
      {interaction.content && (
        <div className="mb-4">
          <p className="text-gray-700 leading-relaxed">{interaction.content}</p>
        </div>
      )}

      {/* Photos */}
      {interaction.photos && interaction.photos.length > 0 && (
        <div className="mb-4">
          {interaction.photos.length === 1 ? (
            <div className="relative w-full h-96 rounded-lg overflow-hidden">
              <Image
                src={interaction.photos[0]}
                alt="Post photo"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 600px"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {interaction.photos.map((photo, index) => (
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
            <span className="text-sm font-medium">{interaction.commentCount || 0}</span>
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

          {/* Completed Button */}
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
            <span className="text-sm font-medium">Completed</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <CommentSection interactionId={interaction.id} />
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

      {/* Edit Modal */}
      {showEditModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Edit Post
              </h3>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span className="text-lg">{category?.emoji}</span>
                <span>{thing.title}</span>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Edit Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comments
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={4}
                />
              </div>

              {/* Edit Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Rating (optional)
                </label>
                <div className="flex justify-center">
                  <StarRating 
                    rating={editRating} 
                    onRatingChange={setEditRating}
                    maxRating={5}
                    showLabel={true}
                    size="md"
                  />
                </div>
              </div>

              {/* Note about photos */}
              {interaction.photos && interaction.photos.length > 0 && (
                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                  📸 Photo editing coming soon. To change photos, delete and recreate the post.
                </div>
              )}
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditContent(interaction.content || '');
                  setEditRating(interaction.rating || 0);
                }}
                disabled={loading}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditPost}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
