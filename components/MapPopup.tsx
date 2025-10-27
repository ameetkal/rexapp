'use client';

import { useState, useEffect, useRef } from 'react';
import { Thing, UserThingInteraction } from '@/lib/types';
import { createUserThingInteraction, deleteUserThingInteraction, createOrGetThing } from '@/lib/firestore';
import { useAuthStore, useAppStore } from '@/lib/store';
import { dataService } from '@/lib/dataService';
import { Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { XMarkIcon, BookmarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid, CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';
import StarRating from './StarRating';
import Image from 'next/image';

interface MapPopupProps {
  thing: Thing;
  position: { x: number; y: number };
  onClose: () => void;
  onSeeMore?: () => void;
  onThingCreated?: (thing: Thing) => void;
}

export default function MapPopup({ thing, position, onClose, onSeeMore, onThingCreated }: MapPopupProps) {
  const [loading, setLoading] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [tempRating, setTempRating] = useState(0);
  
  const popupRef = useRef<HTMLDivElement>(null);
  
  const { user, userProfile } = useAuthStore();
  const { getUserInteractionByThingId, addUserInteraction, updateUserInteraction, removeUserInteraction } = useAppStore();
  
  // Check if this is a preview thing (no ID means it hasn't been created yet)
  const isPreview = !thing.id || thing.id === '';
  
  // Get current user's interaction with this thing (skip if preview)
  const currentMyInteraction = !isPreview ? getUserInteractionByThingId(thing.id) : null;
  const isInBucketList = currentMyInteraction?.state === 'bucketList';
  const isCompleted = currentMyInteraction?.state === 'completed';
  
  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);
  
  // Handle Save/Unsave
  const handleSaveToggle = async () => {
    if (!user || !userProfile) return;
    
    setLoading(true);
    try {
      if (isInBucketList && currentMyInteraction) {
        // Remove from bucket list
        await deleteUserThingInteraction(currentMyInteraction.id);
        removeUserInteraction(currentMyInteraction.id);
        console.log('🗑️ Removed from bucket list');
      } else {
        // Add to bucket list
        let targetThingId = thing.id;
        
        // If preview thing, create the Thing first
        if (isPreview) {
          console.log('🔨 Creating Thing for preview:', thing.title);
          
          // Convert preview thing to UniversalItem format
          const previewThing = thing as Thing & { sourceId?: string; source?: string };
          const universalItem = {
            id: previewThing.sourceId || (previewThing.id || ''),
            title: thing.title,
            category: thing.category,
            description: thing.description,
            image: thing.image,
            metadata: thing.metadata || {},
            source: (previewThing.source || 'manual') as 'google_books' | 'tmdb' | 'google_places' | 'spotify' | 'manual',
          };
          
          targetThingId = await createOrGetThing(universalItem, user.uid);
          console.log('✅ Created Thing:', targetThingId);
        }
        
        const interactionId = await createUserThingInteraction(
          user.uid,
          userProfile.name,
          targetThingId,
          'bucketList',
          'friends'
        );
        
        const newInteraction: UserThingInteraction = {
          id: interactionId,
          userId: user.uid,
          userName: userProfile.name,
          thingId: targetThingId,
          state: 'bucketList',
          date: Timestamp.now(),
          visibility: 'friends',
          createdAt: Timestamp.now(),
          likedBy: [],
          commentCount: 0,
        };
        
        addUserInteraction(newInteraction);
        console.log('✅ Added to your bucket list');
        
        // If this was a preview, fetch the real thing and update the popup
        if (isPreview) {
          console.log('🔄 Preview thing converted, fetching real thing...');
          
          // Fetch the real thing data
          const { getThing } = await import('@/lib/firestore');
          const realThing = await getThing(targetThingId);
          
          if (realThing && onThingCreated) {
            console.log('✅ Got real thing, updating popup...');
            onThingCreated(realThing);
          }
        }
      }
      
      // Clear feed cache to ensure immediate UI update
      dataService.clearFeedCache(user.uid);
    } catch (error) {
      console.error('Error toggling save:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle Complete
  const handleCompleteToggle = () => {
    if (!user || !userProfile) return;
    
    if (isCompleted && currentMyInteraction) {
      // Already completed - just show rating modal to edit
      setShowRatingModal(true);
    } else {
      // Not completed yet - show rating modal
      setShowRatingModal(true);
    }
  };
  
  // Handle rating submission
  const handleRatingSubmit = async () => {
    if (!user || !userProfile) return;
    
    setLoading(true);
    try {
      const rating = tempRating > 0 ? tempRating : undefined;
      
      if (currentMyInteraction) {
        // Update existing interaction to completed
        const interactionRef = doc(db, 'user_thing_interactions', currentMyInteraction.id);
        await updateDoc(interactionRef, {
          state: 'completed',
          rating: rating || null,
          date: Timestamp.now()
        });
        
        // Update local store
        updateUserInteraction(currentMyInteraction.id, { 
          state: 'completed',
          rating,
          date: Timestamp.now()
        });
      } else {
        // Create new completed interaction (first time completing)
        let targetThingId = thing.id;
        
        // If preview thing, create the Thing first
        if (isPreview) {
          console.log('🔨 Creating Thing for preview (completed):', thing.title);
          
          const previewThing = thing as Thing & { sourceId?: string; source?: string };
          const universalItem = {
            id: previewThing.sourceId || (previewThing.id || ''),
            title: thing.title,
            category: thing.category,
            description: thing.description,
            image: thing.image,
            metadata: thing.metadata || {},
            source: (previewThing.source || 'manual') as 'google_books' | 'tmdb' | 'google_places' | 'spotify' | 'manual',
          };
          
          targetThingId = await createOrGetThing(universalItem, user.uid);
          console.log('✅ Created Thing:', targetThingId);
        }
        
        const interactionId = await createUserThingInteraction(
          user.uid,
          userProfile.name,
          targetThingId,
          'completed',
          'friends',
          { rating }
        );
        
        const newInteraction: UserThingInteraction = {
          id: interactionId,
          userId: user.uid,
          userName: userProfile.name,
          thingId: targetThingId,
          state: 'completed',
          date: Timestamp.now(),
          visibility: 'friends',
          rating,
          createdAt: Timestamp.now(),
          likedBy: [],
          commentCount: 0,
        };
        
        addUserInteraction(newInteraction);
        
        // If this was a preview, fetch the real thing and update the popup
        if (isPreview && onThingCreated) {
          const { getThing } = await import('@/lib/firestore');
          const realThing = await getThing(targetThingId);
          if (realThing) {
            onThingCreated(realThing);
          }
        }
      }
      
      console.log(`✅ Marked as completed${rating ? ` with ${rating}/5 rating` : ''}`);
      setShowRatingModal(false);
      setTempRating(0);
      
      // Clear feed cache
      dataService.clearFeedCache(user.uid);
    } catch (error) {
      console.error('Error marking as completed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Get category emoji
  const getCategoryEmoji = (category: string) => {
    const emojis: Record<string, string> = {
      places: '📍',
      books: '📚',
      movies: '🎬',
      music: '🎵',
      other: '📝'
    };
    return emojis[category] || '📝';
  };
  
  return (
    <>
      <div
        ref={popupRef}
        className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-[280px] max-w-[320px] relative z-[999]"
        style={{
          position: 'fixed',
          top: `${position.y}px`,
          left: `${position.x}px`,
          transform: 'translate(-50%, -100%)',
        }}
      >
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
        
        {/* Content */}
        <div className="pr-6">
          {/* Title */}
          <h3 className="font-semibold text-gray-900 mb-1">{thing.title}</h3>
          
          {/* Category */}
          <p className="text-sm text-gray-500 capitalize mb-2 flex items-center gap-1">
            <span>{getCategoryEmoji(thing.category)}</span>
            {thing.category}
          </p>
          
          {/* Image */}
          {thing.image && (
            <div className="relative w-full h-32 mb-3 rounded-lg overflow-hidden">
              <Image
                src={thing.image}
                alt={thing.title}
                fill
                className="object-cover"
              />
            </div>
          )}
          
          {/* Description */}
          {thing.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{thing.description}</p>
          )}
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSaveToggle();
            }}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              isInBucketList
                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {isInBucketList ? (
              <BookmarkIconSolid className="h-5 w-5" />
            ) : (
              <BookmarkIcon className="h-5 w-5" />
            )}
            <span className="text-sm font-medium">Save</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCompleteToggle();
            }}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              isCompleted
                ? 'bg-green-50 text-green-600 hover:bg-green-100'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {isCompleted ? (
              <CheckCircleIconSolid className="h-5 w-5" />
            ) : (
              <CheckCircleIcon className="h-5 w-5" />
            )}
            <span className="text-sm font-medium">Complete</span>
          </button>
        </div>
        
        {/* See More Button */}
        {onSeeMore && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSeeMore();
            }}
            className="w-full mt-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
          >
            See More →
          </button>
        )}
      </div>
      
      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Rate this</h3>
            
            <div className="mb-4">
              <StarRating
                rating={tempRating}
                onRatingChange={setTempRating}
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowRatingModal(false);
                  setTempRating(0);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRatingSubmit()}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

