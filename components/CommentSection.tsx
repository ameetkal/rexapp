'use client';

import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Comment } from '@/lib/types';
import { 
  createComment, 
  getCommentsForThing, 
  deleteComment,
  likeComment,
  unlikeComment
} from '@/lib/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuthStore, useAppStore } from '@/lib/store';
import { 
  HeartIcon, 
  TrashIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconFilled } from '@heroicons/react/24/solid';
import VoicePlayer from './VoicePlayer';
import CommentInput from './CommentInput';

interface CommentSectionProps {
  thingId: string;
  showAllComments?: boolean; // For profile views
  onUserClick?: (userId: string) => void; // For navigating to user profiles
}

export default function CommentSection({ thingId, showAllComments = false, onUserClick }: CommentSectionProps) { 
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userProfile } = useAuthStore();
  const following = userProfile?.following || [];

  const loadComments = async () => {
    setLoading(true);
    try {
      console.log(`🔄 CommentSection loading comments for thingId: ${thingId}, showAllComments: ${showAllComments}`);
      const loadedComments = showAllComments 
        ? await getCommentsForThing(thingId, user?.uid || '', undefined) // All comments (undefined = show all)
        : await getCommentsForThing(thingId, user?.uid || '', following); // Filtered
      console.log(`✅ CommentSection loaded ${loadedComments.length} comments for thingId: ${thingId}`);
      setComments(loadedComments);
    } catch (error) {
      console.error(`❌ Error loading comments for thingId ${thingId}:`, error);
      // If error is about missing index, log helpful message
      if (error instanceof Error && error.message.includes('index')) {
        console.error('⚠️ Firestore index may be missing. Check Firebase Console for composite index on comments collection.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thingId]);

  const handleSubmitComment = async (text: string, voiceNote?: {blob: Blob; duration: number}, mentionedUsernames?: string[]) => {
    if (!user || !userProfile) return;

    try {
      // Upload voice note if exists
      let voiceNoteUrl: string | undefined;
      let voiceNoteDuration: number | undefined;
      
      if (voiceNote) {
        try {
          const blob = voiceNote.blob;
          const fileName = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
          const storageRef = ref(storage, `voice_notes/${user.uid}/${thingId}/${fileName}`);
          
          await uploadBytes(storageRef, blob);
          voiceNoteUrl = await getDownloadURL(storageRef);
          voiceNoteDuration = voiceNote.duration;
          
          console.log('✅ Voice note uploaded:', voiceNoteUrl);
        } catch (uploadError) {
          console.error('Voice note upload error:', uploadError);
          // Don't fail the comment creation if voice upload fails
        }
      }

      // Create comment with voice note if exists
      const commentId = await createComment(
        thingId,
        user.uid,
        userProfile.name,
        text || (voiceNote ? 'Voice note' : ''),
        mentionedUsernames,
        voiceNoteUrl,
        voiceNoteDuration
      );
      
      // Add comment to local state
      const newCommentObj: Comment = {
        id: commentId,
        thingId,
        authorId: user.uid,
        authorName: userProfile.name,
        content: text || (voiceNote ? 'Voice note' : ''),
        createdAt: Timestamp.now(),
        likedBy: [],
        taggedUsers: mentionedUsernames || [],
        voiceNoteUrl,
        voiceNoteDuration,
      };
      
      setComments(prev => [...prev, newCommentObj]);

      // Optimistically bump Thing.commentCount in store to reflect UI without global refresh
      try {
        const { updateThing, getThingById } = useAppStore.getState();
        const currentThing = getThingById(thingId);
        if (currentThing) {
          const currentCount = currentThing.commentCount ?? 0;
          updateThing(thingId, { commentCount: currentCount + 1 });
        }
      } catch {
        // non-fatal
      }
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error; // Re-throw so CommentInput can handle it
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;

    try {
      await deleteComment(commentId, thingId);
      setComments(prev => prev.filter(c => c.id !== commentId));

      // Optimistically decrement Thing.commentCount in store
      try {
        const { updateThing, getThingById } = useAppStore.getState();
        const currentThing = getThingById(thingId);
        if (currentThing) {
          const currentCount = currentThing.commentCount ?? 0;
          updateThing(thingId, { commentCount: Math.max(0, currentCount - 1) });
        }
      } catch {
        // non-fatal
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleLikeToggle = async (comment: Comment) => {
    if (!user) return;

    const isLiked = comment.likedBy.includes(user.uid);

    try {
      if (isLiked) {
        await unlikeComment(comment.id, user.uid);
        setComments(prev =>
          prev.map(c =>
            c.id === comment.id
              ? { ...c, likedBy: c.likedBy.filter(id => id !== user.uid) }
              : c
          )
        );
      } else {
        await likeComment(comment.id, user.uid);
        setComments(prev =>
          prev.map(c =>
            c.id === comment.id
              ? { ...c, likedBy: [...c.likedBy, user.uid] }
              : c
          )
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const formatDate = (timestamp: { toDate: () => Date }) => {
    const date = timestamp.toDate();
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  // Render comment text with inline @mentions
  const renderCommentText = (text: string, commentTaggedUsers: string[] = []) => {
    const parts = text.split(/(@\w+)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.slice(1);
        // Check if this username is in the tagged users list
        const isTagged = commentTaggedUsers.includes(username);
        
        return (
          <span
            key={index}
            className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
              isTagged 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer' 
                : 'text-gray-700'
            }`}
            onClick={isTagged ? (e) => {
              e.stopPropagation();
              if (onUserClick) {
                // Use username as the identifier for navigation
                onUserClick(username);
              }
            } : undefined}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };


  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {/* Comments List */}
      {loading ? (
        <div className="text-center py-2">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        </div>
      ) : comments.length > 0 && (
        <div className="space-y-2 mb-3">
          {comments.map(comment => {
            const isLiked = user ? comment.likedBy.includes(user.uid) : false;
            const isAuthor = user?.uid === comment.authorId;

            return (
              <div key={comment.id} className="bg-gray-50 rounded-lg p-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onUserClick) {
                          onUserClick(comment.authorId);
                        }
                      }}
                      className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0 hover:bg-blue-200 transition-colors cursor-pointer"
                    >
                      {comment.authorName.charAt(0).toUpperCase()}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onUserClick) {
                              onUserClick(comment.authorId);
                            }
                          }}
                          className="text-xs font-medium text-gray-900 hover:text-blue-600 hover:underline cursor-pointer"
                        >
                          {comment.authorName}
                        </button>
                        <span className="text-xs text-gray-700 flex-1 truncate">
                          {renderCommentText(comment.content, comment.taggedUsers || [])}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLikeToggle(comment);
                          }}
                          className={`flex items-center space-x-1 px-1.5 py-0.5 rounded-full transition-colors text-xs flex-shrink-0 ${
                            isLiked
                              ? 'text-red-500 bg-red-50'
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                          }`}
                        >
                          {isLiked ? (
                            <HeartIconFilled className="h-3 w-3" />
                          ) : (
                            <HeartIcon className="h-3 w-3" />
                          )}
                          <span>{comment.likedBy.length || ''}</span>
                        </button>
                      </div>
                      {/* Voice Note */}
                      {comment.voiceNoteUrl && comment.voiceNoteDuration && (
                        <div className="mt-2">
                          <VoicePlayer 
                            url={comment.voiceNoteUrl}
                            duration={comment.voiceNoteDuration}
                          />
                        </div>
                      )}
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isAuthor && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id); }}
                      className="p-1 hover:bg-red-100 rounded-full transition-colors ml-2 flex-shrink-0"
                    >
                      <TrashIcon className="h-3 w-3 text-gray-400 hover:text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Comment Form */}
      {user ? (
        <CommentInput
          onSubmit={handleSubmitComment}
          showSubmitButton={true}
          showUserAvatar={true}
          placeholder="Add a comment..."
        />
      ) : (
        <p className="text-xs text-gray-500 text-center py-2">
          Sign in to comment
        </p>
      )}
    </div>
  );
}

