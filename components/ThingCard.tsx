'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { FeedThing, UserThingInteraction, Thing, User } from '@/lib/types';
import { getUserProfile } from '@/lib/auth';
import { CATEGORIES } from '@/lib/types';
import { BookmarkIcon, CheckCircleIcon, ChatBubbleLeftIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid, CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';
import ThingDetailModal from './ThingDetailModal';
import StarRating from './StarRating';
import CommentSection from './CommentSection';
import { Timestamp, doc, updateDoc } from 'firebase/firestore';
import { useAuthStore, useAppStore } from '@/lib/store';
import { createUserThingInteraction, deleteUserThingInteraction } from '@/lib/firestore';
import { db } from '@/lib/firebase';
import { dataService } from '@/lib/dataService';
import { createComment } from '@/lib/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import CommentInput from './CommentInput';

interface ThingCardProps {
  feedThing: FeedThing;
  onEdit?: (interaction: UserThingInteraction, thing: Thing) => void;
  onUserClick?: (userId: string) => void;
  autoOpen?: boolean; // If true, automatically open the detail modal
}

export default function ThingCard({ feedThing, onEdit, onUserClick, autoOpen = false }: ThingCardProps) {
  const { thing, interactions, myInteraction } = feedThing;
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [tempRating, setTempRating] = useState(0);
  const [initialComment, setInitialComment] = useState('');
  const [recordedAudio, setRecordedAudio] = useState<{blob: Blob; duration: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const { user, userProfile } = useAuthStore();
  const { getUserInteractionByThingId, removeUserInteraction, addUserInteraction, updateUserInteraction } = useAppStore();
  
  const category = CATEGORIES.find(c => c.id === thing.category);
  const allInteractions = useMemo(() => {
    // Use interactions directly (now it's a flat array)
    const feedInteractions = interactions;
    
    // Get current user's interaction from global store
    const storeInteraction = getUserInteractionByThingId(thing.id);
    
    // If user has an interaction in the store, replace or add it to feed interactions
    if (storeInteraction) {
      // Remove any existing interaction for this user from feed data
      const filteredFeedInteractions = feedInteractions.filter(int => int.userId !== storeInteraction.userId);
      // Add the current store interaction (with updated state)
      filteredFeedInteractions.push(storeInteraction);
      return filteredFeedInteractions;
    }
    
    return feedInteractions;
  }, [interactions, getUserInteractionByThingId, thing.id]);

  // Dynamically calculate completed and saved interactions based on current states
  const dynamicInteractions = useMemo(() => ({
    completed: allInteractions.filter(int => int.state === 'completed'),
    saved: allInteractions.filter(int => int.state === 'bucketList')
  }), [allInteractions]);

  // Determine button states - ONLY use store data (current user's interaction)
  // Ignore myInteraction prop as it represents the profile owner's interaction, not current user's
  const currentMyInteraction = getUserInteractionByThingId(thing.id);
  const isInBucketList = currentMyInteraction?.state === 'bucketList';
  const isCompleted = currentMyInteraction?.state === 'completed';

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

  // Auto-open modal if autoOpen prop is true
  useEffect(() => {
    if (autoOpen) {
      setShowDetailModal(true);
      // Clear the auto-open flag from the store after opening
      const { setAutoOpenThingId } = useAppStore.getState();
      setAutoOpenThingId(null);
    }
  }, [autoOpen]);

  const formatDate = (timestamp: Date | null) => {
    if (!timestamp) return 'No recent activity';
    
    // Format time since someone first interacted with this item
    const now = new Date();
    const diffInMs = now.getTime() - timestamp.getTime();
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

  // Calculate friends average rating from completed interactions in this card
  const friendsAvgRating = useMemo(() => {
    const completedWithRatings = dynamicInteractions.completed.filter(i => i.rating && i.rating > 0);
    if (completedWithRatings.length === 0) return null;
    const sum = completedWithRatings.reduce((acc, i) => acc + (i.rating || 0), 0);
    return sum / completedWithRatings.length;
  }, [dynamicInteractions.completed]);

  // Handle Save/Unsave
  const handleSaveToggle = async () => {
    if (!user || !userProfile) return;
    
    setLoading(true);
    try {
      if (isInBucketList && currentMyInteraction) {
        // Remove from bucket list
        if (!confirm(`Delete "${thing.title}" from your profile? Your notes, photos, and rating will be lost.`)) {
          setLoading(false);
          return;
        }
        
        await deleteUserThingInteraction(currentMyInteraction.id);
        removeUserInteraction(currentMyInteraction.id);
        console.log('🗑️ Removed from bucket list');
      } else {
        // Add to bucket list
        const interactionId = await createUserThingInteraction(
          user.uid,
          userProfile.name,
          thing.id,
          'bucketList',
          'friends'
        );
        
        const newInteraction: UserThingInteraction = {
          id: interactionId,
          userId: user.uid,
          userName: userProfile.name,
          thingId: thing.id,
          state: 'bucketList',
          date: Timestamp.now(),
          visibility: 'friends',
          createdAt: Timestamp.now(),
          likedBy: [],
          commentCount: 0,
        };
        
        addUserInteraction(newInteraction);
        console.log('✅ Added to your bucket list');
      }
      
      // Clear feed cache to ensure immediate UI update
      dataService.clearFeedCache(user.uid);
    } catch (error) {
      console.error('Error toggling save:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle Complete (shows rating modal first, or edit if already completed)
  const handleCompleteToggle = () => {
    if (!user || !userProfile) return;
    
    if (isCompleted && onEdit && currentMyInteraction) {
      // Already completed - open edit modal with existing data
      onEdit(currentMyInteraction, thing);
    } else {
      // Not completed yet - show rating modal
      setShowRatingModal(true);
    }
  };

  // Handle rating submission after Complete clicked
  const handleRatingSubmit = async (skipRating = false) => {
    if (!user || !userProfile) return;
    
    setLoading(true);
    try {
      const rating = skipRating ? undefined : (tempRating > 0 ? tempRating : undefined);
      
      if (currentMyInteraction) {
        // Update existing interaction to completed
        // Update the existing interaction's state directly in Firestore
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
        const interactionId = await createUserThingInteraction(
          user.uid,
          userProfile.name,
          thing.id,
          'completed',
          'friends',
          { rating }
        );
        
        const newInteraction: UserThingInteraction = {
          id: interactionId,
          userId: user.uid,
          userName: userProfile.name,
          thingId: thing.id,
          state: 'completed',
          date: Timestamp.now(),
          visibility: 'friends',
          rating,
          createdAt: Timestamp.now(),
          likedBy: [],
          commentCount: 0,
        };
        
        addUserInteraction(newInteraction);
      }
      
      console.log(`✅ Marked as completed${rating ? ` with ${rating}/5 rating` : ''}`);
      
      // If user provided an initial comment, create it
      if ((initialComment.trim() || recordedAudio) && user && userProfile) {
        try {
          // Extract @mentions from the comment
          const mentionRegex = /@(\w+)/g;
          const mentions = initialComment.match(mentionRegex) || [];
          const mentionedUsernames = mentions.map(m => m.substring(1));
          
          // Upload voice note if exists
          let voiceNoteUrl: string | undefined;
          let voiceNoteDuration: number | undefined;
          
          if (recordedAudio) {
            const blob = recordedAudio.blob;
            const fileName = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
            const storageRef = ref(storage, `voice_notes/${user.uid}/${thing.id}/${fileName}`);
            
            await uploadBytes(storageRef, blob);
            voiceNoteUrl = await getDownloadURL(storageRef);
            voiceNoteDuration = recordedAudio.duration;
          }
          
          // Create the comment
          await createComment(
            thing.id,
            user.uid,
            userProfile.name,
            initialComment.trim() || (recordedAudio ? 'Voice note' : ''),
            mentionedUsernames.length > 0 ? mentionedUsernames : undefined,
            voiceNoteUrl,
            voiceNoteDuration
          );
          
          console.log('✅ Created initial comment');
        } catch (commentError) {
          console.error('Error creating initial comment:', commentError);
        }
      }
      
      setShowRatingModal(false);
      setTempRating(0);
      setInitialComment('');
      setRecordedAudio(null);
      
      // Clear feed cache to ensure immediate UI update
      dataService.clearFeedCache(user.uid);
    } catch (error) {
      console.error('Error marking as completed:', error);
    } finally {
      setLoading(false);
    }
  };


  // Handle menu toggle
  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  // Handle share
  const handleShare = async (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent event from bubbling to card
    if (!user || !userProfile) return;
    
    setShowMenu(false);
    setLoading(true);
    
    try {
      const shareUrl = `${window.location.origin}/share/${thing.id}?from=${user.uid}`;
      
      if (navigator.share) {
        await navigator.share({
          title: `${userProfile.name} has shared ${thing.title} with you on Rex:`,
          url: shareUrl,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      }
      
      console.log('✅ Shared successfully');
    } catch (error) {
      // Handle user cancellation gracefully
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('ℹ️ Share cancelled by user');
      } else {
        console.error('❌ Error sharing:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle edit
  const handleEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent event from bubbling to card
    if (!onEdit || !currentMyInteraction) return;
    
    setShowMenu(false);
    onEdit(currentMyInteraction, thing);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

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
        {dynamicInteractions.completed.length > 0 && (
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-700">
                {dynamicInteractions.completed.slice(0, 3).map((int, idx) => {
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
                {dynamicInteractions.completed.length > 3 && (
                  <span className="text-gray-500"> +{dynamicInteractions.completed.length - 3} more</span>
                )}
              </span>
              <span className="text-xs text-gray-500 ml-1">completed</span>
              {friendsAvgRating && (
                <span className="text-xs text-gray-600 ml-2">
                  ★ {friendsAvgRating.toFixed(1)} avg
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Save By */}
        {dynamicInteractions.saved.length > 0 && (
          <div className="flex items-center space-x-2">
            <BookmarkIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-700">
                {dynamicInteractions.saved.slice(0, 3).map((int, idx) => {
                  const user = users.get(int.userId);
                  const displayName = user?.username || int.userName || 'User';
                  return (
                    <span key={int.id}>
                      {idx > 0 && ', '}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('🔍 Saved username clicked:', int.userId, displayName);
                          onUserClick?.(int.userId);
                        }}
                        className={`hover:underline ${int.userId === myInteraction?.userId ? 'font-medium text-blue-600' : 'text-gray-700'}`}
                      >
                        {displayName}
                      </button>
                    </span>
                  );
                })}
                {dynamicInteractions.saved.length > 3 && (
                  <span className="text-gray-500"> +{dynamicInteractions.saved.length - 3} more</span>
                )}
              </span>
              <span className="text-xs text-gray-500 ml-1">saved</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center space-x-1">
          {/* Save Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSaveToggle();
            }}
            disabled={loading}
            className={`flex items-center space-x-1 px-3 py-2 rounded-full transition-colors disabled:opacity-50 ${
              isInBucketList
                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            {isInBucketList ? (
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
              handleCompleteToggle();
            }}
            disabled={loading}
            className={`flex items-center space-x-1 px-3 py-2 rounded-full transition-colors disabled:opacity-50 ${
              isCompleted
                ? 'bg-green-50 text-green-600 hover:bg-green-100'
                : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
            }`}
          >
            {isCompleted ? (
              <CheckCircleIconSolid className="h-5 w-5" />
            ) : (
              <CheckCircleIcon className="h-5 w-5" />
            )}
            <span className="text-sm font-medium">Completed</span>
          </button>
        </div>

        {/* Right side - Comments and Menu */}
        <div className="flex items-center space-x-1">
          {/* Comments Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowComments(!showComments);
            }}
            className={`flex items-center space-x-1 px-3 py-2 rounded-full transition-colors ${
              showComments
                ? 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50'
            }`}
          >
            <ChatBubbleLeftIcon className="h-5 w-5" />
            <span className="text-sm font-medium">
              {thing.commentCount ?? 0}
            </span>
          </button>

          {/* 3-Dot Menu - Only show if user has interaction */}
          {currentMyInteraction && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={handleMenuToggle}
                disabled={loading}
                className="flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <EllipsisVerticalIcon className="h-5 w-5" />
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    {/* Edit */}
                    <button
                      onClick={(e) => handleEdit(e)}
                      disabled={loading}
                      className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <span>✏️</span> Edit
                    </button>
                    
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    {/* Share */}
                    <button
                      onClick={(e) => handleShare(e)}
                      disabled={loading}
                      className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <span>🔗</span> Share
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Comments Section - Only show when expanded */}
      {showComments && (
        <div className="mt-3">
          <CommentSection 
            thingId={thing.id} 
            showAllComments={true} // Show all comments (profile and feed both benefit from full visibility)
            onUserClick={onUserClick}
          />
        </div>
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
              <p className="text-sm text-gray-600 mb-4">How would you rate it?</p>
              <div className="flex justify-center">
                <StarRating
                  rating={tempRating}
                  onRatingChange={setTempRating}
                  size="lg"
                />
              </div>
            </div>
            
            {/* Optional Comment Input */}
            <div className="mb-6">
              <p className="text-xs text-gray-500 mb-2">Optional: Add a comment</p>
              <CommentInput
                onTextChange={setInitialComment}
                onVoiceNoteChange={setRecordedAudio}
                initialValue={initialComment}
                initialVoiceNote={recordedAudio}
                placeholder="Add a comment... (use @ to tag users)"
                rows={2}
                disabled={loading}
                submitOnEnter={false}
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setInitialComment('');
                  setRecordedAudio(null);
                  handleRatingSubmit(true);
                }}
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

      {/* Detail Modal */}
      {showDetailModal && (
        <ThingDetailModal
          thing={thing}
          onClose={() => setShowDetailModal(false)}
          onEdit={currentMyInteraction && onEdit ? () => {
            setShowDetailModal(false);
            onEdit(currentMyInteraction, thing);
          } : undefined}
          onUserClick={onUserClick}
        />
      )}
    </div>
  );
}

