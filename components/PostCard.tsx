'use client';

import { useState } from 'react';
import { BookmarkIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { Post } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
import { toggleSavePost } from '@/lib/firestore';
import { useAuthStore, useAppStore } from '@/lib/store';

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const { toggleSavePost: toggleSaveInStore } = useAppStore();
  
  const category = CATEGORIES.find(c => c.id === post.category);
  const isSaved = user ? post.savedBy.includes(user.uid) : false;
  
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
      await toggleSavePost(post.id, user.uid, !isSaved);
      toggleSaveInStore(post.id, user.uid);
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
        
        <button
          onClick={handleSaveToggle}
          disabled={loading}
          className={`p-2 rounded-full transition-colors ${
            isSaved 
              ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isSaved ? (
            <BookmarkSolid className="h-5 w-5" />
          ) : (
            <BookmarkIcon className="h-5 w-5" />
          )}
        </button>
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

      {/* Footer */}
      {post.savedBy.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            {post.savedBy.length} {post.savedBy.length === 1 ? 'person has' : 'people have'} saved this
          </p>
        </div>
      )}
    </div>
  );
} 