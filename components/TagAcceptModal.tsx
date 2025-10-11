'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { acceptTag, declineTag, getTag } from '@/lib/firestore';
import { Tag } from '@/lib/types';
import { useAuthStore } from '@/lib/store';

interface TagAcceptModalProps {
  tagId: string;
  onClose: () => void;
  onAccepted: () => void;
}

export default function TagAcceptModal({ tagId, onClose, onAccepted }: TagAcceptModalProps) {
  const { user, userProfile } = useAuthStore();
  const [tag, setTag] = useState<Tag | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load tag details
  useState(() => {
    const loadTag = async () => {
      try {
        const tagData = await getTag(tagId);
        setTag(tagData);
      } catch (error) {
        console.error('Error loading tag:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTag();
  });

  const handleAccept = async () => {
    if (!user || !userProfile || !tag) return;

    setSubmitting(true);
    try {
      const success = await acceptTag(tag.id, user.uid, userProfile.name);
      if (success) {
        onAccepted();
        onClose();
      }
    } catch (error) {
      console.error('Error accepting tag:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!user || !tag) return;

    setSubmitting(true);
    try {
      const success = await declineTag(tag.id, user.uid);
      if (success) {
        onClose();
      }
    } catch (error) {
      console.error('Error declining tag:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!tag) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6">
          <p className="text-center text-gray-600">Tag not found</p>
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Tag Request</h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-6">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-semibold">{tag.taggerName}</span> tagged you in:
            </p>
            <p className="text-lg font-semibold text-gray-900 mb-2">{tag.thingTitle}</p>
            <div className="flex items-center space-x-2 text-sm">
              <span className={`px-2 py-1 rounded-full ${
                tag.state === 'completed' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {tag.state === 'completed' ? '✅ Completed' : '📝 To Do'}
              </span>
              {tag.rating && (
                <span className="text-gray-600">
                  ⭐ {tag.rating}/5
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-600">
            {tag.state === 'completed' 
              ? 'Accepting will add this to your Completed list. You can add your own rating and notes later.'
              : 'Accepting will add this to your Bucket List.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handleDecline}
            disabled={submitting}
            className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={submitting}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? 'Accepting...' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}

