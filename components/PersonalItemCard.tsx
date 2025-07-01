'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, ShareIcon, TrashIcon, PencilSquareIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { PersonalItem } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
import { updatePersonalItemStatus, deletePersonalItem, sharePersonalItemAsPost } from '@/lib/firestore';
import { Timestamp } from 'firebase/firestore';
import { useAuthStore, useAppStore } from '@/lib/store';
import EditModal from './EditModal';

interface PersonalItemCardProps {
  item: PersonalItem;
  onUserClick?: (userId: string) => void;
}

export default function PersonalItemCard({ 
  item,
  onUserClick
}: PersonalItemCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [shareDescription, setShareDescription] = useState(item.description);
  const [postToFeed, setPostToFeed] = useState(true);
  
  const { userProfile } = useAuthStore();
  const { updatePersonalItem, removePersonalItem, addPost } = useAppStore();
  
  const category = CATEGORIES.find(c => c.id === item.category);
  
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

  const handleMarkComplete = async () => {
    setLoading('complete');
    try {
      await updatePersonalItemStatus(item.id, 'completed');
      updatePersonalItem(item.id, { 
        status: 'completed',
        completedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error marking item complete:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    setLoading('delete');
    try {
      await deletePersonalItem(item.id);
      removePersonalItem(item.id);
    } catch (error) {
      console.error('Error deleting item:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleShare = async () => {
    if (!userProfile) return;
    
    setLoading('share');
    try {
      let postId = null;
      
      // Only create feed post if user chose to post to feed
      if (postToFeed) {
        postId = await sharePersonalItemAsPost(item, userProfile.name, shareDescription);
        
        // Add to posts feed (optimistic update)
        const newPost = {
          id: postId,
          authorId: item.userId,
          authorName: userProfile.name,
          category: item.category,
          title: item.title,
          description: shareDescription,
          createdAt: Timestamp.now(),
          savedBy: [],
          postType: 'manual' as const,
        };
        addPost(newPost);
      }
      
      // Update local state - change to shared status
      updatePersonalItem(item.id, { 
        status: 'shared',
        ...(postId && { sharedPostId: postId })
      });
      
      setShowShareDialog(false);
    } catch (error) {
      console.error('Error sharing item:', error);
    } finally {
      setLoading(null);
    }
  };

  const getStatusColor = () => {
    switch (item.status) {
      case 'want_to_try': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'completed': return 'bg-green-50 text-green-700 border-green-200';
      case 'shared': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = () => {
    switch (item.status) {
      case 'want_to_try': return 'Want to Try';
      case 'completed': return 'Completed';
      case 'shared': return 'Shared';
      default: return '';
    }
  };

  const handleCardClick = () => {
    // Only navigate if this item was shared as a post
    if (item.sharedPostId) {
      router.push(`/post/${item.sharedPostId}?from=profile`);
    }
  };

  return (
    <>
      <div 
        className={`bg-white rounded-lg border border-gray-200 p-4 mb-3 ${
          item.sharedPostId ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all' : ''
        }`}
        onClick={handleCardClick}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{category?.emoji}</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            {item.sharedPostId && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-200">
                View post →
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-xs text-gray-500">
              {formatDate(item.createdAt)}
              {item.completedAt && item.status === 'completed' && (
                <span className="ml-1">• Completed {formatDate(item.completedAt)}</span>
              )}
            </span>
            {item.sharedPostId && (
              <ChevronRightIcon className="h-3 w-3 text-gray-400" />
            )}
          </div>
        </div>

        {/* Content */}
        <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
        <p className="text-gray-600 text-sm mb-2">{item.description}</p>
        {item.recommendedBy && (
          <p className="text-sm text-gray-600 mb-2">
            🤝 Recommended by {item.recommendedByUserId ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUserClick?.(item.recommendedByUserId!);
                }}
                className="font-medium text-blue-600 hover:text-blue-700 underline"
              >
                {item.recommendedBy}
              </button>
            ) : (
              <span className="font-medium">{item.recommendedBy}</span>
            )}
          </p>
        )}
        {!item.recommendedBy && <div className="mb-4" />}

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {item.status === 'want_to_try' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkComplete();
                }}
                disabled={loading === 'complete'}
                className="flex items-center space-x-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50 text-sm"
              >
                <CheckIcon className="h-4 w-4" />
                <span>{loading === 'complete' ? 'Marking...' : 'Mark Complete'}</span>
              </button>
            </>
          )}
          
          {item.status === 'completed' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowShareDialog(true);
              }}
              disabled={loading === 'share'}
              className="flex items-center space-x-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50 text-sm"
            >
              <ShareIcon className="h-4 w-4" />
              <span>Share</span>
            </button>
          )}

          {item.status === 'shared' && (
            <>
              {item.sharedPostId ? (
                <span className="flex items-center space-x-1 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm">
                  <ShareIcon className="h-4 w-4" />
                  <span>Posted to feed</span>
                </span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPostToFeed(true); // Default to posting to feed for already shared items
                    setShowShareDialog(true);
                  }}
                  disabled={loading === 'share'}
                  className="flex items-center space-x-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50 text-sm"
                >
                  <ShareIcon className="h-4 w-4" />
                  <span>Post to feed</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowEditModal(true);
            }}
            className="flex items-center space-x-1 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 text-sm"
            title="Edit item"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            disabled={loading === 'delete'}
            className="flex items-center space-x-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 text-sm ml-auto"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Share Dialog */}
      {showShareDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {item.status === 'shared' && !item.sharedPostId ? 'Post to Feed' : 'Share'}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Update your description (optional)
              </label>
              <textarea
                value={shareDescription}
                onChange={(e) => setShareDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
                placeholder="Add details about your experience..."
              />
            </div>
            
            {/* Post to Feed Option */}
            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={postToFeed}
                  onChange={(e) => setPostToFeed(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm text-gray-700">
                  📢 Post to feed for friends to discover
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-7">
                Your friends will see this in their feed and can save it to their Want to Try list
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowShareDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                disabled={loading === 'share'}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading === 'share' ? 'Sharing...' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <EditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        item={item}
        type="personal"
      />
    </>
  );
} 