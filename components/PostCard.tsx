'use client';

import { useState, useEffect } from 'react';
import { BookmarkIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { Post, PersonalItem } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
import { savePostAsPersonalItem, unsavePersonalItem, getPersonalItemByPostId } from '@/lib/firestore';
import { Timestamp } from 'firebase/firestore';
import { useAuthStore, useAppStore } from '@/lib/store';
import EditModal from './EditModal';

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const [loading, setLoading] = useState(false);
  const [savedPersonalItem, setSavedPersonalItem] = useState<PersonalItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const { user } = useAuthStore();
  const { addPersonalItem, removePersonalItem, personalItems } = useAppStore();
  
  const category = CATEGORIES.find(c => c.id === post.category);
  const isSaved = !!savedPersonalItem;

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
            {post.authorName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{post.authorName}</p>
            <p className="text-sm text-gray-500">{formatDate(post.createdAt)}</p>
          </div>
        </div>
        
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
          
          {/* Save button */}
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
        </div>
      </div>

      {/* Category Badge */}
      <div className="flex items-center space-x-2 mb-3">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <span className="mr-1">{category?.emoji}</span>
          {category?.name}
        </span>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 leading-tight">
          {post.title}
        </h3>
        <p className="text-gray-600 leading-relaxed">
          {post.description}
        </p>
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