'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuthStore, useAppStore } from '@/lib/store';
import { createStructuredPost, createPersonalItem } from '@/lib/firestore';
import { UniversalItem, PersonalItem, Post } from '@/lib/types';
import { sendSMSInvite, shouldOfferSMSInvite } from '@/lib/utils';
import { BookOpenIcon, FilmIcon, MapPinIcon } from '@heroicons/react/24/outline';
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
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteData, setInviteData] = useState<{
    recommenderName: string;
    postTitle: string;
    postId: string;
    isPost: boolean;
  } | null>(null);
  
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

      let createdPostId: string | null = null;

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
        
        createdPostId = postId;

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
        createdPostId = await createPersonalItem(
          user.uid,
          universalItem.category,
          universalItem.title,
          undefined, // No description
          enhancedFields,
          undefined // No post linking for standalone personal items
        );

        const personalItem: PersonalItem = {
          id: createdPostId,
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
      
      // Check if we should offer SMS invite for non-user recommender
      console.log(`🔍 SMS Invite Debug:`, {
        recommendedBy: recommendedBy.trim(),
        shouldOffer: shouldOfferSMSInvite(recommendedBy.trim()),
        createdPostId,
        postToFeed
      });
      
      if (recommendedBy.trim() && shouldOfferSMSInvite(recommendedBy.trim())) {
        if (postToFeed && createdPostId) {
          // For shared posts, use the post ID
          console.log(`✅ Setting up SMS invite for shared post: ${createdPostId}`);
          setInviteData({
            recommenderName: recommendedBy.trim(),
            postTitle: universalItem.title,
            postId: createdPostId,
            isPost: true
          });
          setShowInviteDialog(true);
          // Don't call onSuccess() yet - wait for invite dialog to be handled
          return;
        } else if (!postToFeed) {
          // For private items, use the personal item ID
          console.log(`✅ Setting up SMS invite for private item: ${createdPostId}`);
          setInviteData({
            recommenderName: recommendedBy.trim(),
            postTitle: universalItem.title,
            postId: createdPostId,
            isPost: false
          });
          setShowInviteDialog(true);
          // Don't call onSuccess() yet - wait for invite dialog to be handled
          return;
        } else {
          console.log(`❌ SMS Invite: postToFeed=true but no createdPostId`);
        }
      }
      
      // Only call onSuccess if no invite dialog was shown
      onSuccess();
    } catch (error) {
      console.error('Error creating structured post:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // SMS invite handlers
  const handleSendInvite = () => {
    if (inviteData && userProfile) {
      sendSMSInvite(
        inviteData.recommenderName,
        userProfile.name,
        inviteData.postTitle,
        inviteData.postId,
        inviteData.isPost
      );
      setShowInviteDialog(false);
      setInviteData(null);
      onSuccess(); // Complete the flow after sending invite
    }
  };

  const handleSkipInvite = () => {
    setShowInviteDialog(false);
    setInviteData(null);
    onSuccess(); // Complete the flow after skipping invite
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
                  ) : universalItem.category === 'movies' ? (
                    <FilmIcon className="h-8 w-8 text-gray-400" />
                  ) : (
                    <MapPinIcon className="h-8 w-8 text-gray-400" />
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
              {universalItem.metadata.address && (
                <p className="text-sm text-gray-600 mb-1">
                  📍 {universalItem.metadata.address}
                </p>
              )}
              {(universalItem.metadata.rating || universalItem.metadata.priceLevel) && (
                <div className="flex items-center space-x-3 text-sm text-gray-600 mb-1">
                  {universalItem.metadata.rating && (
                    <span>⭐ {universalItem.metadata.rating}/5</span>
                  )}
                  {universalItem.metadata.priceLevel && (
                    <span className="text-green-600 font-medium">
                      {'$'.repeat(universalItem.metadata.priceLevel)}
                    </span>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-500">
                {universalItem.category === 'books' ? '📚 Books • Auto-filled from Google Books' : 
                 universalItem.category === 'movies' ? '🎬 Movies/TV • Auto-filled from TMDb' : 
                 '📍 Places • Auto-filled from Google Places'}
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
                onClick={() => setStatus('want_to_try')}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  status === 'want_to_try'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="font-medium">📝 To Do</div>
              </button>
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

      {/* SMS Invite Dialog */}
      {showInviteDialog && inviteData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📱</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Invite {inviteData.recommenderName}?
              </h3>
                             <p className="text-gray-600 text-sm">
                 Let {inviteData.recommenderName} know their recommendation for &ldquo;{inviteData.postTitle}&rdquo; is being shared on Rex!
               </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handleSendInvite}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Send Text Invite
              </button>
              <button
                onClick={handleSkipInvite}
                className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Skip for Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 