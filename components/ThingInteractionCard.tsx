'use client';

import { useState, useEffect, useRef } from 'react';
import { Thing, UserThingInteraction } from '@/lib/types';
import { deleteUserThingInteraction } from '@/lib/firestore';
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
  const menuRef = useRef<HTMLDivElement>(null);

  const { user } = useAuthStore();
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
      
      // Reload to reflect changes
      window.location.reload();
    } catch (error) {
      console.error('Error changing state:', error);
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

  const handleShare = () => {
    setShowMenu(false);
    if (navigator.share) {
      navigator.share({
        title: `Check out ${thing.title}`,
        text: `I want to try ${thing.title}!`,
        url: `${window.location.origin}/thing/${thing.id}`
      }).catch(err => {
        // User cancelled share, ignore
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      });
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(`${window.location.origin}/thing/${thing.id}`);
      alert('Link copied to clipboard!');
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{category?.emoji}</span>
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">{thing.title}</h3>
            <p className="text-sm text-gray-600">{category?.name}</p>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
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

      {/* Thing Description */}
      {thing.description && (
        <div className="mb-4">
          <p className="text-gray-700 leading-relaxed">{thing.description}</p>
        </div>
      )}

      {/* Thing Metadata */}
      {thing.metadata && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {thing.metadata.author && (
              <div>
                <span className="text-gray-500">Author:</span>
                <span className="ml-1 text-gray-900">{thing.metadata.author}</span>
              </div>
            )}
            {thing.metadata.director && (
              <div>
                <span className="text-gray-500">Director:</span>
                <span className="ml-1 text-gray-900">{thing.metadata.director}</span>
              </div>
            )}
            {thing.metadata.year && (
              <div>
                <span className="text-gray-500">Year:</span>
                <span className="ml-1 text-gray-900">{thing.metadata.year}</span>
              </div>
            )}
            {thing.metadata.placeType && (
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-1 text-gray-900 capitalize">{thing.metadata.placeType.replace('_', ' ')}</span>
              </div>
            )}
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
          {/* State Change Buttons - only show if not completed */}
          {interaction.state !== 'completed' && (
            <>
              {interaction.state !== 'inProgress' && (
                <button
                  onClick={() => handleStateChange('inProgress')}
                  disabled={loading}
                  className="px-3 py-1 text-xs font-medium text-yellow-600 bg-yellow-50 hover:bg-yellow-100 rounded-full transition-colors disabled:opacity-50"
                >
                  Start
                </button>
              )}
              
              <button
                onClick={() => handleStateChange('completed')}
                disabled={loading}
                className="px-3 py-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-full transition-colors disabled:opacity-50"
              >
                Complete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
