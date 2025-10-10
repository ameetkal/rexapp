'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Thing, UserThingInteraction } from '@/lib/types';
import { createUserThingInteraction, createRecommendation } from '@/lib/firestore';
import { useAuthStore, useAppStore } from '@/lib/store';
import { CATEGORIES } from '@/lib/types';
import { XMarkIcon, BookmarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import StarRating from './StarRating';

interface InteractionDetailModalProps {
  interaction: UserThingInteraction; // The interaction being displayed (could be anyone's)
  thing: Thing;
  myInteraction?: UserThingInteraction; // Current user's interaction with this thing
  isOwnInteraction: boolean;
  onClose: () => void;
  onEdit?: () => void; // Only available for own interactions
}

export default function InteractionDetailModal({
  interaction,
  thing,
  myInteraction,
  isOwnInteraction,
  onClose,
  onEdit
}: InteractionDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [tempRating, setTempRating] = useState(0);
  
  const { user, userProfile } = useAuthStore();
  const { addUserInteraction } = useAppStore();
  
  const category = CATEGORIES.find(c => c.id === thing.category);
  
  // Check current user's state with this thing
  const isInBucketList = myInteraction?.state === 'bucketList';
  const isCompleted = myInteraction?.state === 'completed';
  const hasInteraction = !!myInteraction;

  const handleSave = async () => {
    if (!user || !userProfile) return;
    
    setLoading(true);
    try {
      const newInteraction: UserThingInteraction = {
        id: '',
        userId: user.uid,
        userName: userProfile.name,
        thingId: thing.id,
        state: 'bucketList',
        date: interaction.createdAt,
        visibility: 'public',
        createdAt: interaction.createdAt,
        likedBy: [],
        commentCount: 0,
      };
      
      const interactionId = await createUserThingInteraction(
        user.uid,
        userProfile.name,
        thing.id,
        'bucketList',
        'public' // Default to public
      );
      
      newInteraction.id = interactionId;
      addUserInteraction(newInteraction);
      
      // Create recommendation
      if (interaction.userId !== user.uid) {
        await createRecommendation(
          interaction.userId,
          user.uid,
          thing.id,
          'Saved from detail view'
        );
      }
      
      console.log('✅ Added to bucket list');
      onClose();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    setShowRatingModal(true);
  };

  const handleRatingSubmit = async (skipRating = false) => {
    if (!user || !userProfile) return;
    
    setLoading(true);
    try {
      const rating = skipRating ? undefined : (tempRating > 0 ? tempRating : undefined);
      
      const newInteraction: UserThingInteraction = {
        id: '',
        userId: user.uid,
        userName: userProfile.name,
        thingId: thing.id,
        state: 'completed',
        date: interaction.createdAt,
        visibility: 'public',
        rating,
        createdAt: interaction.createdAt,
        likedBy: [],
        commentCount: 0,
      };
      
      await createUserThingInteraction(
        user.uid,
        userProfile.name,
        thing.id,
        'completed',
        'public', // Default to public
        { rating }
      );
      
      addUserInteraction(newInteraction);
      
      console.log('✅ Marked as completed');
      setShowRatingModal(false);
      onClose();
    } catch (error) {
      console.error('Error completing:', error);
      alert('Failed to mark as completed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Main Detail Modal */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">{category?.emoji}</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{thing.title}</h2>
                <p className="text-sm text-gray-500">{category?.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <XMarkIcon className="h-6 w-6 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6">
            {/* Thing Preview (if has image) */}
            {thing.image && (
              <div className="relative w-full h-64 rounded-lg overflow-hidden">
                <Image
                  src={thing.image}
                  alt={thing.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            {/* Thing Description */}
            {thing.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">About</h3>
                <p className="text-gray-700 leading-relaxed">{thing.description}</p>
              </div>
            )}

            {/* Thing Metadata */}
            {thing.metadata && Object.keys(thing.metadata).length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {thing.metadata.author && (
                    <div>
                      <span className="text-gray-500">Author:</span>
                      <span className="ml-2 text-gray-900">{thing.metadata.author}</span>
                    </div>
                  )}
                  {thing.metadata.director && (
                    <div>
                      <span className="text-gray-500">Director:</span>
                      <span className="ml-2 text-gray-900">{thing.metadata.director}</span>
                    </div>
                  )}
                  {thing.metadata.year && (
                    <div>
                      <span className="text-gray-500">Year:</span>
                      <span className="ml-2 text-gray-900">{thing.metadata.year}</span>
                    </div>
                  )}
                  {thing.metadata.type && (
                    <div>
                      <span className="text-gray-500">Type:</span>
                      <span className="ml-2 text-gray-900">{thing.metadata.type === 'tv' ? 'TV Show' : 'Movie'}</span>
                    </div>
                  )}
                  {thing.metadata.address && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Address:</span>
                      <span className="ml-2 text-gray-900">{thing.metadata.address}</span>
                    </div>
                  )}
                  {thing.metadata.rating && (
                    <div>
                      <span className="text-gray-500">Google Rating:</span>
                      <span className="ml-2 text-gray-900">⭐ {thing.metadata.rating}/5</span>
                    </div>
                  )}
                  {thing.metadata.priceLevel && (
                    <div>
                      <span className="text-gray-500">Price:</span>
                      <span className="ml-2 text-green-600 font-medium">{'$'.repeat(thing.metadata.priceLevel)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-gray-200"></div>

            {/* User's State Badge */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                {isOwnInteraction ? 'Your Status' : `${interaction.userName}'s Status`}
              </h3>
              <div className="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                {interaction.state === 'bucketList' && <><BookmarkIcon className="h-4 w-4 mr-1" /> Bucket List</>}
                {interaction.state === 'inProgress' && <>🏃 In Progress</>}
                {interaction.state === 'completed' && <><CheckCircleIcon className="h-4 w-4 mr-1" /> Completed</>}
              </div>
            </div>

            {/* User's Rating */}
            {interaction.rating && interaction.rating > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {isOwnInteraction ? 'Your Rating' : 'Rating'}
                </h3>
                <div className="flex items-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <span
                      key={i}
                      className={`text-2xl ${
                        i < interaction.rating! ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                    >
                      ★
                    </span>
                  ))}
                  <span className="ml-3 text-lg font-medium text-gray-700">
                    {interaction.rating}/5
                  </span>
                </div>
              </div>
            )}

            {/* User's Comments */}
            {interaction.content && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {isOwnInteraction ? 'Your Comments' : 'Comments'}
                </h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{interaction.content}</p>
              </div>
            )}

            {/* User's Photos */}
            {interaction.photos && interaction.photos.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Photos</h3>
                <div className="grid grid-cols-2 gap-3">
                  {interaction.photos.map((photoUrl, index) => (
                    <div key={index} className="relative w-full h-48 rounded-lg overflow-hidden">
                      <Image
                        src={photoUrl}
                        alt={`Photo ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Private Notes (only show for own interactions) */}
            {isOwnInteraction && interaction.notes && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="text-sm font-medium text-yellow-700 mb-2">🔒 Your Private Notes</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{interaction.notes}</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
            {isOwnInteraction ? (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onEdit?.();
                  }}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                
                {/* Show appropriate actions based on user's current state */}
                {!hasInteraction ? (
                  <>
                    {/* Not saved yet - show both options */}
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <BookmarkIcon className="h-5 w-5 inline mr-2" />
                      Save to List
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={loading}
                      className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircleIcon className="h-5 w-5 inline mr-2" />
                      Complete
                    </button>
                  </>
                ) : isInBucketList ? (
                  <>
                    {/* Already in bucket list - show it's saved and offer complete */}
                    <button
                      disabled
                      className="flex-1 py-3 px-4 bg-blue-100 text-blue-700 rounded-lg cursor-not-allowed"
                    >
                      <BookmarkIcon className="h-5 w-5 inline mr-2 fill-current" />
                      Saved
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={loading}
                      className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircleIcon className="h-5 w-5 inline mr-2" />
                      Mark Complete
                    </button>
                  </>
                ) : isCompleted ? (
                  <>
                    {/* Already completed - show it's done */}
                    <button
                      disabled
                      className="flex-1 py-3 px-4 bg-green-100 text-green-700 rounded-lg cursor-not-allowed"
                    >
                      <CheckCircleIcon className="h-5 w-5 inline mr-2 fill-current" />
                      Completed
                    </button>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Rating Modal (for completing from detail view) */}
      {showRatingModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowRatingModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Rate {thing.title}</h3>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-4">How would you rate it?</p>
              <div className="flex justify-center">
                <StarRating 
                  rating={tempRating} 
                  onRatingChange={setTempRating}
                  maxRating={5}
                  showLabel={true}
                  size="lg"
                />
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => handleRatingSubmit(true)}
                disabled={loading}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Skip Rating
              </button>
              <button
                onClick={() => handleRatingSubmit(false)}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : tempRating > 0 ? 'Submit Rating' : 'Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

