'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuthStore, useAppStore } from '@/lib/store';
import { createStructuredPost, createPersonalItem } from '@/lib/firestore';
import { UniversalItem, PersonalItem, Post } from '@/lib/types';
import { BookOpenIcon, FilmIcon } from '@heroicons/react/24/outline';
import { Timestamp } from 'firebase/firestore';
import StarRating from './StarRating';

interface StructuredPostFormProps {
  universalItem: UniversalItem;
  onBack: () => void;
  onSuccess: () => void;
}

export default function StructuredPostForm({ 
  universalItem, 
  onBack, 
  onSuccess 
}: StructuredPostFormProps) {
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<'completed' | 'want_to_try'>('want_to_try');
  const [postToFeed, setPostToFeed] = useState(true);
  const [recommendedBy, setRecommendedBy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const { user, userProfile } = useAuthStore();
  const { addPost, addPersonalItem } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;

    setSubmitting(true);
    try {
      const enhancedFields = {
        rating: rating > 0 ? rating : undefined,
        recommendedBy: recommendedBy.trim() || undefined,
      };

      if (postToFeed) {
        // Create both post and personal item
        const { postId, personalItemId } = await createStructuredPost(
          user.uid,
          userProfile.name,
          universalItem,
          status,
          undefined, // No description in simplified flow
          enhancedFields
        );

        // Add post to store
        const newPost: Post = {
          id: postId,
          authorId: user.uid,
          authorName: userProfile.name,
          category: universalItem.category,
          title: universalItem.title,
          description: universalItem.description || '',
          createdAt: Timestamp.now(),
          savedBy: [],
          universalItem,
          postType: 'structured',
          ...enhancedFields,
        };
        addPost(newPost);

        // Add personal item to store
        const personalItem: PersonalItem = {
          id: personalItemId,
          userId: user.uid,
          category: universalItem.category,
          title: universalItem.title,
          description: universalItem.description || '',
          status: status === 'completed' ? 'shared' : 'want_to_try',
          createdAt: Timestamp.now(),
          source: 'personal',
          ...(status === 'completed' && { sharedPostId: postId, completedAt: Timestamp.now() }),
          ...enhancedFields,
        };
        addPersonalItem(personalItem);
      } else {
        // Only create personal item
        const personalItemId = await createPersonalItem(
          user.uid,
          universalItem.category,
          universalItem.title,
          undefined, // No description
          enhancedFields,
          undefined // No post linking for standalone personal items
        );

        const personalItem: PersonalItem = {
          id: personalItemId,
          userId: user.uid,
          category: universalItem.category,
          title: universalItem.title,
          description: universalItem.description || '',
          status: status,
          createdAt: Timestamp.now(),
          source: 'personal',
          ...(status === 'completed' && { completedAt: Timestamp.now() }),
          ...enhancedFields,
        };
        addPersonalItem(personalItem);
      }
      
      console.log(`✅ Successfully ${postToFeed ? 'posted and added' : 'added'} "${universalItem.title}" to list`);
      onSuccess();
    } catch (error) {
      console.error('Error creating structured post:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="mr-4 text-gray-600 hover:text-gray-800"
          >
            ← Back
          </button>
          <h2 className="text-xl font-bold text-gray-900">Add to Your List</h2>
        </div>

        {/* Selected Item Preview */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex space-x-4">
            <div className="flex-shrink-0">
              {universalItem.image ? (
                <Image
                  src={universalItem.image}
                  alt={universalItem.title}
                  width={64}
                  height={80}
                  className="w-16 h-20 object-cover rounded"
                />
              ) : (
                <div className="w-16 h-20 bg-gray-200 rounded flex items-center justify-center">
                  {universalItem.category === 'books' ? (
                    <BookOpenIcon className="h-8 w-8 text-gray-400" />
                  ) : (
                    <FilmIcon className="h-8 w-8 text-gray-400" />
                  )}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                {universalItem.title}
              </h3>
              {universalItem.metadata.author && (
                <p className="text-sm text-gray-600 mb-1">
                  by {universalItem.metadata.author}
                </p>
              )}
              {universalItem.metadata.year && (
                <p className="text-sm text-gray-600 mb-1">
                  {universalItem.metadata.year}
                  {universalItem.metadata.type && (
                    <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded-full">
                      {universalItem.metadata.type === 'tv' ? '📺 TV Show' : '🎬 Movie'}
                    </span>
                  )}
                </p>
              )}
              <div className="text-xs text-gray-500">
                {universalItem.category === 'books' ? '📚 Books • Auto-filled from Google Books' : '🎬 Movies/TV • Auto-filled from TMDb'}
              </div>
            </div>
          </div>
        </div>

        {/* Post Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Status Selection */}
          <div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('completed')}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  status === 'completed'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="font-medium">✅ Completed</div>
              </button>
              <button
                type="button"
                onClick={() => setStatus('want_to_try')}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  status === 'want_to_try'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="font-medium">📝 To Do</div>
              </button>
            </div>
          </div>

          {/* Rating (only for completed) */}
          {status === 'completed' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                How would you rate it? (optional)
              </label>
              <StarRating rating={rating} onRatingChange={setRating} />
            </div>
          )}

          {/* Recommended By */}
          <div>
            <label htmlFor="recommendedBy" className="block text-sm font-medium text-gray-700 mb-2">
              🤝 Recommended by <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              id="recommendedBy"
              placeholder="Who recommended this to you?"
              value={recommendedBy}
              onChange={(e) => setRecommendedBy(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
            />
          </div>

          {/* Share Settings */}
          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={postToFeed}
                onChange={(e) => setPostToFeed(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Share with friends on the feed
              </span>
            </label>
          </div>

          {/* Submit Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Adding...' : 
               postToFeed ? (status === 'completed' ? 'Add & Share' : 'Add & Share') : 'Add to List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 