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
  const [recommendedBy, setRecommendedBy] = useState(item.recommendedBy || '');
  const [rating, setRating] = useState(item.rating || 0);
  const [location, setLocation] = useState(item.location || '');
  const [priceRange, setPriceRange] = useState<'$' | '$$' | '$$$' | '$$$$' | ''>(item.priceRange || '');
  const [customPrice, setCustomPrice] = useState(item.customPrice?.toString() || '');
  const [tags, setTags] = useState<string[]>(item.tags || []);
  const [experienceDate, setExperienceDate] = useState(
    item.experienceDate ? new Date(item.experienceDate.toDate()).toISOString().split('T')[0] : ''
  );
  const [taggedUsers, setTaggedUsers] = useState<Array<{id: string; name: string; email: string}>>([]);
  const [taggedNonUsers, setTaggedNonUsers] = useState<Array<{name: string; email?: string}>>(item.taggedNonUsers || []);
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

  // Check if personal item exists for this post
  useEffect(() => {
    const checkPersonalItem = async () => {
      if (type === 'post' && user && isOpen) {
        console.log(`🔍 EditModal: Checking for personal item for post ${item.id}`);
        try {
          const existingItem = await getPersonalItemByPostId(user.uid, item.id);
          console.log(`🔍 EditModal: Found personal item:`, existingItem);
          setHasPersonalItem(!!existingItem);
          setExistingPersonalItem(existingItem);
          // If there's an existing personal item, set its status
          if (existingItem) {
            console.log(`✅ EditModal: Setting status to ${existingItem.status}`);
            setStatus(existingItem.status);
          } else {
            console.log(`❌ EditModal: No personal item found for post ${item.id}`);
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

  // Helper functions
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = e.target as HTMLInputElement;
      addTag(target.value);
      target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    setLoading(true);
    try {
      const updates = {
        title: title.trim(),
        description: description.trim() || '',
        category,
        ...(type === 'personal' && { status }),
        ...(recommendedBy.trim() && { recommendedBy: recommendedBy.trim() }),
        ...(rating > 0 && { rating }),
        ...(location.trim() && { location: location.trim() }),
        ...(priceRange && { priceRange }),
        ...(customPrice && { customPrice: parseFloat(customPrice) }),
        ...(tags.length > 0 && { tags }),
        ...(experienceDate && { experienceDate: new Date(experienceDate) }),
        ...(taggedUsers.length > 0 && { taggedUsers: taggedUsers.map(u => u.id) }),
        ...(taggedNonUsers.length > 0 && { taggedNonUsers }),
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
          const enhancedFields = {
            ...(recommendedBy.trim() && { recommendedBy: recommendedBy.trim() }),
            ...(rating > 0 && { rating }),
            ...(location.trim() && { location: location.trim() }),
            ...(priceRange && { priceRange }),
            ...(customPrice && { customPrice: parseFloat(customPrice) }),
            ...(tags.length > 0 && { tags }),
            ...(experienceDate && { experienceDate: new Date(experienceDate) }),
            ...(taggedUsers.length > 0 && { taggedUsers: taggedUsers.map(u => u.id) }),
            ...(taggedNonUsers.length > 0 && { taggedNonUsers }),
          };

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

          // Add to store
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
            ...(recommendedBy.trim() && { recommendedBy: recommendedBy.trim() }),
            ...(rating > 0 && { rating }),
            ...(location.trim() && { location: location.trim() }),
            ...(priceRange && { priceRange }),
            ...(customPrice && { customPrice: parseFloat(customPrice) }),
            ...(tags.length > 0 && { tags }),
            ...(experienceDate && { experienceDate: Timestamp.fromDate(new Date(experienceDate)) }),
            ...(taggedUsers.length > 0 && { taggedUsers: taggedUsers.map(u => u.id) }),
            ...(taggedNonUsers.length > 0 && { taggedNonUsers }),
          };
          addPersonalItem(newPersonalItem);
        }
        
        // Update post in store
        const storeUpdates = {
          title: title.trim(),
          description: description.trim() || '',
          category,
          ...(recommendedBy.trim() && { recommendedBy: recommendedBy.trim() }),
          ...(rating > 0 && { rating }),
          ...(location.trim() && { location: location.trim() }),
          ...(priceRange && { priceRange }),
          ...(customPrice && { customPrice: parseFloat(customPrice) }),
          ...(tags.length > 0 && { tags }),
          ...(experienceDate && { experienceDate: Timestamp.fromDate(new Date(experienceDate)) }),
          ...(taggedUsers.length > 0 && { taggedUsers: taggedUsers.map(u => u.id) }),
          ...(taggedNonUsers.length > 0 && { taggedNonUsers }),
        };
        updatePostInStore(item.id, storeUpdates);
      } else {
        await updatePersonalItem(item.id, updates);
        // Create store updates with proper Timestamp conversion
        const storeUpdates = {
          title: title.trim(),
          description: description.trim() || '',
          category,
          status,
          ...(recommendedBy.trim() && { recommendedBy: recommendedBy.trim() }),
          ...(rating > 0 && { rating }),
          ...(location.trim() && { location: location.trim() }),
          ...(priceRange && { priceRange }),
          ...(customPrice && { customPrice: parseFloat(customPrice) }),
          ...(tags.length > 0 && { tags }),
          ...(experienceDate && { experienceDate: Timestamp.fromDate(new Date(experienceDate)) }),
          ...(taggedUsers.length > 0 && { taggedUsers: taggedUsers.map(u => u.id) }),
          ...(taggedNonUsers.length > 0 && { taggedNonUsers }),
        };
        updatePersonalItemInStore(item.id, storeUpdates);
      }

      onClose();
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Edit {type === 'post' ? 'Post' : 'Item'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
              placeholder="What are you recommending?"
            />
            <p className="text-xs text-gray-500 mt-1">
              {title.length}/100 characters
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Category
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
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

          {/* Status (for personal items OR posts with personal items) */}
          {(type === 'personal' || (type === 'post' && hasPersonalItem === true)) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Status
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('want_to_try')}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    status === 'want_to_try'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">📖 Want to try</div>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('completed')}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    status === 'completed' || status === 'shared'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium">✅ Completed</div>
                </button>
              </div>
            </div>
          )}

          {/* Add to Personal List (for posts without personal items) */}
          {type === 'post' && hasPersonalItem === false && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="mb-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={shouldCreatePersonalItem}
                    onChange={(e) => setShouldCreatePersonalItem(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    📝 Add to my personal list
                  </span>
                </label>
                <p className="text-xs text-gray-600 mt-1 ml-6">
                  This will help you track your progress and find it in your profile
                </p>
              </div>
              
              {shouldCreatePersonalItem && (
                <div className="ml-6">
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
            <label htmlFor="edit-recommendedBy" className="block text-sm font-medium text-gray-700 mb-2">
              🤝 Recommended by <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="edit-recommendedBy"
              type="text"
              value={recommendedBy}
              onChange={(e) => setRecommendedBy(e.target.value)}
              maxLength={100}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
              placeholder="e.g. Sarah, my coworker, TikTok, my mom..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Who suggested this to you?
            </p>
          </div>

          {/* Enhanced Details */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700">Additional Details</h3>
            
            {/* Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⭐ Rating
              </label>
              <StarRating 
                rating={rating} 
                onRatingChange={setRating}
                maxRating={10}
                size="md"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📍 Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Chinatown, NYC"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
              />
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💰 Price Range
              </label>
              <div className="flex space-x-2">
                {['$', '$$', '$$$', '$$$$'].map((price) => (
                  <button
                    key={price}
                    type="button"
                    onClick={() => setPriceRange(price as '$' | '$$' | '$$$' | '$$$$')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${
                      priceRange === price
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {price}
                  </button>
                ))}
                <input
                  type="number"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="$25"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏷️ Tags
              </label>
              <div className="space-y-2">
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  onKeyPress={handleTagKeyPress}
                  placeholder="Add tags (press Enter) e.g. romantic, spicy, hidden-gem"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Experience Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 When did you experience this?
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
                👥 Who did you experience this with?
              </label>
              <UserTagInput
                taggedUsers={taggedUsers}
                taggedNonUsers={taggedNonUsers}
                onAddUser={(user) => setTaggedUsers([...taggedUsers, user])}
                onRemoveUser={(userId) => setTaggedUsers(taggedUsers.filter(u => u.id !== userId))}
                onAddNonUser={(nonUser) => setTaggedNonUsers([...taggedNonUsers, nonUser])}
                onRemoveNonUser={(index) => setTaggedNonUsers(taggedNonUsers.filter((_, i) => i !== index))}
              />
            </div>
          </div>

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