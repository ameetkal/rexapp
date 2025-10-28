'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Thing, UserThingInteraction, User } from '@/lib/types';
import { createUserThingInteraction, deleteUserThingInteraction } from '@/lib/firestore';
import { getUserProfile } from '@/lib/auth';
import { useAuthStore, useAppStore } from '@/lib/store';
import { dataService } from '@/lib/dataService';
import { CATEGORIES } from '@/lib/types';
import { XMarkIcon, BookmarkIcon, CheckCircleIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid, CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';
import StarRating from './StarRating';
import CommentSection from './CommentSection';
import { Timestamp, doc, updateDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { createComment } from '@/lib/firestore';
import CommentInput from './CommentInput';

interface ThingDetailModalProps {
  thing: Thing;
  onClose: () => void;
  onEdit?: (interaction: UserThingInteraction, thing: Thing) => void;
  onUserClick?: (userId: string) => void;
  onThingCreated?: (thing: Thing) => void; // Callback when Thing is created from preview
}

export default function ThingDetailModal({
  thing,
  onClose,
  onEdit,
  onUserClick,
  onThingCreated
}: ThingDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [tempRating, setTempRating] = useState(0);
  const [initialComment, setInitialComment] = useState('');
  const [recordedAudio, setRecordedAudio] = useState<{blob: Blob; duration: number} | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [interactions, setInteractions] = useState<UserThingInteraction[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [buttonPosition, setButtonPosition] = useState<{ top: number; right: number } | null>(null);
  const [loadingInteractions, setLoadingInteractions] = useState(true);
  
  const { user, userProfile } = useAuthStore();
  const { getUserInteractionByThingId, addUserInteraction, updateUserInteraction, removeUserInteraction } = useAppStore();
  
  const category = CATEGORIES.find(c => c.id === thing.category);
  
  // Check if this is a preview thing (no ID or empty ID means it hasn't been created yet)
  const isPreview = !thing.id || thing.id === '';
  
  // Get current user's interaction with this thing (skip if preview)
  const currentMyInteraction = !isPreview ? getUserInteractionByThingId(thing.id) : null;
  const isInBucketList = currentMyInteraction?.state === 'bucketList';
  const isCompleted = currentMyInteraction?.state === 'completed';
  
  // Load all interactions for this thing (skip if preview)
  useEffect(() => {
    const loadInteractions = async () => {
      // Skip loading if this is a preview thing
      if (isPreview) {
        setInteractions([]);
        setLoadingInteractions(false);
        return;
      }
      
      setLoadingInteractions(true);
      try {
        console.log('🔄 Loading interactions for thing:', thing.id);
        // Query by thingId instead of userId
        const q = query(
          collection(db, 'user_thing_interactions'),
          where('thingId', '==', thing.id),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const allInteractions: UserThingInteraction[] = [];
        snapshot.forEach((doc) => {
          allInteractions.push({ id: doc.id, ...doc.data() } as UserThingInteraction);
        });
        console.log('✅ Loaded interactions:', allInteractions.length);
        setInteractions(allInteractions);
        
        // Load user data for all interactions
        const uniqueUserIds = [...new Set(allInteractions.map(int => int.userId))];
        const usersMap = new Map<string, User>();
        
        for (const userId of uniqueUserIds) {
          const user = await getUserProfile(userId);
          if (user) {
            usersMap.set(userId, user);
          }
        }
        
        setUsers(usersMap);
      } catch (error) {
        console.error('Error loading interactions:', error);
      } finally {
        setLoadingInteractions(false);
      }
    };
    
    loadInteractions();
  }, [thing.id, isPreview]);
  
  // Calculate friends average rating (only from you + people you follow)
  const friendsAvgRating = useMemo(() => {
    const following = userProfile?.following || [];
    const visibleInteractions = interactions.filter(i => 
      i.userId === user?.uid || following.includes(i.userId)
    );
    const completedWithRatings = visibleInteractions.filter(i => i.state === 'completed' && i.rating && i.rating > 0);
    if (completedWithRatings.length === 0) return null;
    const sum = completedWithRatings.reduce((acc, i) => acc + (i.rating || 0), 0);
    return sum / completedWithRatings.length;
  }, [interactions, userProfile?.following, user?.uid]);

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
        let targetThingId = thing.id;
        
        // If preview thing, create the Thing first
        if (isPreview) {
          console.log('🔨 Creating Thing for preview:', thing.title);
          
          // Import the function dynamically to avoid circular dependencies
          const { createOrGetThing } = await import('@/lib/firestore');
          
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
        
        // If this was a preview, fetch the real thing and update the modal
        if (isPreview) {
          console.log('🔄 Preview thing converted, fetching real thing...');
          
          // Fetch the real thing data
          const { getThing } = await import('@/lib/firestore');
          const realThing = await getThing(targetThingId);
          
          if (realThing && onThingCreated) {
            console.log('✅ Got real thing, updating modal...');
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
    let usedThingId = thing.id; // Track the thing ID that will be used
    
    try {
      const rating = skipRating ? undefined : (tempRating > 0 ? tempRating : undefined);
      
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
          
          // Import the function dynamically to avoid circular dependencies
          const { createOrGetThing } = await import('@/lib/firestore');
          
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
        
        // Store the thing ID for later use
        usedThingId = targetThingId;
        
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
            const storageRef = ref(storage, `voice_notes/${user.uid}/${usedThingId}/${fileName}`);
            
            await uploadBytes(storageRef, blob);
            voiceNoteUrl = await getDownloadURL(storageRef);
            voiceNoteDuration = recordedAudio.duration;
          }
          
          // Create the comment
          await createComment(
            usedThingId,
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
      
      // If this was a preview, fetch the real thing and update the modal
      if (isPreview) {
        console.log('🔄 Preview thing converted (completed), fetching real thing...');
        
        // Fetch the real thing data using the thing ID that was used
        const { getThing } = await import('@/lib/firestore');
        const realThing = await getThing(usedThingId);
        
        if (realThing && onThingCreated) {
          console.log('✅ Got real thing, updating modal...');
          onThingCreated(realThing);
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
    
    if (!showMenu) {
      // Calculate button position for portal
      const buttonRect = e.currentTarget.getBoundingClientRect();
      setButtonPosition({
        top: buttonRect.top - 120, // Position above the button
        right: window.innerWidth - buttonRect.right
      });
    }
    
    setShowMenu(!showMenu);
  };

  // Handle share
  const handleShare = async (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent event from bubbling
    console.log('Share clicked');
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
        console.log('✅ Shared successfully');
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
        console.log('✅ Link copied to clipboard');
      }
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
    e?.stopPropagation(); // Prevent event from bubbling
    console.log('Edit clicked', { onEdit: !!onEdit, currentMyInteraction: !!currentMyInteraction });
    if (!onEdit || !currentMyInteraction) return;
    
    setShowMenu(false);
    onEdit(currentMyInteraction, thing);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside the dropdown (portal-rendered)
      const dropdown = document.querySelector('[data-dropdown-menu]');
      if (dropdown && !dropdown.contains(event.target as Node)) {
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

  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-visible">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">{category?.emoji}</span>
              <div>
              <h2 className="text-xl font-bold text-gray-900">{thing.title}</h2>
                <p className="text-sm text-gray-500">{category?.name}</p>
              </div>
            </div>
            <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
            <XMarkIcon className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] overflow-x-visible">
          <div className="p-6 space-y-6">
            {/* Thing Info */}
            {thing.description && (
              <div className="flex items-start space-x-4">
                {thing.image && (
                  <div className="relative w-20 h-28 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={thing.image}
                      alt={thing.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                    <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{thing.description}</p>
                </div>
              </div>
            )}

            {/* People Section */}
            {loadingInteractions ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Completed By */}
              {(() => {
                  const following = userProfile?.following || [];
                  const visibleCompleted = interactions.filter(i => 
                    i.state === 'completed' && (i.userId === user?.uid || following.includes(i.userId))
                  );
                  
                  return visibleCompleted.length > 0 && (
                          <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-700">
                        {visibleCompleted.slice(0, 3).map((int, idx) => {
                          const userData = users.get(int.userId);
                          const displayName = userData?.username || int.userName || 'User';
                          return (
                            <span key={int.id}>
                              {idx > 0 && ', '}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUserClick?.(int.userId);
                                }}
                                className={`hover:underline ${int.userId === currentMyInteraction?.userId ? 'font-medium text-blue-600' : 'text-gray-700'}`}
                              >
                                {displayName}
                              </button>
                            </span>
                          );
                        })}
                        {visibleCompleted.length > 3 && (
                          <span className="text-gray-500"> +{visibleCompleted.length - 3} more</span>
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
                );
              })()}

                {/* Saved By */}
                {(() => {
                  const following = userProfile?.following || [];
                  const visibleSaved = interactions.filter(i => 
                    i.state === 'bucketList' && (i.userId === user?.uid || following.includes(i.userId))
                  );
                  
                  return visibleSaved.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <BookmarkIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-700">
                        {visibleSaved.slice(0, 3).map((int, idx) => {
                          const userData = users.get(int.userId);
                          const displayName = userData?.username || int.userName || 'User';
                          return (
                            <span key={int.id}>
                              {idx > 0 && ', '}
                    <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUserClick?.(int.userId);
                                }}
                                className={`hover:underline ${int.userId === currentMyInteraction?.userId ? 'font-medium text-blue-600' : 'text-gray-700'}`}
                              >
                                {displayName}
                    </button>
                            </span>
                          );
                        })}
                        {visibleSaved.length > 3 && (
                          <span className="text-gray-500"> +{visibleSaved.length - 3} more</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">saved</span>
                    </div>
                  </div>
                  );
                })()}
              </div>
            )}

            {/* Comments Section */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Comments</h3>
              <CommentSection 
                thingId={thing.id} 
                showAllComments={true}
                onUserClick={onUserClick}
              />
              </div>
          </div>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
          {/* Left side - Save/Complete buttons */}
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

          {/* Right side - 3-Dot Menu */}
          {currentMyInteraction && (
            <div className="relative ml-auto" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMenuToggle(e);
                }}
                disabled={loading}
                className="flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <EllipsisVerticalIcon className="h-5 w-5" />
              </button>

              {/* Dropdown Menu - Rendered via Portal */}
              {showMenu && buttonPosition && createPortal(
                <div 
                  data-dropdown-menu
                  className="fixed w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-[999999]"
                  style={{
                    top: `${buttonPosition.top}px`,
                    right: `${buttonPosition.right}px`
                  }}
                >
                  <div className="py-1">
                    {/* Edit */}
                    <button
                      onClick={(e) => {
                        console.log('Edit button clicked in portal');
                        e.stopPropagation();
                        handleEdit(e);
                      }}
                      disabled={loading}
                      className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <span>✏️</span> Edit
                    </button>
                    
                    <div className="border-t border-gray-100 my-1"></div>
                    
                    {/* Share */}
                    <button
                      onClick={(e) => {
                        console.log('Share button clicked in portal');
                        e.stopPropagation();
                        handleShare(e);
                      }}
                      disabled={loading}
                      className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <span>🔗</span> Share
                    </button>
                  </div>
                </div>,
                document.body
            )}
          </div>
          )}
        </div>
      </div>

      {/* Rating Modal */}
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
    </div>
  );
}