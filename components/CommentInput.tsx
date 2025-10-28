'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { searchUsers } from '@/lib/firestore';
import { 
  PaperAirplaneIcon,
  MicrophoneIcon
} from '@heroicons/react/24/outline';
import VoiceRecording from './VoiceRecording';
import VoicePlayer from './VoicePlayer';

interface CommentInputProps {
  onSubmit?: (text: string, voiceNote?: {blob: Blob; duration: number}, mentionedUsernames?: string[]) => void;
  onTextChange?: (text: string) => void; // For cases where parent needs to track text (e.g., PostForm)
  onVoiceNoteChange?: (voiceNote: {blob: Blob; duration: number} | null) => void; // For cases where parent needs to track voice note (e.g., ThingDetailModal)
  showSubmitButton?: boolean; // Default: false
  showUserAvatar?: boolean; // Default: false
  placeholder?: string;
  disabled?: boolean;
  initialValue?: string;
  initialVoiceNote?: {blob: Blob; duration: number} | null; // For controlled voice note state
  rows?: number; // Default: 1
  submitOnEnter?: boolean; // Default: true when showSubmitButton is false
}

export default function CommentInput({
  onSubmit,
  onTextChange,
  onVoiceNoteChange,
  showSubmitButton = false,
  showUserAvatar = false,
  placeholder = "Add a comment... (use @ to tag users)",
  disabled = false,
  initialValue = '',
  initialVoiceNote = null,
  rows = 1,
  submitOnEnter = true
}: CommentInputProps) {
  const [comment, setComment] = useState(initialValue);
  const [taggedUsers, setTaggedUsers] = useState<{id: string; name: string; email: string}[]>([]);
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [userSuggestions, setUserSuggestions] = useState<{id: string; name: string; username?: string}[]>([]);
  const [showVoiceRecording, setShowVoiceRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<{blob: Blob; duration: number} | null>(initialVoiceNote);
  const [submitting, setSubmitting] = useState(false);
  
  const { user, userProfile } = useAuthStore();
  const following = userProfile?.following || [];

  // Sync with initialValue if it changes externally
  useEffect(() => {
    setComment(initialValue);
  }, [initialValue]);

  // Sync with initialVoiceNote if it changes externally
  useEffect(() => {
    setRecordedAudio(initialVoiceNote);
  }, [initialVoiceNote]);

  // Handle comment text change and @ mentions
  const handleCommentChange = (value: string) => {
    setComment(value);
    
    // Notify parent if callback provided
    if (onTextChange) {
      onTextChange(value);
    }
    
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
      
      // Separate followed users from other users
      const followedUsers = results.filter(resultUser => 
        following.includes(resultUser.id) && 
        resultUser.id !== user?.uid && 
        !taggedUsers.some(tagged => tagged.id === resultUser.id)
      );
      
      const otherUsers = results.filter(resultUser => 
        !following.includes(resultUser.id) && 
        resultUser.id !== user?.uid && 
        !taggedUsers.some(tagged => tagged.id === resultUser.id)
      );
      
      // Prioritize followed users, then add other users (limit to 8)
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
    const newValue = comment.replace(/@\w*$/, `@${displayName}`);
    setComment(newValue);
    
    // Notify parent if callback provided
    if (onTextChange) {
      onTextChange(newValue);
    }
    
    // Add to tagged users
    setTaggedUsers(prev => [...prev, {
      id: selectedUser.id,
      name: displayName,
      email: selectedUser.username || ''
    }]);
    
    // Hide suggestions
    setShowUserSuggestions(false);
  };

  // Voice recording handlers
  const handleVoiceRecordingComplete = (audioBlob: Blob, duration: number) => {
    const voiceNote = { blob: audioBlob, duration };
    console.log('🎤 CommentInput: Voice recording complete', { duration, blobSize: audioBlob.size });
    setRecordedAudio(voiceNote);
    setShowVoiceRecording(false);
    if (onVoiceNoteChange) {
      console.log('🎤 CommentInput: Calling onVoiceNoteChange callback');
      onVoiceNoteChange(voiceNote);
    }
  };

  const handleVoiceRecordingCancel = () => {
    setShowVoiceRecording(false);
    setRecordedAudio(null);
    if (onVoiceNoteChange) {
      onVoiceNoteChange(null);
    }
  };

  const handleRemoveVoiceNote = () => {
    setRecordedAudio(null);
    if (onVoiceNoteChange) {
      onVoiceNoteChange(null);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!onSubmit || (!comment.trim() && !recordedAudio) || submitting) return;

    setSubmitting(true);
    try {
      // Extract @mentions from comment text
      const mentionMatches = comment.match(/@(\w+)/g);
      const mentionedUsernames = mentionMatches ? mentionMatches.map(m => m.slice(1)) : [];
      
      // Call parent's onSubmit with text, voice note, and mentions
      await onSubmit(comment.trim(), recordedAudio || undefined, mentionedUsernames);
      
      // Clear after successful submit
      setComment('');
      setRecordedAudio(null);
      setTaggedUsers([]);
      
      // Notify parent if callback provided
      if (onTextChange) {
        onTextChange('');
      }
    } catch (error) {
      console.error('Error in CommentInput submit:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Render comment text with @mentions highlighted (for overlay)
  const renderCommentText = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={index}
            className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs font-medium"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const canSubmit = (comment.trim() || recordedAudio) && !disabled && !submitting;

  // Only render a form if we have a submit button, otherwise render a div to avoid nested forms
  const FormWrapper = showSubmitButton ? 'form' : 'div';
  const formProps = showSubmitButton 
    ? { onSubmit: handleSubmit, onClick: (e: React.MouseEvent) => e.stopPropagation() }
    : { onClick: (e: React.MouseEvent) => e.stopPropagation() };

  return (
    <>
      <FormWrapper {...formProps}>
        <div className="flex items-start space-x-2">
          {showUserAvatar && (
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0">
              {userProfile?.name.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div className="flex-1 relative">
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
                    disabled={disabled}
                  >
                    Remove
                  </button>
                </div>
              )}
              
              <div className="relative">
                {/* Highlighted text overlay for @mentions */}
                {rows > 1 && (
                  <div className="absolute inset-0 px-3 py-2 pointer-events-none text-sm whitespace-pre-wrap break-words overflow-hidden z-0">
                    {renderCommentText(comment)}
                  </div>
                )}
                {/* Textarea */}
                <textarea
                  value={comment}
                  onChange={(e) => handleCommentChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    // Submit on Enter (unless Shift+Enter for new line, or if submitOnEnter is false)
                    if (e.key === 'Enter' && !e.shiftKey && (submitOnEnter || showSubmitButton)) {
                      if (canSubmit) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }
                  }}
                  placeholder={placeholder}
                  className={`w-full px-3 py-2 ${showSubmitButton ? 'pr-28' : 'pr-14'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm ${rows > 1 ? 'bg-transparent relative z-10' : 'bg-white'} relative ${rows > 1 ? 'z-10' : ''}`}
                  rows={rows}
                  disabled={disabled || submitting}
                />
                <div className={`absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2 z-20`}>
                  {/* Mic Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowVoiceRecording(true);
                    }}
                    className="p-1.5 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    disabled={disabled || submitting}
                  >
                    <MicrophoneIcon className="h-4 w-4" />
                  </button>
                  {/* Submit Button (if enabled) */}
                  {showSubmitButton && (
                    <button
                      type={showSubmitButton ? "submit" : "button"}
                      disabled={!canSubmit}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!showSubmitButton) {
                          // If no form wrapper, handle submit manually
                          handleSubmit();
                        }
                      }}
                      className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {submitting ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      ) : (
                        <PaperAirplaneIcon className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* User suggestions dropdown */}
            {showUserSuggestions && userSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {userSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
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
                      {following.includes(suggestion.id) && (
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
      </FormWrapper>

      {/* Voice Recording Modal */}
      {showVoiceRecording && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleVoiceRecordingCancel();
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <VoiceRecording
              onRecordingComplete={handleVoiceRecordingComplete}
              onCancel={handleVoiceRecordingCancel}
            />
          </div>
        </div>
      )}
    </>
  );
}
