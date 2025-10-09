'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/lib/store';
import { createOrGetThing, createUserThingInteraction, createRecommendation } from '@/lib/firestore';
import { uploadPhotos, MAX_PHOTOS, validatePhotoFile } from '@/lib/storage';
import { Category, PersonalItemStatus, UniversalItem } from '@/lib/types';
import { sendSMSInvite, shouldOfferSMSInvite } from '@/lib/utils';
import { BookOpenIcon, FilmIcon, MapPinIcon, ChevronDownIcon, ChevronUpIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import StarRating from './StarRating';
import UserTagInput from './UserTagInput';

interface PostFormProps {
  universalItem?: UniversalItem; // If present, it's structured (from API)
  onBack: () => void;
  onSuccess: () => void;
}

export default function PostForm({ 
  universalItem, 
  onBack, 
  onSuccess 
}: PostFormProps) {
  const isStructured = !!universalItem;
  
  // Form state
  const [title, setTitle] = useState(universalItem?.title || '');
  const [category, setCategory] = useState<Category>(universalItem?.category || 'other');
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<PersonalItemStatus>('want_to_try');
  const [postToFeed, setPostToFeed] = useState(true);
  const [description, setDescription] = useState('');
  const [recommendedByUser, setRecommendedByUser] = useState<{id: string; name: string; email: string} | null>(null);
  const [recommendedByText, setRecommendedByText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // More Info state
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [internalNotes, setInternalNotes] = useState('');
  const [photoError, setPhotoError] = useState('');
  
  // SMS invite state
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteData, setInviteData] = useState<{
    recommenderName: string;
    postTitle: string;
    postId: string;
    isPost: boolean;
  } | null>(null);
  
  const { user, userProfile } = useAuthStore();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    setPhotoError('');
    const newPhotos = Array.from(files);
    
    if (photos.length + newPhotos.length > MAX_PHOTOS) {
      setPhotoError(`Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }
    
    for (const file of newPhotos) {
      const validation = validatePhotoFile(file);
      if (!validation.valid) {
        setPhotoError(validation.error || 'Invalid file');
        return;
      }
    }
    
    setPhotos(prev => [...prev, ...newPhotos]);
    const urls = newPhotos.map(file => URL.createObjectURL(file));
    setPhotoPreviewUrls(prev => [...prev, ...urls]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setPhotoError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !userProfile) {
      console.error('❌ Cannot submit: Missing user or userProfile');
      return;
    }

    // Validation for manual entry
    if (!isStructured && !title.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const recommendedByValue = recommendedByUser?.name || recommendedByText.trim() || undefined;

      // Upload photos if any
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        console.log('📸 Uploading photos...');
        photoUrls = await uploadPhotos(photos, user.uid);
        console.log('✅ Photos uploaded:', photoUrls.length);
      }

      // Build UniversalItem
      const itemToCreate: UniversalItem = isStructured 
        ? universalItem 
        : {
            id: '', // Will be set by createOrGetThing
            title: title.trim(),
            category,
            description: '',
            metadata: {},
            source: 'manual',
          };

      // 1. Create or get the thing
      const thingId = await createOrGetThing(itemToCreate, user.uid);
      console.log('✅ Thing created/found:', thingId);
      
      // 2. Create user interaction (with all fields including content/photos if sharing)
      const interactionState = status === 'completed' ? 'completed' : 'bucketList';
      const visibility = postToFeed ? 'public' : 'friends'; // Public if sharing to feed
      
      const interactionId = await createUserThingInteraction(
        user.uid,
        userProfile.name, // userName for feed display
        thingId,
        interactionState as 'completed' | 'bucketList',
        visibility,
        {
          rating: rating > 0 ? rating : undefined,
          notes: internalNotes.trim() || undefined,
          content: postToFeed ? description.trim() || undefined : undefined, // Only add content if sharing
          photos: postToFeed ? (photoUrls.length > 0 ? photoUrls : undefined) : undefined, // Only add photos if sharing
        }
      );
      console.log('✅ User interaction created:', interactionId);
      
      // 3. Create recommendation if applicable
      if (recommendedByUser && recommendedByUser.id !== user.uid) {
        await createRecommendation(
          recommendedByUser.id,
          user.uid,
          thingId,
          recommendedByValue
        );
        console.log('✅ Recommendation created');
      }
      
      const result = { thingId, interactionId, postId: postToFeed ? interactionId : undefined };
      
      console.log('✅ Created:', result);

      // Check if we should offer SMS invite for non-user recommender
      if (recommendedByValue && shouldOfferSMSInvite(recommendedByValue) && !recommendedByUser) {
        const itemTitle = isStructured ? universalItem.title : title.trim();
        
        if (postToFeed && result.postId) {
          // For shared posts, use the post ID
          console.log(`✅ Setting up SMS invite for shared post: ${result.postId}`);
          setInviteData({
            recommenderName: recommendedByValue,
            postTitle: itemTitle,
            postId: result.postId,
            isPost: true
          });
          setShowInviteDialog(true);
          return;
        } else if (!postToFeed && result.interactionId) {
          // For private items, use the interaction ID
          console.log(`✅ Setting up SMS invite for private item: ${result.interactionId}`);
          setInviteData({
            recommenderName: recommendedByValue,
            postTitle: itemTitle,
            postId: result.interactionId,
            isPost: false
          });
          setShowInviteDialog(true);
          return;
        }
      }
      
      // Only call onSuccess if no invite dialog was shown
      onSuccess();
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendInvite = () => {
    if (inviteData && userProfile) {
      sendSMSInvite(
        inviteData.recommenderName,
        userProfile.name,
        inviteData.postTitle,
        inviteData.postId,
        inviteData.isPost
      );
      setShowInviteDialog(false);
      setInviteData(null);
      onSuccess();
    }
  };

  const handleSkipInvite = () => {
    setShowInviteDialog(false);
    setInviteData(null);
    onSuccess();
  };

  const getCategoryIcon = () => {
    switch (category) {
      case 'books':
        return <BookOpenIcon className="h-8 w-8 text-gray-400" />;
      case 'movies':
        return <FilmIcon className="h-8 w-8 text-gray-400" />;
      case 'places':
        return <MapPinIcon className="h-8 w-8 text-gray-400" />;
      default:
        return <span className="text-2xl">✨</span>;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="mr-4 text-gray-600 hover:text-gray-800"
          >
            ← Back
          </button>
          <h2 className="text-xl font-bold text-gray-900">
            {isStructured ? 'Add to Your List' : 'Add Custom Item'}
          </h2>
        </div>

        {/* Item Preview (Structured Only) */}
        {isStructured && universalItem && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex space-x-4">
              <div className="flex-shrink-0">
                {universalItem.image ? (
                  <Image
                    src={universalItem.image}
                    alt={universalItem.title}
                    width={64}
                    height={80}
                    className="w-16 h-20 object-cover rounded"
                  />
                ) : (
                  <div className="w-16 h-20 bg-gray-200 rounded flex items-center justify-center">
                    {getCategoryIcon()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {universalItem.title}
                </h3>
                {universalItem.metadata.author && (
                  <p className="text-sm text-gray-600 mb-1">
                    by {universalItem.metadata.author}
                  </p>
                )}
                {universalItem.metadata.year && (
                  <p className="text-sm text-gray-600 mb-1">
                    {universalItem.metadata.year}
                    {universalItem.metadata.type && (
                      <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded-full">
                        {universalItem.metadata.type === 'tv' ? '📺 TV Show' : '🎬 Movie'}
                      </span>
                    )}
                  </p>
                )}
                {universalItem.metadata.address && (
                  <p className="text-sm text-gray-600 mb-1">
                    📍 {universalItem.metadata.address}
                  </p>
                )}
                {(universalItem.metadata.rating || universalItem.metadata.priceLevel) && (
                  <div className="flex items-center space-x-3 text-sm text-gray-600 mb-1">
                    {universalItem.metadata.rating && (
                      <span>⭐ {universalItem.metadata.rating}/5</span>
                    )}
                    {universalItem.metadata.priceLevel && (
                      <span className="text-green-600 font-medium">
                        {'$'.repeat(universalItem.metadata.priceLevel)}
                      </span>
                    )}
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  {universalItem.category === 'books' ? '📚 Books • Auto-filled from Google Books' : 
                   universalItem.category === 'movies' ? '🎬 Movies/TV • Auto-filled from TMDb' : 
                   '📍 Places • Auto-filled from Google Places'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Post Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Manual Entry Fields */}
          {!isStructured && (
            <>
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's the title?"
                  required
                  maxLength={100}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {title.length}/100 characters
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['books', 'movies', 'places', 'music', 'other'] as Category[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`p-3 border rounded-lg text-left transition-colors ${
                        category === cat
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400 text-gray-700'
                      }`}
                    >
                      <div className="font-medium capitalize">{cat}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Status Selection */}
          <div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('want_to_try')}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  status === 'want_to_try'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400 text-gray-700'
                }`}
              >
                <div className="font-medium">📝 To Do</div>
              </button>
              <button
                type="button"
                onClick={() => setStatus('completed')}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  status === 'completed'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 hover:border-gray-400 text-gray-700'
                }`}
              >
                <div className="font-medium">✅ Completed</div>
              </button>
            </div>
          </div>

          {/* Rating (only for completed) */}
          {status === 'completed' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                ⭐ How would you rate it? <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <StarRating rating={rating} onRatingChange={setRating} />
            </div>
          )}

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
                  setRecommendedByText('');
                }
              }}
              onTextChange={(text) => setRecommendedByText(text)}
              excludeCurrentUser={true}
              currentUserId={user?.uid}
              placeholder="Enter any name or search for Rex users..."
            />
          </div>

          {/* Comments for Post */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              💬 Comments for Post <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share your thoughts..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
            />
          </div>

          {/* Share Settings */}
          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={postToFeed}
                onChange={(e) => setPostToFeed(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Share to feed
              </span>
            </label>
          </div>

          {/* More Info Expandable Section */}
          <div>
            <button
              type="button"
              onClick={() => setShowMoreInfo(!showMoreInfo)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                {showMoreInfo ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                <span>Add More Info (Optional)</span>
              </span>
              {(photos.length > 0 || internalNotes.trim()) && (
                <span className="text-xs text-blue-600 font-medium">
                  {[
                    photos.length > 0 && `${photos.length} photo${photos.length > 1 ? 's' : ''}`,
                    internalNotes.trim() && 'Notes added'
                  ].filter(Boolean).join(', ')}
                </span>
              )}
            </button>

            {showMoreInfo && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📸 Photos <span className="text-xs text-gray-500">({photos.length}/{MAX_PHOTOS} max, 5MB each)</span>
                  </label>
                  
                  {photoError && (
                    <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                      {photoError}
                    </div>
                  )}
                  
                  {/* Upload Button */}
                  {photos.length < MAX_PHOTOS && (
                    <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                      <PhotoIcon className="h-4 w-4 mr-2" />
                      <span>Choose Photos</span>
                    </label>
                  )}
                  
                  {/* Photo Previews */}
                  {photoPreviewUrls.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {photoPreviewUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Internal Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📝 Internal Notes
                    <span className="text-xs text-gray-500 ml-2">(Private - only you can see)</span>
                  </label>
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Your private notes..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting || !user || !userProfile}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Adding...' : 
               !user || !userProfile ? 'Loading...' :
               postToFeed ? 'Add & Share' : 'Add to List'}
            </button>
          </div>
        </form>
      </div>

      {/* SMS Invite Dialog */}
      {showInviteDialog && inviteData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📱</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Invite {inviteData.recommenderName}?
              </h3>
              <p className="text-gray-600 text-sm">
                Let {inviteData.recommenderName} know their recommendation for &ldquo;{inviteData.postTitle}&rdquo; is being shared on Rex!
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handleSendInvite}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Send Text Invite
              </button>
              <button
                onClick={handleSkipInvite}
                className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Skip for Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

