'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Thing, UserThingInteraction } from '@/lib/types';
import { deleteUserThingInteraction, createInvitation } from '@/lib/firestore';
import { useAuthStore, useAppStore } from '@/lib/store';
import { CATEGORIES } from '@/lib/types';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  BookmarkIcon, 
  CheckCircleIcon,
  EllipsisVerticalIcon
} from '@heroicons/react/24/outline';
import { 
  BookmarkIcon as BookmarkIconSolid, 
  CheckCircleIcon as CheckCircleIconSolid
} from '@heroicons/react/24/solid';
import InteractionDetailModal from './InteractionDetailModal';
import StarRating from './StarRating';
import { useUserInteraction } from '@/lib/hooks';

interface ThingInteractionCardProps {
  thing: Thing;
  interaction: UserThingInteraction;
  onThingClick?: (thingId: string) => void;
  onEdit?: (interaction: UserThingInteraction, thing: Thing) => void;
}

export default function ThingInteractionCard({ 
  thing, 
  interaction,
  onEdit
}: ThingInteractionCardProps) {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [tempRating, setTempRating] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const { user, userProfile } = useAuthStore();
  const { removeUserInteraction, updateUserInteraction } = useAppStore();
  
  // Use our new hook to get the most up-to-date interaction data
  const { interaction: currentInteraction } = useUserInteraction(thing.id);
  
  // Use the current interaction from store, or fall back to prop
  const displayInteraction = currentInteraction || interaction;
  
  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);
  
  const category = CATEGORIES.find(c => c.id === thing.category);
  
  const handleStateChange = async (newState: 'bucketList' | 'inProgress' | 'completed') => {
    if (!user || newState === displayInteraction.state) return;
    
    // If marking as completed, show rating modal first
    if (newState === 'completed') {
      setShowRatingModal(true);
      return;
    }
    
    setLoading(true);
    try {
      // Update the existing interaction's state (don't delete/recreate)
      const interactionRef = doc(db, 'user_thing_interactions', displayInteraction.id);
      await updateDoc(interactionRef, {
        state: newState,
        date: Timestamp.now()
      });
      
      // Update local store
      updateUserInteraction(displayInteraction.id, { 
        state: newState,
        date: Timestamp.now()
      });
      
      console.log('🔄 ThingInteractionCard: Updated store for interaction', {
        interactionId: displayInteraction.id,
        newState,
        thingId: thing.id
      });
      
      console.log(`✅ Changed state to: ${newState}`);
      
      // No reload needed - state updated in store
    } catch (error) {
      console.error('Error changing state:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRatingSubmit = async (skipRating = false) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const rating = skipRating ? undefined : (tempRating > 0 ? tempRating : undefined);
      
      // Update to completed with rating
      const interactionRef = doc(db, 'user_thing_interactions', displayInteraction.id);
      await updateDoc(interactionRef, {
        state: 'completed',
        rating: rating || null,
        date: Timestamp.now()
      });
      
      // Update local store
      updateUserInteraction(displayInteraction.id, { 
        state: 'completed',
        rating,
        date: Timestamp.now()
      });
      
      console.log(`✅ Marked as completed${rating ? ` with ${rating}/5 rating` : ''}`);
      setShowRatingModal(false);
      setTempRating(0);
    } catch (error) {
      console.error('Error marking as completed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setShowMenu(false);
    if (onEdit) {
      onEdit(interaction, thing);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    
    if (!confirm(`Are you sure you want to delete "${thing.title}" from your list? This cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    try {
      await deleteUserThingInteraction(interaction.id);
      removeUserInteraction(interaction.id);
      console.log('🗑️ Deleted from list');
      window.location.reload();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePostToFeed = async () => {
    if (!user) return;
    
    const newVisibility = displayInteraction.visibility === 'public' ? 'private' : 'public';
    
    setShowMenu(false);
    setLoading(true);
    
    try {
      console.log(`🔄 Toggling visibility from ${displayInteraction.visibility} to ${newVisibility}`);
      
      const interactionRef = doc(db, 'user_thing_interactions', interaction.id);
      await updateDoc(interactionRef, {
        visibility: newVisibility
      });
      
      updateUserInteraction(interaction.id, { visibility: newVisibility });
      
      console.log(`✅ Visibility changed to: ${newVisibility}`);
    } catch (error) {
      console.error('❌ Error toggling visibility:', error);
      alert(`Failed to change visibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!user || !userProfile) return;
    
    setShowMenu(false);
    setLoading(true);
    
    try {
      // Create invitation code
      const inviteCode = await createInvitation(
        user.uid,
        userProfile.name,
        userProfile.username,
        thing.id,
        thing.title,
        interaction.id
      );
      
      const inviteUrl = `${window.location.origin}/?i=${inviteCode}`;
      
      if (navigator.share) {
        await navigator.share({
          title: `Check out ${thing.title} on Rex`,
          text: `I thought you might like "${thing.title}"! Check it out on Rex:`,
          url: inviteUrl
        }).catch(err => {
          // User cancelled share, ignore
          if (err.name !== 'AbortError') {
            console.error('Share failed:', err);
          }
        });
      } else {
        // Fallback to copying URL
        await navigator.clipboard.writeText(inviteUrl);
        alert('Invite link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error creating invite:', error);
      alert('Failed to create invite link');
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = () => {
    setShowDetailModal(true);
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{category?.emoji}</span>
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">{thing.title}</h3>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
          </button>
          
          {/* Dropdown Menu */}
          {showMenu && (
            <div 
              ref={menuRef}
              className="absolute right-0 top-8 z-10 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2"
            >
              <button
                onClick={handleEdit}
                disabled={loading}
                className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <span>✏️</span> Edit
              </button>
              <button
                onClick={handleShare}
                disabled={loading}
                className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <span>🔗</span> Share
              </button>
              <button
                onClick={handleTogglePostToFeed}
                disabled={loading}
                className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {displayInteraction.visibility === 'public' ? (
                  <><span>👁️‍🗨️</span> Hide from Feed</>
                ) : (
                  <><span>📢</span> Post to Feed</>
                )}
              </button>
              <div className="border-t border-gray-100 my-1"></div>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <span>🗑️</span> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Your Rating */}
      {interaction.rating && interaction.rating > 0 && (
        <div className="mb-3">
          <div className="flex items-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className={`text-lg ${
                  i < interaction.rating! ? 'text-yellow-400' : 'text-gray-300'
                }`}
              >
                ★
              </span>
            ))}
            <span className="ml-2 text-sm text-gray-600">
              {interaction.rating}/5
            </span>
          </div>
        </div>
      )}

      {/* Your Content/Comments */}
      {interaction.content && (
        <div className="mb-3">
          <p className="text-gray-700 leading-relaxed">{interaction.content}</p>
        </div>
      )}

      {/* Your Private Notes */}
      {interaction.notes && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-700 font-medium mb-1">🔒 Private Notes</p>
          <p className="text-sm text-gray-700">{interaction.notes}</p>
        </div>
      )}

      {/* Your Photos */}
      {interaction.photos && interaction.photos.length > 0 && (
        <div className="mb-3">
          <div className="grid grid-cols-3 gap-2">
            {interaction.photos.map((photoUrl, index) => (
              <Image
                key={index}
                src={photoUrl}
                alt={`Photo ${index + 1}`}
                width={100}
                height={100}
                className="w-full h-24 object-cover rounded-lg"
              />
            ))}
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center space-x-1 pt-3 border-t border-gray-100">
        {/* Save Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (displayInteraction.state === 'bucketList') {
              // Already saved - show as disabled
              return;
            } else {
              // Change from completed back to saved
              handleStateChange('bucketList');
            }
          }}
          disabled={loading}
          className={`flex items-center space-x-1 px-3 py-2 rounded-full transition-colors disabled:opacity-50 ${
            displayInteraction.state === 'bucketList'
              ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
          }`}
        >
          {displayInteraction.state === 'bucketList' ? (
            <BookmarkIconSolid className="h-5 w-5" />
          ) : (
            <BookmarkIcon className="h-5 w-5" />
          )}
          <span className="text-sm font-medium">Save</span>
        </button>

        {/* Completed Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (displayInteraction.state === 'completed') {
              // Already completed - show as disabled
              return;
            } else {
              // Change from saved to completed
              handleStateChange('completed');
            }
          }}
          disabled={loading}
          className={`flex items-center space-x-1 px-3 py-2 rounded-full transition-colors disabled:opacity-50 ${
            displayInteraction.state === 'completed'
              ? 'bg-green-50 text-green-600 hover:bg-green-100'
              : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
          }`}
        >
          {displayInteraction.state === 'completed' ? (
            <CheckCircleIconSolid className="h-5 w-5" />
          ) : (
            <CheckCircleIcon className="h-5 w-5" />
          )}
          <span className="text-sm font-medium">Completed</span>
        </button>
      </div>

      {/* Detail Modal */}
      {showDetailModal && (
        <InteractionDetailModal
          interaction={interaction}
          thing={thing}
          myInteraction={interaction}
          isOwnInteraction={true}
          onClose={() => setShowDetailModal(false)}
          onEdit={() => {
            setShowDetailModal(false);
            onEdit?.(interaction, thing);
          }}
        />
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRatingModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Rate {thing.title}
            </h3>
            
            <div className="mb-6">
              <StarRating
                rating={tempRating}
                onRatingChange={setTempRating}
                size="lg"
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => handleRatingSubmit(true)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Skip
              </button>
              <button
                onClick={() => handleRatingSubmit(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Rating'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
