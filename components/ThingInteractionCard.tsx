'use client';

import { useState } from 'react';
import { Thing, UserThingInteraction } from '@/lib/types';
import { deleteUserThingInteraction, createUserThingInteraction } from '@/lib/firestore';
import { useAuthStore, useAppStore } from '@/lib/store';
import { CATEGORIES } from '@/lib/types';
import { 
  BookmarkIcon, 
  CheckCircleIcon,
  PlayIcon,
  EllipsisVerticalIcon,
  ShareIcon
} from '@heroicons/react/24/outline';

interface ThingInteractionCardProps {
  thing: Thing;
  interaction: UserThingInteraction;
  onThingClick?: (thingId: string) => void;
}

export default function ThingInteractionCard({ 
  thing, 
  interaction
}: ThingInteractionCardProps) {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const { user } = useAuthStore();
  const { removeUserInteraction, updateUserInteraction } = useAppStore();
  
  const category = CATEGORIES.find(c => c.id === thing.category);
  
  const formatDate = (timestamp: { toDate: () => Date }) => {
    const date = timestamp.toDate();
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
    return `${Math.floor(diffInDays / 30)}mo ago`;
  };

  const handleStateChange = async (newState: 'bucketList' | 'inProgress' | 'completed') => {
    if (!user || newState === interaction.state) return;
    
    setLoading(true);
    try {
      // Delete old interaction
      await deleteUserThingInteraction(interaction.id);
      removeUserInteraction(interaction.id);
      
      // Create new interaction with new state
      const newInteractionId = await createUserThingInteraction(
        user.uid,
        thing.id,
        newState,
        'friends'
      );
      
      const newInteraction: UserThingInteraction = {
        id: newInteractionId,
        userId: user.uid,
        thingId: thing.id,
        state: newState,
        date: interaction.date,
        visibility: 'friends',
        createdAt: interaction.createdAt,
      };
      
      updateUserInteraction(interaction.id, newInteraction);
      console.log(`✅ Changed state to: ${newState}`);
    } catch (error) {
      console.error('Error changing state:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await deleteUserThingInteraction(interaction.id);
      removeUserInteraction(interaction.id);
      console.log('🗑️ Removed from list');
    } catch (error) {
      console.error('Error removing item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Check out ${thing.title}`,
        text: `I want to try ${thing.title}!`,
        url: `${window.location.origin}/thing/${thing.id}`
      });
    } else {
      // Fallback to copying URL
      navigator.clipboard.writeText(`${window.location.origin}/thing/${thing.id}`);
      // You could show a toast notification here
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
        
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
        </button>
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

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ShareIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Menu */}
      {showMenu && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex space-x-2">
            <button
              onClick={handleRemove}
              disabled={loading}
              className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
