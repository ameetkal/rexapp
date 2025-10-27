'use client';

import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Comment } from '@/lib/types';
import { 
  createComment, 
  getCommentsForThing, 
  deleteComment,
  likeComment,
  unlikeComment,
  searchUsers
} from '@/lib/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuthStore } from '@/lib/store';
import { dataService } from '@/lib/dataService';
import { 
  HeartIcon, 
  TrashIcon,
  PaperAirplaneIcon,
  MicrophoneIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconFilled } from '@heroicons/react/24/solid';
import VoiceRecording from './VoiceRecording';
import VoicePlayer from './VoicePlayer';

interface CommentSectionProps {
  thingId: string;
  showAllComments?: boolean; // For profile views
  onUserClick?: (userId: string) => void; // For navigating to user profiles
}

export default function CommentSection({ thingId, showAllComments = false, onUserClick }: CommentSectionProps) { 
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [taggedUsers, setTaggedUsers] = useState<{id: string; name: string; email: string}[]>([]); 
  const [submitting, setSubmitting] = useState(false);
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [userSuggestions, setUserSuggestions] = useState<{id: string; name: string; username?: string}[]>([]);
  
  // Voice recording state
  const [showVoiceRecording, setShowVoiceRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<{blob: Blob; duration: number} | null>(null);
  const { user, userProfile } = useAuthStore();
  const following = userProfile?.following || [];

  const loadComments = async () => {
    setLoading(true);
    try {
      const loadedComments = showAllComments 
        ? await getCommentsForThing(thingId, user?.uid || '') // All comments
        : await getCommentsForThing(thingId, user?.uid || '', following); // Filtered
      setComments(loadedComments);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle @ tagging in comments
  const handleCommentChange = (value: string) => {
    setNewComment(value);
    
    // Check for @ mentions
    const atMatch = value.match(/@(\w*)$/);
    if (atMatch) {
      const query = atMatch[1];
      if (query.length >= 1) {
        searchForUsers(query);
        setShowUserSuggestions(true);
      } else {
        setShowUserSuggestions(false);
      }
    } else {
      setShowUserSuggestions(false);
    }
  };

  const searchForUsers = async (query: string) => {
    try {
      const results = await searchUsers(query);
      
      // Safety check for following array
      const followingList = following || [];
      
      // Separate followed users from other users
      const followedUsers = results.filter(resultUser => 
        followingList.includes(resultUser.id) && 
        resultUser.id !== user?.uid && 
        !taggedUsers.some(tagged => tagged.id === resultUser.id)
      );
      
      const otherUsers = results.filter(resultUser => 
        !followingList.includes(resultUser.id) && 
        resultUser.id !== user?.uid && 
        !taggedUsers.some(tagged => tagged.id === resultUser.id)
      );
      
      // Prioritize followed users, then add other users
      const prioritizedResults = [...followedUsers, ...otherUsers].slice(0, 8);
      setUserSuggestions(prioritizedResults);
    } catch (error) {
      console.error('Error searching users:', error);
      setUserSuggestions([]);
    }
  };

  const selectUser = (selectedUser: {id: string; name: string; username?: string}) => {
    // Use username if available, otherwise fall back to name
    const displayName = selectedUser.username || selectedUser.name;
    
    // Replace the @query with @username in the comment text
    const newValue = newComment.replace(/@\w*$/, `@${displayName}`);
    setNewComment(newValue);
    
    // Add to tagged users using the display name (username)
    setTaggedUsers(prev => [...prev, {
      id: selectedUser.id,
      name: displayName, // Store the username/display name
      email: selectedUser.username || ''
    }]);
    
    // Hide suggestions
    setShowUserSuggestions(false);
  };

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thingId]);

  // Voice recording handlers
  const handleVoiceRecordingComplete = (audioBlob: Blob, duration: number) => {
    setRecordedAudio({ blob: audioBlob, duration });
    setShowVoiceRecording(false);
  };

  const handleVoiceRecordingCancel = () => {
    setShowVoiceRecording(false);
    setRecordedAudio(null);
  };

  const handleRemoveVoiceNote = () => {
    setRecordedAudio(null);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile || (!newComment.trim() && !recordedAudio)) return;

    setSubmitting(true);
    try {
      // Extract @mentions from comment text
      const mentionMatches = newComment.match(/@(\w+)/g);
      const mentionedUsernames = mentionMatches ? mentionMatches.map(m => m.slice(1)) : [];

      // Upload voice note if exists
      let voiceNoteUrl: string | undefined;
      let voiceNoteDuration: number | undefined;
      
      if (recordedAudio) {
        try {
          // Convert blob to webm format if needed
          const blob = recordedAudio.blob;
          const fileName = `voice_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
          const storageRef = ref(storage, `voice_notes/${user.uid}/${thingId}/${fileName}`);
          
          await uploadBytes(storageRef, blob);
          voiceNoteUrl = await getDownloadURL(storageRef);
          voiceNoteDuration = recordedAudio.duration;
          
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
        newComment.trim() || (recordedAudio ? 'Voice note' : ''),
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
        content: newComment.trim() || (recordedAudio ? 'Voice note' : ''),
        createdAt: Timestamp.now(),
        likedBy: [],
        taggedUsers: mentionedUsernames,
        voiceNoteUrl,
        voiceNoteDuration,
      };
      
      setComments(prev => [...prev, newCommentObj]);
      setNewComment('');
      setRecordedAudio(null);
      setTaggedUsers([]); // Clear tagged users
      
      // Clear feed cache to update comment count in feed cards
      dataService.clearFeedCache(user.uid);
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;

    try {
      await deleteComment(commentId, thingId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      
      // Clear feed cache to update comment count in feed cards
      if (user) {
        dataService.clearFeedCache(user.uid);
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

  // Render current comment text being typed with @mentions highlighted
  const renderCurrentCommentText = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={index}
            className="inline-block px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
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
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0">
                      {comment.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-gray-900">
                          {comment.authorName}
                        </span>
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
                      onClick={() => handleDeleteComment(comment.id)}
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
        <form onSubmit={handleSubmitComment} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start space-x-2">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0">
              {userProfile?.name.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Voice Note Preview */}
                {recordedAudio && (
                  <div className="px-3 py-2 bg-blue-50 border-b border-gray-200 flex items-center justify-between">
                    <VoicePlayer 
                      url={URL.createObjectURL(recordedAudio.blob)} 
                      duration={recordedAudio.duration}
                    />
                    <button
                      type="button"
                      onClick={handleRemoveVoiceNote}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                )}
                
                <div className="relative">
                  {/* Highlighted text overlay */}
                  <div className="absolute inset-0 px-3 py-2 pointer-events-none text-sm whitespace-pre-wrap break-words overflow-hidden">
                    {renderCurrentCommentText(newComment)}
                  </div>
                  <textarea
                    value={newComment}
                    onChange={(e) => handleCommentChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (newComment.trim() && !submitting) {
                          const formEvent = new Event('submit') as unknown as React.FormEvent<HTMLFormElement>;
                          handleSubmitComment(formEvent);
                        }
                      }
                    }}
                    placeholder="Add a comment..."
                    className="w-full px-3 py-2 pr-28 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm bg-white relative z-10"
                    rows={1}
                    disabled={submitting}
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2 z-20">
                    {/* Mic Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowVoiceRecording(true);
                      }}
                      className="p-1.5 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <MicrophoneIcon className="h-4 w-4" />
                    </button>
                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={(!newComment.trim() && !recordedAudio) || submitting}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {submitting ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      ) : (
                        <PaperAirplaneIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* User suggestions dropdown */}
              {showUserSuggestions && userSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {userSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectUser(suggestion);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {suggestion.username || suggestion.name}
                          </div>
                          {suggestion.username && (
                            <div className="text-xs text-gray-500">
                              {suggestion.name}
                            </div>
                          )}
                        </div>
                        {(following || []).includes(suggestion.id) && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                            Following
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
            </div>
          </div>
        </form>
      ) : (
        <p className="text-xs text-gray-500 text-center py-2">
          Sign in to comment
        </p>
      )}

      {/* Voice Recording Modal */}
      {showVoiceRecording && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <VoiceRecording
              onRecordingComplete={handleVoiceRecordingComplete}
              onCancel={handleVoiceRecordingCancel}
            />
          </div>
        </div>
      )}
    </div>
  );
}

