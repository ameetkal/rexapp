'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Thing, UserThingInteraction } from '@/lib/types';
import { createUserThingInteraction, createRecommendation } from '@/lib/firestore';
import { getUserProfile } from '@/lib/auth';
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
  onUserClick?: (userId: string) => void; // For navigating to user profiles
}

export default function InteractionDetailModal({
  interaction,
  thing,
  myInteraction,
  isOwnInteraction,
  onClose,
  onEdit,
  onUserClick
}: InteractionDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [tempRating, setTempRating] = useState(0);
  const [experiencedWithNames, setExperiencedWithNames] = useState<string[]>([]);
  const [displayUserName, setDisplayUserName] = useState<string>('');
  
  const { user, userProfile } = useAuthStore();
  const { addUserInteraction } = useAppStore();
  
  // Load user name if missing and tagged user names
  useState(() => {
    const loadUserData = async () => {
      // Load display user name if missing
      if (!interaction.userName && interaction.userId) {
        const profile = await getUserProfile(interaction.userId);
        setDisplayUserName(profile?.name || 'Unknown User');
      } else {
        setDisplayUserName(interaction.userName);
      }
      
      // Load names of tagged users
      if (!interaction.experiencedWith || interaction.experiencedWith.length === 0) {
        return;
      }
      
      const names = await Promise.all(
        interaction.experiencedWith.map(async (userId) => {
          const profile = await getUserProfile(userId);
          return profile?.name || 'Unknown User';
        })
      );
      setExperiencedWithNames(names);
    };
    loadUserData();
  });
  
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
            {/* Compact Thing Info Card */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start space-x-4">
                {/* Small Thumbnail */}
                {thing.image && (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={thing.image}
                      alt={thing.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                
                    {/* Thing Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                        {thing.metadata?.year && (
                          <span>{thing.metadata.year}</span>
                        )}
                        {thing.metadata?.author && (
                          <span>by {thing.metadata.author}</span>
                        )}
                        {thing.metadata?.director && (
                          <span>dir. {thing.metadata.director}</span>
                        )}
                        {thing.metadata?.type && (
                          <span className="capitalize">{thing.metadata.type === 'tv' ? 'TV Show' : thing.metadata.type}</span>
                        )}
                        {/* Show clickable city/state for places */}
                        {thing.metadata?.address && (
                          <a 
                            href={`https://maps.google.com/maps?q=${encodeURIComponent(thing.metadata.address)}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {(() => {
                              // Extract city and state from full address
                              const address = thing.metadata.address;
                              
                              // Split by commas and clean up
                              const parts = address.split(',').map(part => part.trim());
                              
                              if (parts.length >= 2) {
                                // Try to find city and state pattern
                                // Look for the last two parts that aren't just numbers or countries
                                let city = '';
                                let state = '';
                                
                                for (let i = parts.length - 1; i >= 0; i--) {
                                  const part = parts[i];
                                  
                                  // Skip if it's just numbers or contains ZIP code pattern (5 digits or 5-4 digits)
                                  if (/^\d+$/.test(part) || /^\d{5}(-\d{4})?$/.test(part)) continue;
                                  
                                  // Skip if it's a country name (common patterns)
                                  if (/^(USA|United States|US)$/i.test(part)) continue;
                                  
                                  // Clean the part by removing ZIP codes if they're attached
                                  const cleanPart = part.replace(/\s+\d{5}(-\d{4})?$/, '').trim();
                                  
                                  // Skip if after cleaning, it's empty or just numbers
                                  if (!cleanPart || /^\d+$/.test(cleanPart)) continue;
                                  
                                  // If we don't have state yet, this could be it
                                  if (!state) {
                                    state = cleanPart;
                                  } else if (!city) {
                                    // This is likely the city
                                    city = cleanPart;
                                    break;
                                  }
                                }
                                
                                if (city && state) {
                                  return `${city}, ${state}`;
                                }
                              }
                              
                              // Fallback to full address if pattern doesn't match
                              return address;
                            })()}
                          </a>
                        )}
                        {/* Show place type for places */}
                        {thing.metadata?.placeType && (
                          <span className="capitalize text-gray-600">
                            {thing.metadata.placeType.replace('_', ' ')}
                          </span>
                        )}
                        {/* Show Google rating for places */}
                        {thing.metadata?.rating && (
                          <span className="text-gray-600">
                            ⭐ {thing.metadata.rating}/5
                          </span>
                        )}
                        {/* Show price level for places */}
                        {thing.metadata?.priceLevel && (
                          <span className="text-green-600 font-medium">
                            {'$'.repeat(thing.metadata.priceLevel)}
                          </span>
                        )}
                      </div>
                  
                  {/* Description with expand functionality */}
                  {thing.description && (
                    <div>
                      {thing.description.length > 100 ? (
                        <details className="group">
                          <summary className="text-sm text-gray-700 cursor-pointer hover:text-gray-900 list-none">
                            <span className="line-clamp-2 group-open:hidden">
                              {thing.description}
                            </span>
                            <span className="hidden group-open:block">
                              {thing.description}
                            </span>
                            <span className="text-blue-600 text-xs ml-1 group-open:hidden">...read more</span>
                          </summary>
                        </details>
                      ) : (
                        <p className="text-sm text-gray-700">
                          {thing.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Expandable Details Section - Only show if there's extra content */}
              {(() => {
                const hasExtraContent = thing.metadata && (
                  thing.metadata.genre || 
                  thing.metadata.runtime || 
                  thing.metadata.episodes || 
                  thing.metadata.seasons || 
                  thing.metadata.website ||
                  thing.metadata.phoneNumber
                );
                
                return hasExtraContent && (
                  <details className="mt-3">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 flex items-center">
                      <span>View all details</span>
                      <svg className="w-3 h-3 ml-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="mt-2 pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        {thing.metadata.genre && (
                          <div className="flex items-start space-x-2">
                            <span className="text-gray-500">Genre:</span>
                            <span className="text-gray-900">{Array.isArray(thing.metadata.genre) ? thing.metadata.genre.join(', ') : thing.metadata.genre}</span>
                          </div>
                        )}
                        {thing.metadata.runtime && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500">Runtime:</span>
                            <span className="text-gray-900">{thing.metadata.runtime}</span>
                          </div>
                        )}
                        {thing.metadata.episodes && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500">Episodes:</span>
                            <span className="text-gray-900">{thing.metadata.episodes}</span>
                          </div>
                        )}
                        {thing.metadata.seasons && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500">Seasons:</span>
                            <span className="text-gray-900">{thing.metadata.seasons}</span>
                          </div>
                        )}
                      {thing.metadata.website && (
                        <div className="flex items-start space-x-2">
                          <span className="text-gray-500">Website:</span>
                          <a href={thing.metadata.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                            {thing.metadata.website}
                          </a>
                        </div>
                      )}
                      {thing.metadata.phoneNumber && (
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500">📞</span>
                          <span className="text-gray-900">{thing.metadata.phoneNumber}</span>
                        </div>
                      )}
                      </div>
                    </div>
                  </details>
                );
              })()}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200"></div>

            {/* User's Review Card - All reviewer content integrated */}
            {(interaction.content || interaction.rating || interaction.photos || experiencedWithNames.length > 0) && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                {/* Review Header */}
                <div className="flex items-center justify-between mb-3">
                  {isOwnInteraction ? (
                    <span className="text-sm font-medium text-gray-900">You</span>
                  ) : (
                    <button
                      onClick={() => onUserClick?.(interaction.userId)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {displayUserName}
                    </button>
                  )}
                  {interaction.rating && interaction.rating > 0 && (
                    <div className="flex items-center space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className={`text-sm ${
                            i < interaction.rating! ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                        >
                          ★
                        </span>
                      ))}
                      <span className="ml-1 text-sm font-medium text-gray-700">
                        {interaction.rating}/5
                      </span>
                    </div>
                  )}
                </div>

                {/* Review Content */}
                {interaction.content && (
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">{interaction.content}</p>
                )}

                {/* Photo Thumbnails */}
                {interaction.photos && interaction.photos.length > 0 && (
                  <div className="flex space-x-2 mb-3">
                    {interaction.photos.map((photoUrl, index) => (
                      <div 
                        key={index} 
                        className="relative w-16 h-16 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          // TODO: Open photo in full size modal
                          window.open(photoUrl, '_blank');
                        }}
                      >
                        <Image
                          src={photoUrl}
                          alt={`Photo ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Experienced With Tags */}
                {experiencedWithNames.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-gray-500 mr-2">👥 Experienced with:</span>
                    {experiencedWithNames.map((name, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
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
              <button
                onClick={() => {
                  onClose();
                  onEdit?.();
                }}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Edit
              </button>
            ) : (
              <>
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
                    {/* Already completed - show edit button */}
                    <button
                      onClick={() => {
                        onClose();
                        onEdit?.();
                      }}
                      className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircleIcon className="h-5 w-5 inline mr-2 fill-current" />
                      Edit
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

