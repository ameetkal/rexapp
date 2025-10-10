'use client';

import { useState } from 'react';
import Image from 'next/image';
import { FeedThing, UserThingInteraction, Thing } from '@/lib/types';
import { getUserProfile } from '@/lib/auth';
import { useEffect } from 'react';
import { User } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
import { BookmarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import InteractionDetailModal from './InteractionDetailModal';
import { Timestamp } from 'firebase/firestore';

interface ThingFeedCardProps {
  feedThing: FeedThing;
  onEdit?: (interaction: UserThingInteraction, thing: Thing) => void;
  onUserClick?: (userId: string) => void;
}

export default function ThingFeedCard({ feedThing, onEdit, onUserClick }: ThingFeedCardProps) {
  const { thing, interactions, myInteraction, avgRating } = feedThing;
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  
  const category = CATEGORIES.find(c => c.id === thing.category);
  const allInteractions = [...interactions.completed, ...interactions.saved];
  const totalPeople = allInteractions.length;

  // Load user data for all interactions
  useEffect(() => {
    const loadUsers = async () => {
      const uniqueUserIds = [...new Set(allInteractions.map(int => int.userId))];
      const usersMap = new Map<string, User>();
      
      for (const userId of uniqueUserIds) {
        const user = await getUserProfile(userId);
        if (user) {
          usersMap.set(userId, user);
        }
      }
      
      setUsers(usersMap);
    };
    
    loadUsers();
  }, [allInteractions]);

  const formatDate = (timestamp: Timestamp | Date | { seconds: number } | undefined) => {
    if (!timestamp) return 'Recently';
    
    let date: Date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if ('seconds' in timestamp) {
      date = new Date(timestamp.seconds * 1000);
    } else {
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
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
    return `${Math.floor(diffInDays / 30)}mo ago`;
  };

  const handleCardClick = () => {
    setShowDetailModal(true);
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Header - Thing Info */}
      <div className="flex items-start space-x-3 mb-3">
        <span className="text-3xl flex-shrink-0">{category?.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-lg leading-tight">{thing.title}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {formatDate(feedThing.mostRecentUpdate)}
          </p>
        </div>
        
        {thing.image && (
          <div className="flex-shrink-0">
            <Image
              src={thing.image}
              alt={thing.title}
              width={48}
              height={64}
              className="w-12 h-16 object-cover rounded"
            />
          </div>
        )}
      </div>

      {/* People Section */}
      <div className="mb-3 space-y-2">
        {/* Completed By */}
        {interactions.completed.length > 0 && (
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-700">
                {interactions.completed.slice(0, 3).map((int, idx) => {
                  const user = users.get(int.userId);
                  const displayName = user?.username || int.userName || 'User';
                  return (
                    <span key={int.id}>
                      {idx > 0 && ', '}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUserClick?.(int.userId);
                        }}
                        className={`hover:underline ${int.userId === myInteraction?.userId ? 'font-medium text-blue-600' : 'text-gray-700'}`}
                      >
                        {displayName}
                      </button>
                    </span>
                  );
                })}
                {interactions.completed.length > 3 && (
                  <span className="text-gray-500"> +{interactions.completed.length - 3} more</span>
                )}
              </span>
              <span className="text-xs text-gray-500 ml-1">completed</span>
            </div>
          </div>
        )}
        
        {/* Saved By */}
        {interactions.saved.length > 0 && (
          <div className="flex items-center space-x-2">
            <BookmarkIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-700">
                {interactions.saved.slice(0, 3).map((int, idx) => {
                  const user = users.get(int.userId);
                  const displayName = user?.username || int.userName || 'User';
                  return (
                    <span key={int.id}>
                      {idx > 0 && ', '}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUserClick?.(int.userId);
                        }}
                        className={`hover:underline ${int.userId === myInteraction?.userId ? 'font-medium text-blue-600' : 'text-gray-700'}`}
                      >
                        {displayName}
                      </button>
                    </span>
                  );
                })}
                {interactions.saved.length > 3 && (
                  <span className="text-gray-500"> +{interactions.saved.length - 3} more</span>
                )}
              </span>
              <span className="text-xs text-gray-500 ml-1">saved</span>
            </div>
          </div>
        )}
      </div>

      {/* First Person's Take (or yours if you have one) */}
      {(myInteraction?.content || allInteractions[0]?.content) && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700 line-clamp-2">
            {myInteraction?.content || allInteractions[0]?.content}
          </p>
        </div>
      )}

      {/* Rating Info */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          {/* First person's rating (or yours) */}
          {(myInteraction?.rating || allInteractions[0]?.rating) && (
            <div className="flex items-center space-x-1">
              <span className="text-yellow-400">★</span>
              <span className="text-gray-700 font-medium">
                {myInteraction?.rating || allInteractions[0]?.rating}/5
              </span>
              <span className="text-gray-500 text-xs">
                ({myInteraction ? 'You' : users.get(allInteractions[0].userId)?.username || 'User'})
              </span>
            </div>
          )}
          
          {/* Rex Average */}
          {avgRating && (
            <div className="flex items-center space-x-1">
              <span className="text-gray-400">★</span>
              <span className="text-gray-600 text-xs">
                {avgRating.toFixed(1)} Rex avg
              </span>
            </div>
          )}
        </div>
        
        {/* Total people count */}
        <span className="text-xs text-gray-500">
          {totalPeople} {totalPeople === 1 ? 'person' : 'people'}
        </span>
      </div>

      {/* Detail Modal */}
      {showDetailModal && (
        <InteractionDetailModal
          interaction={myInteraction || allInteractions[0]}
          thing={thing}
          myInteraction={myInteraction}
          isOwnInteraction={!!myInteraction}
          onClose={() => setShowDetailModal(false)}
          onEdit={myInteraction && onEdit ? () => {
            setShowDetailModal(false);
            onEdit(myInteraction, thing);
          } : undefined}
        />
      )}
    </div>
  );
}

