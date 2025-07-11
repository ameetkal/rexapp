'use client';

import { useState, useEffect } from 'react';
import { BookmarkIcon, PencilSquareIcon, ChevronDownIcon, EyeSlashIcon, TrashIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { Post, PersonalItem } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
import { savePostAsPersonalItem, unsavePersonalItem, getPersonalItemByPostId, unsharePost, fullyDeletePost } from '@/lib/firestore';
import { Timestamp } from 'firebase/firestore';
import { useAuthStore, useAppStore } from '@/lib/store';
import EditModal from './EditModal';

interface PostCardProps {
  post: Post;
  onAuthorClick?: (authorId: string) => void;
  onPostClick?: (postId: string) => void;
}

export default function PostCard({ post, onAuthorClick, onPostClick }: PostCardProps) {
  const [loading, setLoading] = useState(false);
  const [unshareLoading, setUnshareLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [savedPersonalItem, setSavedPersonalItem] = useState<PersonalItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { user } = useAuthStore();
  const { addPersonalItem, removePersonalItem, personalItems, updatePersonalItem, removePost } = useAppStore();
  
  const category = CATEGORIES.find(c => c.id === post.category);
  const isSaved = !!savedPersonalItem;
  
  // Check if post has enhanced fields worth showing
  const hasEnhancedFields = !!(
    (post.rating && post.rating > 0) ||
    post.location ||
    post.priceRange ||
    (post.customPrice && post.customPrice > 0) ||
    (post.tags && post.tags.length > 0) ||
    post.experienceDate ||
    (post.taggedUsers && post.taggedUsers.length > 0) ||
    (post.taggedNonUsers && post.taggedNonUsers.length > 0)
  );

  // Check if this post is already saved as a personal item
  useEffect(() => {
    const checkSaveStatus = async () => {
      if (!user) return;
      
      // First check local store
      const existingItem = personalItems.find(
        item => item.originalPostId === post.id
      );
      
      if (existingItem) {
        setSavedPersonalItem(existingItem);
      } else {
        // Check database as fallback
        const savedItem = await getPersonalItemByPostId(user.uid, post.id);
        setSavedPersonalItem(savedItem);
      }
    };
    
    checkSaveStatus();
  }, [user, post.id, personalItems]);
  
  const formatDate = (timestamp: { toDate: () => Date }) => {
    const date = timestamp.toDate();
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMins = Math.floor(diffInMs / (1000 * 60));
      return `${diffInMins}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const handleSaveToggle = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      if (isSaved && savedPersonalItem) {
        // Unsave - remove personal item
        await unsavePersonalItem(savedPersonalItem.id);
        removePersonalItem(savedPersonalItem.id);
        setSavedPersonalItem(null);
      } else {
        // Save - create personal item
        const personalItemId = await savePostAsPersonalItem(post, user.uid);
        
        const newPersonalItem: PersonalItem = {
          id: personalItemId,
          userId: user.uid,
          category: post.category,
          title: post.title,
          description: post.description,
          status: 'want_to_try',
          createdAt: Timestamp.now(),
          source: 'saved_from_post',
          originalPostId: post.id,
          originalAuthorId: post.authorId,
          originalAuthorName: post.authorName,
          // Inherit the post author as the recommender
          recommendedBy: post.authorName,
          recommendedByUserId: post.authorId,
          // Copy any enhanced fields from the original post
          ...(post.rating && { rating: post.rating }),
          ...(post.location && { location: post.location }),
          ...(post.priceRange && { priceRange: post.priceRange }),
          ...(post.customPrice && { customPrice: post.customPrice }),
          ...(post.tags && { tags: post.tags }),
          ...(post.experienceDate && { experienceDate: post.experienceDate }),
          ...(post.taggedUsers && { taggedUsers: post.taggedUsers }),
          ...(post.taggedNonUsers && { taggedNonUsers: post.taggedNonUsers }),
        };
        
        addPersonalItem(newPersonalItem);
        setSavedPersonalItem(newPersonalItem);
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnshare = async () => {
    if (!user || !savedPersonalItem || post.authorId !== user.uid) return;

    // Confirm with user
    if (!confirm('Remove this post from the feed? You\'ll keep it in your personal list as "Completed".')) {
      return;
    }

    setUnshareLoading(true);
    try {
      await unsharePost(post.id, savedPersonalItem.id);
      
      // Update the personal item status in store
      updatePersonalItem(savedPersonalItem.id, { 
        status: 'completed',
        sharedPostId: undefined 
      });
      
      // Remove the post from the store
      removePost(post.id);
      
      console.log('📤 Successfully unshared post');
    } catch (error) {
      console.error('Error unsharing post:', error);
      alert('Failed to unshare post. Please try again.');
    } finally {
      setUnshareLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || post.authorId !== user.uid) return;

    // Confirm with user
    if (!confirm('Are you sure you want to permanently delete this post? This action cannot be undone and will remove it from everyone\'s lists.')) {
      return;
    }

    setDeleteLoading(true);
    try {
      await fullyDeletePost(post.id);
      
      // Remove from local store
      removePost(post.id);
      
      // Also remove any associated personal items from local store
      if (savedPersonalItem) {
        removePersonalItem(savedPersonalItem.id);
      }
      
      console.log('🗑️ Successfully deleted post');
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {/* Author Info - Clickable for other users */}
        {onAuthorClick && user && post.authorId !== user.uid ? (
          <button
            onClick={() => onAuthorClick(post.authorId)}
            className="flex items-center space-x-3 hover:opacity-75 transition-opacity text-left"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
              {post.authorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-gray-900">{post.authorName}</p>
              <p className="text-sm text-gray-500">{formatDate(post.createdAt)}</p>
            </div>
          </button>
        ) : (
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
              {post.authorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-gray-900">{post.authorName}</p>
              <p className="text-sm text-gray-500">{formatDate(post.createdAt)}</p>
            </div>
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          {/* Edit button - only show for posts authored by current user */}
          {user && post.authorId === user.uid && (
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
              title="Edit post"
            >
              <PencilSquareIcon className="h-5 w-5" />
            </button>
          )}
          
          {/* Unshare button - only show for user's own posts that have a personal item */}
          {user && post.authorId === user.uid && savedPersonalItem && savedPersonalItem.status === 'shared' && (
            <button
              onClick={handleUnshare}
              disabled={unshareLoading}
              className={`p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors ${
                unshareLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Remove from feed"
            >
              <EyeSlashIcon className="h-5 w-5" />
            </button>
          )}

          {/* Delete button - only show for posts authored by current user */}
          {user && post.authorId === user.uid && (
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className={`p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors ${
                deleteLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Delete post permanently"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          )}
          
          {/* Save button - only show for posts not authored by current user */}
          {user && post.authorId !== user.uid && (
            <button
              onClick={handleSaveToggle}
              disabled={loading}
              className={`p-2 rounded-full transition-colors ${
                isSaved 
                  ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isSaved ? 'Remove from Want to Try' : 'Add to Want to Try'}
            >
              {isSaved ? (
                <BookmarkSolid className="h-5 w-5" />
              ) : (
                <BookmarkIcon className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Category Badge and Status Indicators */}
      <div className="flex items-center space-x-2 mb-3">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <span className="mr-1">{category?.emoji}</span>
          {category?.name}
        </span>
        
        {/* Personal Status Indicator */}
        {savedPersonalItem && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            savedPersonalItem.status === 'want_to_try' 
              ? 'bg-blue-100 text-blue-800' 
              : savedPersonalItem.status === 'completed'
              ? 'bg-green-100 text-green-800'
              : 'bg-purple-100 text-purple-800' // for 'shared' status
          }`}>
            {savedPersonalItem.status === 'want_to_try' && '📖 Want to Try'}
            {savedPersonalItem.status === 'completed' && '✅ Completed'}
            {savedPersonalItem.status === 'shared' && '✅ Completed'}
          </span>
        )}
      </div>

      {/* Content */}
      <div 
        className="space-y-2 cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
        onClick={() => onPostClick?.(post.id)}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-gray-900 leading-tight flex-1">
            {post.title}
          </h3>
          <div className="ml-2 flex-shrink-0 flex items-center space-x-1 text-gray-400">
            <span className="text-xs">view details</span>
            <ChevronDownIcon className="h-4 w-4 rotate-[-90deg]" />
          </div>
        </div>
        {/* Description */}
        {post.description && (
          <p className="text-gray-600 leading-relaxed">
            {post.description}
          </p>
        )}
        {post.recommendedBy && (
          <p className="text-sm text-gray-600 mb-2">
            🤝 Recommended by {post.recommendedByUserId ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAuthorClick?.(post.recommendedByUserId!);
                }}
                className="font-medium text-blue-600 hover:text-blue-700 underline"
              >
                {post.recommendedBy}
              </button>
            ) : (
              <span className="font-medium">{post.recommendedBy}</span>
            )}
          </p>
        )}
        
        {/* Quick preview of enhanced details */}
        {hasEnhancedFields && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {/* Rating */}
              {post.rating && post.rating > 0 && (
                <div className="flex items-center space-x-1">
                  <span>⭐</span>
                  <span>{post.rating}/10</span>
                </div>
              )}
              
              {/* Location */}
              {post.location && (
                <div className="flex items-center space-x-1">
                  <span>📍</span>
                  <span className="truncate max-w-[120px]">{post.location}</span>
                </div>
              )}
              
              {/* Price */}
              {(post.priceRange || (post.customPrice && post.customPrice > 0)) && (
                <div className="flex items-center space-x-1">
                  <span>💰</span>
                  <span>
                    {post.priceRange && post.priceRange}
                    {post.customPrice && post.customPrice > 0 && ` ($${post.customPrice})`}
                  </span>
                </div>
              )}
              
              {/* Tags count */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex items-center space-x-1">
                  <span>🏷️</span>
                  <span>{post.tags.length} tag{post.tags.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
            
            <p className="text-xs text-gray-500 italic">Click to view full details →</p>
          </div>
        )}
      </div>

      {/* Footer - removed savedBy count since we're using personal items now */}
      
      {/* Edit Modal */}
      <EditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        item={post}
        type="post"
      />
    </div>
  );
} 