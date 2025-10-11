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
  PlayIcon,
  EllipsisVerticalIcon
} from '@heroicons/react/24/outline';
import InteractionDetailModal from './InteractionDetailModal';
import StarRating from './StarRating';

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
  const [localVisibility, setLocalVisibility] = useState(interaction.visibility);
  const [showMenu, setShowMenu] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [tempRating, setTempRating] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const { user, userProfile } = useAuthStore();
  const { removeUserInteraction, updateUserInteraction } = useAppStore();
  
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
  
  const formatDate = (timestamp: unknown) => {
    let date: Date;
    
    // Handle different timestamp formats
    type TimestampLike = { toDate: () => Date };
    type TimestampObject = { seconds: number; nanoseconds: number };
    
    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof (timestamp as TimestampLike).toDate === 'function') {
      // Firestore Timestamp with toDate method
      date = (timestamp as TimestampLike).toDate();
    } else if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp && 'nanoseconds' in timestamp) {
      // Firestore Timestamp object (raw format)
      const ts = timestamp as TimestampObject;
      date = new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000);
    } else if (timestamp instanceof Date) {
      // Already a Date object
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      // Unix timestamp
      date = new Date(timestamp);
    } else {
      // Fallback if format is unknown
      console.warn('Unknown timestamp format:', timestamp);
      return 'Recently';
    }
    
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
    return `${Math.floor(diffInDays / 30)}mo ago`;
  };

  const handleStateChange = async (newState: 'bucketList' | 'inProgress' | 'completed') => {
    if (!user || newState === interaction.state) return;
    
    // If marking as completed, show rating modal first
    if (newState === 'completed') {
      setShowRatingModal(true);
      return;
    }
    
    setLoading(true);
    try {
      // Update the existing interaction's state (don't delete/recreate)
      const interactionRef = doc(db, 'user_thing_interactions', interaction.id);
      await updateDoc(interactionRef, {
        state: newState,
        date: Timestamp.now()
      });
      
      // Update local store
      updateUserInteraction(interaction.id, { 
        state: newState,
        date: Timestamp.now()
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
      const interactionRef = doc(db, 'user_thing_interactions', interaction.id);
      await updateDoc(interactionRef, {
        state: 'completed',
        rating: rating || null,
        date: Timestamp.now()
      });
      
      // Update local store
      updateUserInteraction(interaction.id, { 
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
    
    const newVisibility = localVisibility === 'public' ? 'private' : 'public';
    
    // Optimistic update
    setLocalVisibility(newVisibility);
    setShowMenu(false);
    setLoading(true);
    
    try {
      console.log(`🔄 Toggling visibility from ${localVisibility} to ${newVisibility}`);
      
      const interactionRef = doc(db, 'user_thing_interactions', interaction.id);
      await updateDoc(interactionRef, {
        visibility: newVisibility
      });
      
      updateUserInteraction(interaction.id, { visibility: newVisibility });
      
      console.log(`✅ Visibility changed to: ${newVisibility}`);
    } catch (error) {
      console.error('❌ Error toggling visibility:', error);
      // Revert on error
      setLocalVisibility(localVisibility);
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

  const getStateIcon = () => {
    switch (interaction.state) {
      case 'bucketList':
        return <BookmarkIcon className="h-5 w-5" />;
      case 'inProgress':
        return <PlayIcon className="h-5 w-5" />;
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5" />;
      default:
        return <BookmarkIcon className="h-5 w-5" />;
    }
  };

  const getStateColor = () => {
    switch (interaction.state) {
      case 'bucketList':
        return 'text-blue-600 bg-blue-50';
      case 'inProgress':
        return 'text-yellow-600 bg-yellow-50';
      case 'completed':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  const getStateLabel = () => {
    switch (interaction.state) {
      case 'bucketList':
        return 'In Bucket List';
      case 'inProgress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      default:
        return 'In Bucket List';
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
                {localVisibility === 'public' ? (
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

      {/* Status and Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {/* Status */}
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStateColor()}`}>
            {getStateIcon()}
            <span className="ml-1">{getStateLabel()}</span>
          </span>
          <span className="text-xs text-gray-500">
            Added {formatDate(interaction.date)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {/* Complete Button - only show if in bucket list */}
          {interaction.state === 'bucketList' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStateChange('completed');
              }}
              disabled={loading}
              className="px-3 py-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-full transition-colors disabled:opacity-50"
            >
              Mark Complete
            </button>
          )}
        </div>
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
