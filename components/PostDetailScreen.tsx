'use client';

import { useState, useEffect } from 'react';
import { useAuthStore, useAppStore } from '@/lib/store';
import { Post, PersonalItem, CATEGORIES } from '@/lib/types';
import { ArrowLeftIcon, BookmarkIcon, PencilSquareIcon, EyeSlashIcon, ShareIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { savePostAsPersonalItem, unsavePersonalItem, getPersonalItemByPostId, unsharePost } from '@/lib/firestore';
import { Timestamp } from 'firebase/firestore';
import StarRating from './StarRating';
import EditModal from './EditModal';

interface PostDetailScreenProps {
  post: Post;
  onBack: () => void;
  onUserProfileClick?: (authorId: string) => void;
  backButtonText?: string;
}

export default function PostDetailScreen({ post, onBack, onUserProfileClick, backButtonText = "Back to Feed" }: PostDetailScreenProps) {
  const [loading, setLoading] = useState(false);
  const [unshareLoading, setUnshareLoading] = useState(false);
  const [savedPersonalItem, setSavedPersonalItem] = useState<PersonalItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const { user } = useAuthStore();
  const { addPersonalItem, removePersonalItem, personalItems, updatePersonalItem, removePost } = useAppStore();
  
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

  const handleUnshare = async () => {
    if (!user || !savedPersonalItem || post.authorId !== user.uid) return;

    if (!confirm('Remove this post from the feed? You\'ll keep it in your personal list as "Completed".')) {
      return;
    }

    setUnshareLoading(true);
    try {
      await unsharePost(post.id, savedPersonalItem.id);
      
      updatePersonalItem(savedPersonalItem.id, { 
        status: 'completed',
        sharedPostId: undefined 
      });
      
      removePost(post.id);
      onBack(); // Navigate back since post is removed
    } catch (error) {
      console.error('Error unsharing post:', error);
      alert('Failed to unshare post. Please try again.');
    } finally {
      setUnshareLoading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share && window.location.href) {
      try {
        await navigator.share({
          title: post.title,
          text: `Check out this recommendation: ${post.title}`,
          url: window.location.href,
        });
      } catch {
        // Fallback to clipboard
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white min-h-screen">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
                      <button
              onClick={onBack}
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span>{backButtonText}</span>
            </button>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleShare}
              className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
              title="Share post"
            >
              <ShareIcon className="h-5 w-5" />
            </button>

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
            
            {/* Unshare button */}
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
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Author Section */}
        <div className="flex items-center justify-between">
          {onUserProfileClick && user && post.authorId !== user.uid ? (
            <button
              onClick={() => onUserProfileClick(post.authorId)}
              className="flex items-center space-x-4 hover:opacity-75 transition-opacity text-left"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xl">
                {post.authorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-xl text-gray-900">{post.authorName}</p>
                <p className="text-gray-500">{formatDate(post.createdAt)}</p>
              </div>
            </button>
          ) : (
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xl">
                {post.authorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-xl text-gray-900">{post.authorName}</p>
                <p className="text-gray-500">{formatDate(post.createdAt)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Category and Status */}
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            <span className="mr-2">{category?.emoji}</span>
            {category?.name}
          </span>
          
          {savedPersonalItem && (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              savedPersonalItem.status === 'want_to_try' 
                ? 'bg-blue-100 text-blue-800' 
                : savedPersonalItem.status === 'completed'
                ? 'bg-green-100 text-green-800'
                : 'bg-purple-100 text-purple-800'
            }`}>
              {savedPersonalItem.status === 'want_to_try' && '📖 Want to Try'}
              {savedPersonalItem.status === 'completed' && '✅ Completed'}
              {savedPersonalItem.status === 'shared' && '✅ Completed'}
            </span>
          )}
        </div>

        {/* Title and Description */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">
            {post.title}
          </h1>
          <p className="text-lg text-gray-700 leading-relaxed">
            {post.description}
          </p>
          {post.recommendedBy && (
            <p className="text-gray-600">
              🤝 Recommended by <span className="font-medium">{post.recommendedBy}</span>
            </p>
          )}
        </div>

        {/* Photos */}
        {post.photos && post.photos.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">📸 Photos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {post.photos.map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-64 object-cover rounded-lg shadow-md"
                />
              ))}
            </div>
          </div>
        )}

        {/* Universal Item Details */}
        {post.universalItem && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">📋 Details</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              {post.universalItem.image && (
                <img
                  src={post.universalItem.image}
                  alt={post.universalItem.title}
                  className="w-32 h-48 object-cover rounded-lg mx-auto"
                />
              )}
              
              {/* Book details */}
              {post.universalItem.metadata.author && (
                <p><span className="font-medium">Author:</span> {post.universalItem.metadata.author}</p>
              )}
              {post.universalItem.metadata.publishedDate && (
                <p><span className="font-medium">Published:</span> {post.universalItem.metadata.publishedDate}</p>
              )}
              {post.universalItem.metadata.pageCount && (
                <p><span className="font-medium">Pages:</span> {post.universalItem.metadata.pageCount}</p>
              )}
              
              {/* Movie details */}
              {post.universalItem.metadata.director && (
                <p><span className="font-medium">Director:</span> {post.universalItem.metadata.director}</p>
              )}
              {post.universalItem.metadata.year && (
                <p><span className="font-medium">Year:</span> {post.universalItem.metadata.year}</p>
              )}
              {post.universalItem.metadata.tmdbRating && (
                <p><span className="font-medium">TMDB Rating:</span> {post.universalItem.metadata.tmdbRating}/10</p>
              )}
              
              {/* Place details */}
              {post.universalItem.metadata.address && (
                <p><span className="font-medium">Address:</span> {post.universalItem.metadata.address}</p>
              )}
              {post.universalItem.metadata.phoneNumber && (
                <p><span className="font-medium">Phone:</span> {post.universalItem.metadata.phoneNumber}</p>
              )}
              {post.universalItem.metadata.website && (
                <p><span className="font-medium">Website:</span> 
                  <a href={post.universalItem.metadata.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                    {post.universalItem.metadata.website}
                  </a>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Enhanced Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rating */}
          {post.rating && post.rating > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">⭐ Rating</h4>
              <div className="flex items-center space-x-3">
                <StarRating rating={post.rating} maxRating={10} size="lg" onRatingChange={() => {}} />
                <span className="text-xl font-semibold text-gray-700">({post.rating}/10)</span>
              </div>
            </div>
          )}

          {/* Location */}
          {post.location && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">📍 Location</h4>
              <p className="text-gray-700">{post.location}</p>
            </div>
          )}

          {/* Price */}
          {(post.priceRange || (post.customPrice && post.customPrice > 0)) && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">💰 Price</h4>
              <p className="text-gray-700">
                {post.priceRange && post.priceRange}
                {post.customPrice && post.customPrice > 0 && ` ($${post.customPrice})`}
              </p>
            </div>
          )}

          {/* Experience Date */}
          {post.experienceDate && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">📅 Experience Date</h4>
              <p className="text-gray-700">{formatExperienceDate(post.experienceDate)}</p>
            </div>
          )}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">🏷️ Tags</h3>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tagged People */}
        {((post.taggedUsers && post.taggedUsers.length > 0) || (post.taggedNonUsers && post.taggedNonUsers.length > 0)) && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">👥 Experienced With</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              {post.taggedUsers && post.taggedUsers.length > 0 && (
                <p className="text-gray-700 mb-2">
                  <span className="font-medium">{post.taggedUsers.length} friend{post.taggedUsers.length > 1 ? 's' : ''}</span>
                </p>
              )}
              {post.taggedNonUsers && post.taggedNonUsers.length > 0 && (
                <div className="space-y-1">
                  {post.taggedNonUsers.map((user, index) => (
                    <p key={index} className="text-gray-700">
                      <span className="font-medium">{user.name}</span>
                      {user.email && <span className="text-gray-500 ml-2">({user.email})</span>}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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