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
import { useAuthStore, useAppStore } from '@/lib/store';
import { dataService } from '@/lib/dataService';
import UserTagInput from './UserTagInput';
import { 
  HeartIcon, 
  TrashIcon,
  PaperAirplaneIcon 
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconFilled } from '@heroicons/react/24/solid';

interface CommentSectionProps {
  thingId: string;
  showAllComments?: boolean; // For profile views
}

export default function CommentSection({ thingId, showAllComments = false }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [taggedUsers, setTaggedUsers] = useState<{id: string; name: string; email: string}[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { user, userProfile } = useAuthStore();
  const { following } = useAppStore();

  const loadComments = async () => {
    setLoading(true);
    try {
      const loadedComments = showAllComments 
        ? await getCommentsForThing(thingId) // All comments
        : await getCommentsForThing(thingId, user?.uid || '', following); // Filtered
      setComments(loadedComments);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thingId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile || !newComment.trim()) return;

    setSubmitting(true);
    try {
      const commentId = await createComment(
        thingId,
        user.uid,
        userProfile.name,
        newComment.trim(),
        taggedUsers.map(u => u.id)
      );

      // Add comment to local state
      const newCommentObj: Comment = {
        id: commentId,
        thingId,
        authorId: user.uid,
        authorName: userProfile.name,
        content: newComment.trim(),
        createdAt: Timestamp.now(),
        likedBy: [],
        taggedUsers: taggedUsers.map(u => u.id),
      };
      
      setComments(prev => [...prev, newCommentObj]);
      setNewComment('');
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
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                      {comment.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900">
                        {comment.authorName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(comment.createdAt)}
                      </p>
                      {comment.taggedUsers && comment.taggedUsers.length > 0 && (
                        <div className="flex items-center space-x-1 mt-0.5">
                          <span className="text-xs text-blue-600">@</span>
                          <span className="text-xs text-blue-600">
                            {comment.taggedUsers.length} user{comment.taggedUsers.length > 1 ? 's' : ''} tagged
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {isAuthor && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="p-1 hover:bg-red-100 rounded-full transition-colors"
                    >
                      <TrashIcon className="h-3 w-3 text-gray-400 hover:text-red-500" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-gray-700 mb-1 ml-8">
                  {comment.content}
                </p>

                <div className="flex items-center space-x-2 ml-8">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLikeToggle(comment);
                    }}
                    className={`flex items-center space-x-1 px-1.5 py-0.5 rounded-full transition-colors text-xs ${
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
              <div className="relative">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Add a comment... (use @ to tag users)"
                  className="w-full px-3 py-2 pr-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                  rows={2}
                  disabled={submitting}
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || submitting}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  ) : (
                    <PaperAirplaneIcon className="h-3 w-3" />
                  )}
                </button>
              </div>
              
            </div>
          </div>
        </form>
      ) : (
        <p className="text-xs text-gray-500 text-center py-2">
          Sign in to comment
        </p>
      )}
    </div>
  );
}

