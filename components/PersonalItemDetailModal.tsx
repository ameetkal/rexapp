'use client';

import { useState } from 'react';
import { XMarkIcon, CheckIcon, ShareIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { PersonalItem } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
import { updatePersonalItemStatus, deletePersonalItem, sharePersonalItemAsPost } from '@/lib/firestore';
import { Timestamp } from 'firebase/firestore';
import { useAuthStore, useAppStore } from '@/lib/store';
import EditModal from './EditModal';

interface PersonalItemDetailModalProps {
  item: PersonalItem;
  isOpen: boolean;
  onClose: () => void;
  onUserClick?: (userId: string) => void;
}

export default function PersonalItemDetailModal({ 
  item, 
  isOpen, 
  onClose, 
  onUserClick 
}: PersonalItemDetailModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [shareDescription, setShareDescription] = useState(item.description);
  const [postToFeed, setPostToFeed] = useState(true);
  
  const { userProfile } = useAuthStore();
  const { updatePersonalItem, removePersonalItem, addPost } = useAppStore();
  
  const category = CATEGORIES.find(c => c.id === item.category);

  if (!isOpen) return null;

  const formatDate = (timestamp: { toDate: () => Date }) => {
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  const formatExperienceDate = (timestamp: { toDate: () => Date }) => {
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
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
      onClose();
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
      
      if (postToFeed) {
        postId = await sharePersonalItemAsPost(item, userProfile.name, shareDescription);
        
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

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{category?.emoji}</span>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{item.title}</h1>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor()} mt-1`}>
                  {getStatusText()}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Description */}
            {item.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                <p className="text-gray-900 leading-relaxed">{item.description}</p>
              </div>
            )}

            {/* Enhanced Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {item.rating && item.rating > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Rating</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">⭐</span>
                    <span className="text-lg font-semibold text-gray-900">{item.rating}/10</span>
                  </div>
                </div>
              )}

              {item.location && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Location</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">📍</span>
                    <span className="text-gray-900">{item.location}</span>
                  </div>
                </div>
              )}

              {item.priceRange && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Price Range</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">💰</span>
                    <span className="text-gray-900">{item.priceRange}</span>
                  </div>
                </div>
              )}

              {item.customPrice && item.customPrice > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Price</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">💵</span>
                    <span className="text-gray-900">${item.customPrice}</span>
                  </div>
                </div>
              )}

              {item.experienceDate && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Experience Date</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">📅</span>
                    <span className="text-gray-900">{formatExperienceDate(item.experienceDate)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended By */}
            {item.recommendedBy && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Recommended By</h4>
                <div className="flex items-center space-x-2">
                  <span className="text-xl">🤝</span>
                  {item.recommendedByUserId ? (
                    <button
                      onClick={() => onUserClick?.(item.recommendedByUserId!)}
                      className="font-medium text-blue-600 hover:text-blue-700 underline"
                    >
                      {item.recommendedBy}
                    </button>
                  ) : (
                    <span className="text-gray-900">{item.recommendedBy}</span>
                  )}
                </div>
              </div>
            )}



            {/* Dates */}
            <div className="pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Added:</span> {formatDate(item.createdAt)}
                </div>
                {item.completedAt && (
                  <div>
                    <span className="font-medium">Completed:</span> {formatDate(item.completedAt)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div className="flex items-center space-x-2">
              {item.status === 'want_to_try' && (
                <button
                  onClick={handleMarkComplete}
                  disabled={loading === 'complete'}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckIcon className="h-4 w-4" />
                  <span>{loading === 'complete' ? 'Marking...' : 'Mark Complete'}</span>
                </button>
              )}
              
              {item.status === 'completed' && (
                <button
                  onClick={() => setShowShareDialog(true)}
                  disabled={loading === 'share'}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <ShareIcon className="h-4 w-4" />
                  <span>Share</span>
                </button>
              )}

              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <PencilSquareIcon className="h-4 w-4" />
                <span>Edit</span>
              </button>
            </div>

            <button
              onClick={handleDelete}
              disabled={loading === 'delete'}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <TrashIcon className="h-4 w-4" />
              <span>{loading === 'delete' ? 'Deleting...' : 'Delete'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      {showShareDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Share Item</h3>
            
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