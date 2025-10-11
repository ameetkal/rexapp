'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/lib/store';
import { createOrGetThing, createUserThingInteraction, createRecommendation, updateInteractionContent, createInvitation, createTag, createNotification } from '@/lib/firestore';
import { uploadPhotos, MAX_PHOTOS, validatePhotoFile } from '@/lib/storage';
import { Category, PersonalItemStatus, UniversalItem, Thing, UserThingInteraction } from '@/lib/types';
import { sendSMSInvite, shouldOfferSMSInvite } from '@/lib/utils';
import { BookOpenIcon, FilmIcon, MapPinIcon, ChevronDownIcon, ChevronUpIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import StarRating from './StarRating';
import UserTagInput from './UserTagInput';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface PostFormProps {
  universalItem?: UniversalItem; // If present, it's structured (from API)
  editMode?: {
    interaction: UserThingInteraction;
    thing: Thing;
  }; // If present, we're editing an existing interaction
  onBack: () => void;
  onSuccess: () => void;
}

export default function PostForm({ 
  universalItem, 
  editMode,
  onBack, 
  onSuccess 
}: PostFormProps) {
  const isStructured = !!universalItem || !!editMode;
  const isEditMode = !!editMode;
  
  // Form state
  const [title, setTitle] = useState(universalItem?.title || editMode?.thing.title || '');
  const [category, setCategory] = useState<Category>(universalItem?.category || editMode?.thing.category || 'other');
  const [rating, setRating] = useState(editMode?.interaction.rating || 0);
  const [status, setStatus] = useState<PersonalItemStatus>(
    editMode?.interaction.state === 'completed' ? 'completed' : 'want_to_try'
  );
  const [postToFeed, setPostToFeed] = useState(
    editMode ? editMode.interaction.visibility === 'public' : true
  );
  const [description, setDescription] = useState(editMode?.interaction.content || '');
  const [recommendedByUser, setRecommendedByUser] = useState<{id: string; name: string; email: string} | null>(null);
  const [recommendedByText, setRecommendedByText] = useState('');
  const [experiencedWithUsers, setExperiencedWithUsers] = useState<{id: string; name: string; email: string}[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // More Info state
  const [showMoreInfo, setShowMoreInfo] = useState(
    !!(editMode?.interaction.photos?.length || editMode?.interaction.notes)
  );
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<string[]>(editMode?.interaction.photos || []);
  const [internalNotes, setInternalNotes] = useState(editMode?.interaction.notes || '');
  const [photoError, setPhotoError] = useState('');
  
  // SMS invite state
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteData, setInviteData] = useState<{
    recommenderName: string;
    thingTitle: string;
    inviteCode: string;
  } | null>(null);
  
  const { user, userProfile } = useAuthStore();

  // Helper variables for thing data (works for both structured and edit mode)
  const thingData = editMode?.thing || universalItem;

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

  const removeExistingPhoto = (index: number) => {
    setExistingPhotoUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !userProfile) {
      console.error('❌ Cannot submit: Missing user or userProfile');
      return;
    }

    // Validation for manual entry (not in edit mode)
    if (!isStructured && !isEditMode && !title.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      // ===== EDIT MODE =====
      if (isEditMode && editMode) {
        console.log('✏️ Updating existing interaction:', editMode.interaction.id);
        
        // Upload new photos if any
        let newPhotoUrls: string[] = [];
        if (photos.length > 0) {
          console.log('📸 Uploading new photos...');
          newPhotoUrls = await uploadPhotos(photos, user.uid);
          console.log('✅ Photos uploaded:', newPhotoUrls.length);
        }
        
        // Combine existing photos + new photos
        const allPhotoUrls = [...existingPhotoUrls, ...newPhotoUrls];
        
        // Update interaction content
        await updateInteractionContent(editMode.interaction.id, {
          content: description.trim() || undefined,
          rating: rating > 0 ? rating : undefined,
          photos: allPhotoUrls.length > 0 ? allPhotoUrls : undefined,
        });
        
        // Update state and visibility if changed
        const newState = status === 'completed' ? 'completed' : 'bucketList';
        const newVisibility = postToFeed ? 'public' : 'private';
        
        const interactionRef = doc(db, 'user_thing_interactions', editMode.interaction.id);
        
        // Build update object conditionally (Firestore doesn't allow undefined)
        const updateData: {
          state: string;
          visibility: string;
          notes?: string;
        } = {
          state: newState,
          visibility: newVisibility,
        };
        
        if (internalNotes.trim()) {
          updateData.notes = internalNotes.trim();
        }
        
        await updateDoc(interactionRef, updateData);
        
        console.log('✅ Interaction updated');
        onSuccess();
        return;
      }
      
      // ===== CREATE MODE =====
      const recommendedByValue = recommendedByUser?.name || recommendedByText.trim() || undefined;

      // Upload photos if any
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        console.log('📸 Uploading photos...');
        photoUrls = await uploadPhotos(photos, user.uid);
        console.log('✅ Photos uploaded:', photoUrls.length);
      }

      // Build UniversalItem
      const itemToCreate: UniversalItem = universalItem! || {
        id: '',
        title: title.trim(),
        category,
        description: '',
        metadata: {},
        source: 'manual',
      } as UniversalItem;

      // 1. Create or get the thing
      const thingId = await createOrGetThing(itemToCreate, user.uid);
      console.log('✅ Thing created/found:', thingId);
      
      // 2. Create user interaction
      const interactionState = status === 'completed' ? 'completed' : 'bucketList';
      const visibility = postToFeed ? 'public' : 'private';
      
      const interactionId = await createUserThingInteraction(
        user.uid,
        userProfile.name,
        thingId,
        interactionState as 'completed' | 'bucketList',
        visibility,
        {
          rating: rating > 0 ? rating : undefined,
          notes: internalNotes.trim() || undefined,
          content: postToFeed ? description.trim() || undefined : undefined,
          photos: postToFeed ? (photoUrls.length > 0 ? photoUrls : undefined) : undefined,
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
      
      // 4. Create tags for "Experienced With" users
      if (experiencedWithUsers.length > 0) {
        console.log('👥 Creating tags for experienced with users:', experiencedWithUsers.length);
        const itemTitle = universalItem?.title || title.trim();
        
        for (const taggedUser of experiencedWithUsers) {
          try {
            // Create tag (pending acceptance)
            const tagId = await createTag(
              interactionId,
              user.uid,
              userProfile.name,
              taggedUser.id, // Will be empty string for non-users
              taggedUser.name,
              taggedUser.email,
              thingId,
              itemTitle,
              interactionState as 'completed' | 'bucketList',
              rating > 0 ? rating : undefined,
              undefined // inviteCode only for non-users (handled below)
            );
            console.log('✅ Tag created:', tagId, 'for', taggedUser.name);
            
            // If Rex user, notify them
            if (taggedUser.id) {
              await createNotification(
                taggedUser.id,
                'tagged',
                `${userProfile.name} tagged you`,
                `${userProfile.name} tagged you in ${itemTitle} (${interactionState === 'completed' ? 'Completed' : 'To Do'})`,
                {
                  fromUserId: user.uid,
                  fromUserName: userProfile.name,
                  thingId,
                  thingTitle: itemTitle,
                  interactionId,
                  tagId,
                }
              );
              console.log('✅ Notification sent to', taggedUser.name);
            } else {
              // Non-user: create invitation
              console.log('🎁 Creating invitation for non-user tag:', taggedUser.name);
              const inviteCode = await createInvitation(
                user.uid,
                userProfile.name,
                userProfile.username,
                thingId,
                itemTitle,
                interactionId
              );
              
              // Update tag with invite code
              await updateDoc(doc(db, 'tags', tagId), { inviteCode });
              
              // Send SMS invite
              sendSMSInvite(
                taggedUser.name,
                userProfile.name,
                itemTitle,
                inviteCode
              );
              console.log('✅ SMS invite sent to', taggedUser.name);
            }
          } catch (error) {
            console.error('❌ Error creating tag for', taggedUser.name, error);
          }
        }
        
        // Update interaction with experiencedWith user IDs
        await updateDoc(doc(db, 'user_thing_interactions', interactionId), {
          experiencedWith: experiencedWithUsers
            .filter(u => u.id) // Only Rex users
            .map(u => u.id),
        });
      }
      
      const result = { thingId, interactionId, postId: postToFeed ? interactionId : undefined };
      
      console.log('✅ Created:', result);

      // Check if we should offer SMS invite for non-user recommender
      if (recommendedByValue && shouldOfferSMSInvite(recommendedByValue) && !recommendedByUser) {
        const itemTitle = universalItem?.title || title.trim();
        
        // Create invitation code
        console.log('🎁 Creating invitation for non-user recommender');
        const inviteCode = await createInvitation(
          user.uid,
          userProfile.name,
          userProfile.username,
          result.thingId,
          itemTitle,
          result.interactionId
        );
        
        setInviteData({
          recommenderName: recommendedByValue,
          thingTitle: itemTitle,
          inviteCode,
        });
        setShowInviteDialog(true);
        return;
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
        inviteData.thingTitle,
        inviteData.inviteCode
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
            {isEditMode ? 'Edit Item' : isStructured ? 'Add to Your List' : 'Add Custom Item'}
          </h2>
        </div>

        {/* Item Preview (Structured or Edit Mode) */}
        {(isStructured || isEditMode) && (
          <div className={`mb-6 p-4 border rounded-lg ${isEditMode ? 'bg-gray-50 border-gray-300' : 'bg-blue-50 border-blue-200'}`}>
            {isEditMode && <p className="text-xs text-gray-500 mb-2">📌 Editing</p>}
            <div className="flex space-x-4">
              <div className="flex-shrink-0">
                {thingData?.image ? (
                  <Image
                    src={thingData.image}
                    alt={thingData.title}
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
                  {thingData?.title}
                </h3>
                {thingData?.metadata?.author && (
                  <p className="text-sm text-gray-600 mb-1">
                    by {thingData.metadata.author}
                  </p>
                )}
                {(universalItem?.metadata.year || editMode?.thing.metadata?.year) && (
                  <p className="text-sm text-gray-600 mb-1">
                    {universalItem?.metadata.year || editMode?.thing.metadata?.year}
                    {(universalItem?.metadata.type || editMode?.thing.metadata?.type) && (
                      <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded-full">
                        {(universalItem?.metadata.type || editMode?.thing.metadata?.type) === 'tv' ? '📺 TV Show' : '🎬 Movie'}
                      </span>
                    )}
                  </p>
                )}
                {thingData?.metadata.address && (
                  <p className="text-sm text-gray-600 mb-1">
                    📍 {thingData?.metadata.address}
                  </p>
                )}
                {(thingData?.metadata.rating || thingData?.metadata.priceLevel) && (
                  <div className="flex items-center space-x-3 text-sm text-gray-600 mb-1">
                    {thingData?.metadata.rating && (
                      <span>⭐ {thingData?.metadata.rating}/5</span>
                    )}
                    {thingData?.metadata.priceLevel && (
                      <span className="text-green-600 font-medium">
                        {'$'.repeat(thingData?.metadata.priceLevel)}
                      </span>
                    )}
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  {thingData?.category === 'books' ? '📚 Books • Auto-filled from Google Books' :
                   thingData?.category === 'movies' ? '🎬 Movies/TV • Auto-filled from TMDb' :
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

          {/* Recommended By (Create Mode Only) */}
          {!isEditMode && (
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
          )}

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

          {/* Experienced With */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              👥 Experienced with <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Tag friends who experienced this with you. They&apos;ll be notified to accept.
            </p>
            
            <UserTagInput
              singleUser={false}
              selectedUsers={experiencedWithUsers}
              onUsersChange={(users) => setExperiencedWithUsers(users)}
              excludeCurrentUser={true}
              currentUserId={user?.uid}
              placeholder="Search for Rex users or enter any name..."
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
              {(photos.length > 0 || existingPhotoUrls.length > 0 || internalNotes.trim()) && (
                <span className="text-xs text-blue-600 font-medium">
                  {[
                    (photos.length + existingPhotoUrls.length) > 0 && `${photos.length + existingPhotoUrls.length} photo${(photos.length + existingPhotoUrls.length) > 1 ? 's' : ''}`,
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
                  {(photos.length + existingPhotoUrls.length) < MAX_PHOTOS && (
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
                  
                  {/* Existing Photos (Edit Mode) */}
                  {existingPhotoUrls.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">Current photos:</p>
                      <div className="grid grid-cols-3 gap-2">
                        {existingPhotoUrls.map((url, index) => (
                          <div key={`existing-${index}`} className="relative group">
                            <Image
                              src={url}
                              alt={`Existing photo ${index + 1}`}
                              width={100}
                              height={100}
                              className="w-full h-24 object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removeExistingPhoto(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* New Photo Previews */}
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
              {submitting ? (isEditMode ? 'Saving...' : 'Adding...') : 
               !user || !userProfile ? 'Loading...' :
               isEditMode ? 'Save Changes' :
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
                Let {inviteData.recommenderName} know their recommendation for &ldquo;{inviteData.thingTitle}&rdquo; is being shared on Rex!
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

