'use client';

import { useState, useEffect } from 'react';
import { useAuthStore, useAppStore } from '@/lib/store';
import { updatePost, updatePersonalItem, getPersonalItemByPostId, createPersonalItem, updatePersonalItemStatus } from '@/lib/firestore';
import { CATEGORIES, Category, Post, PersonalItem, PersonalItemStatus } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import StarRating from './StarRating';
import UserTagInput from './UserTagInput';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Post | PersonalItem;
  type: 'post' | 'personal';
}

export default function EditModal({ isOpen, onClose, item, type }: EditModalProps) {
  const [category, setCategory] = useState<Category>(item.category);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || '');
  const [recommendedByUser, setRecommendedByUser] = useState<{id: string; name: string; email: string} | null>(null);
  const [recommendedByText, setRecommendedByText] = useState(item.recommendedBy || '');
  
  // Completion-related fields (only shown when item is completed)
  const [rating, setRating] = useState(item.rating || 0);
  const [experienceDate, setExperienceDate] = useState(
    item.experienceDate ? new Date(item.experienceDate.toDate()).toISOString().split('T')[0] : ''
  );
  const [taggedUsers, setTaggedUsers] = useState<Array<{id: string; name: string; email: string}>>([]);
  const [taggedNonUsers, setTaggedNonUsers] = useState<Array<{name: string; email?: string}>>(item.taggedNonUsers || []);
  
  // Location (only for manual posts without metadata)
  const [location, setLocation] = useState(item.location || '');
  
  const [status, setStatus] = useState<'want_to_try' | 'completed' | 'shared'>(
    type === 'personal' ? (item as PersonalItem).status : 'want_to_try'
  );
  
  // New state for managing personal item creation
  const [hasPersonalItem, setHasPersonalItem] = useState<boolean | null>(null);
  const [existingPersonalItem, setExistingPersonalItem] = useState<PersonalItem | null>(null);
  const [shouldCreatePersonalItem, setShouldCreatePersonalItem] = useState(false);
  const [personalItemStatus, setPersonalItemStatus] = useState<'want_to_try' | 'completed'>('want_to_try');
  
  const [loading, setLoading] = useState(false);

  const { user } = useAuthStore();
  const { updatePost: updatePostInStore, updatePersonalItem: updatePersonalItemInStore, addPersonalItem } = useAppStore();

  // Check if this is a structured post with location metadata
  const hasLocationMetadata = (item as Post).postType === 'structured' && 
    (item as Post).universalItem?.metadata?.address;

  // Initialize recommendedBy user if it exists
  useEffect(() => {
    if (item.recommendedByUserId && item.recommendedBy) {
      setRecommendedByUser({
        id: item.recommendedByUserId,
        name: item.recommendedBy,
        email: '' // We don't store email in the post
      });
      setRecommendedByText('');
    }
  }, [item.recommendedByUserId, item.recommendedBy]);

  // Check if personal item exists for this post
  useEffect(() => {
    const checkPersonalItem = async () => {
      if (type === 'post' && user && isOpen) {
        try {
          const existingItem = await getPersonalItemByPostId(user.uid, item.id);
          setHasPersonalItem(!!existingItem);
          setExistingPersonalItem(existingItem);
          if (existingItem) {
            setStatus(existingItem.status);
          }
        } catch (error) {
          console.error('Error checking personal item:', error);
          setHasPersonalItem(false);
          setExistingPersonalItem(null);
        }
      }
    };

    checkPersonalItem();
  }, [type, user, item.id, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    setLoading(true);
    try {
      // Prepare enhanced fields based on status
      const recommendedByValue = recommendedByUser?.name || recommendedByText.trim() || undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enhancedFields: Record<string, any> = {};

      // Always include recommendation fields
      if (recommendedByValue) enhancedFields.recommendedBy = recommendedByValue;
      if (recommendedByUser) enhancedFields.recommendedByUserId = recommendedByUser.id;

      // Only include completion-related fields if status is completed
      if (status === 'completed' || (type === 'personal' && (item as PersonalItem).status === 'completed')) {
        if (rating > 0) enhancedFields.rating = rating;
        if (experienceDate) enhancedFields.experienceDate = new Date(experienceDate);
        if (taggedUsers.length > 0) enhancedFields.taggedUsers = taggedUsers.map(u => u.id);
        if (taggedNonUsers.length > 0) enhancedFields.taggedNonUsers = taggedNonUsers;
      }

      // Only include location for manual posts without metadata
      if (!hasLocationMetadata && location.trim()) {
        enhancedFields.location = location.trim();
      }

      const updates = {
        title: title.trim(),
        description: description.trim() || '',
        category,
        ...(type === 'personal' && { status }),
        ...enhancedFields,
      };

      if (type === 'post') {
        await updatePost(item.id, updates);
        
        // If there's an existing personal item, update its status too
        if (existingPersonalItem && status !== existingPersonalItem.status) {
          await updatePersonalItem(existingPersonalItem.id, { 
            status: status as PersonalItemStatus,
            ...(status === 'completed' && !existingPersonalItem.completedAt && { completedAt: new Date() })
          });
          
          // Update in store
          updatePersonalItemInStore(existingPersonalItem.id, { 
            status: status as PersonalItemStatus,
            ...(status === 'completed' && !existingPersonalItem.completedAt && { completedAt: Timestamp.now() })
          });
        }
        
        // If user wants to create a personal item, do it now
        if (shouldCreatePersonalItem) {
          const personalItemId = await createPersonalItem(
            user.uid,
            category,
            title.trim(),
            description.trim() || undefined,
            enhancedFields,
            // Link to the post being edited
            {
              postId: item.id,
              authorId: (item as Post).authorId,
              authorName: (item as Post).authorName,
            }
          );

          // Update the personal item status to the selected one
          if (personalItemStatus === 'completed') {
            await updatePersonalItemStatus(personalItemId, 'completed');
          }

          // Add to store with proper Timestamp conversion
          const newPersonalItem: PersonalItem = {
            id: personalItemId,
            userId: user.uid,
            category,
            title: title.trim(),
            description: description.trim() || '',
            status: personalItemStatus,
            createdAt: Timestamp.now(),
            source: 'saved_from_post',
            originalPostId: item.id,
            originalAuthorId: (item as Post).authorId,
            originalAuthorName: (item as Post).authorName,
            ...(personalItemStatus === 'completed' && { completedAt: Timestamp.now() }),
            ...(enhancedFields.recommendedBy && { recommendedBy: enhancedFields.recommendedBy }),
            ...(enhancedFields.recommendedByUserId && { recommendedByUserId: enhancedFields.recommendedByUserId }),
            ...(enhancedFields.rating && { rating: enhancedFields.rating }),
            ...(enhancedFields.location && { location: enhancedFields.location }),
            ...(enhancedFields.experienceDate && { experienceDate: Timestamp.fromDate(enhancedFields.experienceDate) }),
            ...(enhancedFields.taggedUsers && { taggedUsers: enhancedFields.taggedUsers }),
            ...(enhancedFields.taggedNonUsers && { taggedNonUsers: enhancedFields.taggedNonUsers }),
          };
          addPersonalItem(newPersonalItem);
        }
        
        // Update post in store with proper Timestamp conversion
        const storeUpdates = {
          title: title.trim(),
          description: description.trim() || '',
          category,
          ...(enhancedFields.recommendedBy && { recommendedBy: enhancedFields.recommendedBy }),
          ...(enhancedFields.recommendedByUserId && { recommendedByUserId: enhancedFields.recommendedByUserId }),
          ...(enhancedFields.rating && { rating: enhancedFields.rating }),
          ...(enhancedFields.location && { location: enhancedFields.location }),
          ...(enhancedFields.experienceDate && { experienceDate: Timestamp.fromDate(enhancedFields.experienceDate) }),
          ...(enhancedFields.taggedUsers && { taggedUsers: enhancedFields.taggedUsers }),
          ...(enhancedFields.taggedNonUsers && { taggedNonUsers: enhancedFields.taggedNonUsers }),
        };
        updatePostInStore(item.id, storeUpdates);
      } else {
        // Update personal item
        await updatePersonalItem(item.id, updates);
        
        // If this personal item has a linked post (sharedPostId), also update the post
        const personalItem = item as PersonalItem;
        if (personalItem.sharedPostId) {
          const postUpdates = {
            title: title.trim(),
            description: description.trim() || '',
            category,
            ...(enhancedFields.recommendedBy && { recommendedBy: enhancedFields.recommendedBy }),
            ...(enhancedFields.recommendedByUserId && { recommendedByUserId: enhancedFields.recommendedByUserId }),
            ...(enhancedFields.rating && { rating: enhancedFields.rating }),
            ...(enhancedFields.location && { location: enhancedFields.location }),
            ...(enhancedFields.experienceDate && { experienceDate: enhancedFields.experienceDate }),
            ...(enhancedFields.taggedUsers && { taggedUsers: enhancedFields.taggedUsers }),
            ...(enhancedFields.taggedNonUsers && { taggedNonUsers: enhancedFields.taggedNonUsers }),
          };
          
          await updatePost(personalItem.sharedPostId, postUpdates);
          
          // Update post in store with proper Timestamp conversion
          const postStoreUpdates = {
            title: title.trim(),
            description: description.trim() || '',
            category,
            ...(enhancedFields.recommendedBy && { recommendedBy: enhancedFields.recommendedBy }),
            ...(enhancedFields.recommendedByUserId && { recommendedByUserId: enhancedFields.recommendedByUserId }),
            ...(enhancedFields.rating && { rating: enhancedFields.rating }),
            ...(enhancedFields.location && { location: enhancedFields.location }),
            ...(enhancedFields.experienceDate && { experienceDate: Timestamp.fromDate(enhancedFields.experienceDate) }),
            ...(enhancedFields.taggedUsers && { taggedUsers: enhancedFields.taggedUsers }),
            ...(enhancedFields.taggedNonUsers && { taggedNonUsers: enhancedFields.taggedNonUsers }),
          };
          updatePostInStore(personalItem.sharedPostId, postStoreUpdates);
        }
        
        // Update personal item in store with proper Timestamp conversion
        const personalStoreUpdates = {
          title: title.trim(),
          description: description.trim() || '',
          category,
          status,
          ...(enhancedFields.recommendedBy && { recommendedBy: enhancedFields.recommendedBy }),
          ...(enhancedFields.recommendedByUserId && { recommendedByUserId: enhancedFields.recommendedByUserId }),
          ...(enhancedFields.rating && { rating: enhancedFields.rating }),
          ...(enhancedFields.location && { location: enhancedFields.location }),
          ...(enhancedFields.experienceDate && { experienceDate: Timestamp.fromDate(enhancedFields.experienceDate) }),
          ...(enhancedFields.taggedUsers && { taggedUsers: enhancedFields.taggedUsers }),
          ...(enhancedFields.taggedNonUsers && { taggedNonUsers: enhancedFields.taggedNonUsers }),
        };
        updatePersonalItemInStore(item.id, personalStoreUpdates);
      }

      onClose();
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setLoading(false);
    }
  };

  const isCompleted = status === 'completed' || (type === 'personal' && (item as PersonalItem).status === 'completed');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Edit {type === 'post' ? 'Post' : 'Item'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <XMarkIcon className="h-6 w-6 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Category Selection */}
          <div>
            <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <div className="relative">
              <select
                id="edit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={100}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
              placeholder="What would you like to call this?"
            />
            <p className="text-xs text-gray-500 mt-1">
              {title.length}/100 characters
            </p>
          </div>

          {/* Status Selection (for posts or personal items) */}
          {(type === 'post' || type === 'personal') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('want_to_try')}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    status === 'want_to_try'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">📝 Want to Try</div>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('completed')}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    status === 'completed'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">✅ Completed</div>
                </button>
              </div>
            </div>
          )}

          {/* Add to Personal List (for posts without personal item) */}
          {type === 'post' && !hasPersonalItem && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={shouldCreatePersonalItem}
                  onChange={(e) => setShouldCreatePersonalItem(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Add to your personal list</p>
                  <p className="text-xs text-gray-600 mt-1">
                    This will help you track your progress and find it in your profile
                  </p>
                </div>
              </label>
              
              {shouldCreatePersonalItem && (
                <div className="ml-6 mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPersonalItemStatus('want_to_try')}
                      className={`p-2 border rounded text-left text-sm transition-colors ${
                        personalItemStatus === 'want_to_try'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-medium">📖 Want to try</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPersonalItemStatus('completed')}
                      className={`p-2 border rounded text-left text-sm transition-colors ${
                        personalItemStatus === 'completed'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-medium">✅ Completed</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder:text-gray-500"
              placeholder="Tell us more about this... (optional)"
            />
            <p className="text-xs text-gray-500 mt-1">
              {description.length}/500 characters
            </p>
          </div>

          {/* Recommended By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🤝 Recommended by <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            
            <UserTagInput
              singleUser={true}
              selectedUser={recommendedByUser}
              textValue={recommendedByText}
              onUserSelect={(user) => {
                setRecommendedByUser(user);
                if (!user) {
                  // When removing a tagged user, keep any text that was typed
                  // The textValue will be maintained by the component
                }
              }}
              onTextChange={(text) => setRecommendedByText(text)}
              placeholder="Enter any name or search for Rex users..."
            />
          </div>

          {/* Location (only for manual posts without metadata) */}
          {!hasLocationMetadata && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📍 Location <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Chinatown, NYC"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
              />
            </div>
          )}

          {/* Completion Details (only shown when status is completed) */}
          {isCompleted && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700">Completion Details</h3>
              
              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ⭐ Rating <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <StarRating 
                  rating={rating} 
                  onRatingChange={setRating}
                  maxRating={10}
                  size="md"
                />
              </div>

              {/* Experience Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📅 When did you experience this? <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={experienceDate}
                  onChange={(e) => setExperienceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Tagged Users */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  👥 Who did you experience this with? <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <UserTagInput
                  taggedUsers={taggedUsers}
                  taggedNonUsers={taggedNonUsers}
                  onAddUser={(user) => setTaggedUsers([...taggedUsers, user])}
                  onRemoveUser={(userId) => setTaggedUsers(taggedUsers.filter(u => u.id !== userId))}
                  onAddNonUser={(nonUser) => setTaggedNonUsers([...taggedNonUsers, nonUser])}
                  onRemoveNonUser={(index) => setTaggedNonUsers(taggedNonUsers.filter((_, i) => i !== index))}
                  placeholder="Tag people you experienced this with..."
                />
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 