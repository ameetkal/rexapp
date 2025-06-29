'use client';

import { useState } from 'react';
import { useAuthStore, useAppStore } from '@/lib/store';
import { createPost, createPersonalItem } from '@/lib/firestore';
import { Category, PersonalItemStatus, PersonalItem, UniversalItem } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { sendSMSInvite, shouldOfferSMSInvite } from '@/lib/utils';
import { BookOpenIcon, FilmIcon, MapPinIcon, PlusIcon } from '@heroicons/react/24/outline';
import StarRating from './StarRating';
import BookSearch from './BookSearch';
import MovieSearch from './MovieSearch';
import PlacesSearch from './PlacesSearch';
import StructuredPostForm from './StructuredPostForm';

type PostMode = 'selection' | 'book-search' | 'book-form' | 'movie-search' | 'movie-form' | 'places-search' | 'places-form' | 'custom-form';

export default function PostScreen() {
  // Post creation mode state
  const [mode, setMode] = useState<PostMode>('selection');
  const [selectedBook, setSelectedBook] = useState<UniversalItem | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<UniversalItem | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<UniversalItem | null>(null);
  
  // Existing form state
  const [category, setCategory] = useState<Category>('places');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<PersonalItemStatus>('want_to_try');
  const [recommendedBy, setRecommendedBy] = useState('');
  const [postToFeed, setPostToFeed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Rating for custom posts
  const [rating, setRating] = useState(0);
  
  const { user, userProfile } = useAuthStore();
  const { addPost, addPersonalItem } = useAppStore();

  // SMS invite state
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteData, setInviteData] = useState<{
    recommenderName: string;
    postTitle: string;
    postId: string;
    isPost: boolean;
  } | null>(null);

  // Mode handlers
  const handleBookSearch = () => setMode('book-search');
  const handleMovieSearch = () => setMode('movie-search');
  const handlePlacesSearch = () => setMode('places-search');
  const handleCustomForm = () => {
    setCategory('other');
    setMode('custom-form');
  };
  const handleBackToSelection = () => {
    setMode('selection');
    setSelectedBook(null);
    setSelectedMovie(null);
    setSelectedPlace(null);
  };
  
  const handleBookSelect = (book: UniversalItem) => {
    setSelectedBook(book);
    setMode('book-form');
  };
  
  const handleMovieSelect = (movie: UniversalItem) => {
    setSelectedMovie(movie);
    setMode('movie-form');
  };
  
  const handlePlaceSelect = (place: UniversalItem) => {
    setSelectedPlace(place);
    setMode('places-form');
  };
  
  const handleStructuredSuccess = () => {
    setMode('selection');
    setSelectedBook(null);
    setSelectedMovie(null);
    setSelectedPlace(null);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  // SMS invite handlers
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
      
      // Reset form and show success after sending invite
      setTitle('');
      setDescription('');
      setCategory('places');
      setStatus('want_to_try');
      setRecommendedBy('');
      setPostToFeed(true);
      setRating(0);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const handleSkipInvite = () => {
    setShowInviteDialog(false);
    setInviteData(null);
    
    // Reset form and show success after skipping invite
    setTitle('');
    setDescription('');
    setCategory('places');
    setStatus('want_to_try');
    setRecommendedBy('');
    setPostToFeed(true);
    setRating(0);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;

    setLoading(true);
    try {
      let postId: string | null = null;
      
      // Prepare enhanced fields
      const enhancedFields = {
        rating: rating > 0 ? rating : undefined,
        recommendedBy: recommendedBy.trim() || undefined,
      };

      // Always create a personal item
      const personalItemId = await createPersonalItem(
        user.uid,
        category,
        title,
        description.trim() || undefined,
        enhancedFields,
        undefined // No post linking for manual items
      );
      
      // Create personal item for local store
      const personalItem: PersonalItem = {
        id: personalItemId,
        userId: user.uid,
        category,
        title,
        description: description.trim() || '',
        status,
        createdAt: Timestamp.now(),
        source: 'personal',
        // Include enhanced fields
        ...(recommendedBy.trim() && { recommendedBy: recommendedBy.trim() }),
        ...(rating > 0 && { rating }),
      };
      
      // If user wants to post to feed, create a post too
      if (postToFeed) {
        postId = await createPost(
          user.uid,
          userProfile.name,
          category,
          title,
          description.trim() || undefined,
          enhancedFields
        );
        
        // Add to posts store
        const newPost = {
          id: postId,
          authorId: user.uid,
          authorName: userProfile.name,
          category,
          title,
          description: description.trim() || '',
          createdAt: Timestamp.now(),
          savedBy: [],
          postType: 'manual' as const,
          ...(recommendedBy.trim() && { recommendedBy: recommendedBy.trim() }),
        };
        addPost(newPost);
        
        // Update personal item with shared post ID if completed
        if (status === 'completed') {
          personalItem.sharedPostId = postId;
          personalItem.status = 'shared';
        }
      }
      
      // Add personal item to store
      addPersonalItem(personalItem);

      // Check if we should offer SMS invite for non-user recommender
      console.log(`🔍 SMS Invite Debug:`, {
        recommendedBy: recommendedBy.trim(),
        shouldOffer: shouldOfferSMSInvite(recommendedBy.trim()),
        postId,
        postToFeed,
        personalItemId
      });
      
      if (recommendedBy.trim() && shouldOfferSMSInvite(recommendedBy.trim())) {
        if (postToFeed && postId) {
          // For shared posts, use the post ID
          console.log(`✅ Setting up SMS invite for shared post: ${postId}`);
          setInviteData({
            recommenderName: recommendedBy.trim(),
            postTitle: title,
            postId: postId,
            isPost: true
          });
          setShowInviteDialog(true);
          // Don't reset form yet - wait for invite dialog to be handled
          return;
        } else if (!postToFeed) {
          // For private items, use the personal item ID
          console.log(`✅ Setting up SMS invite for private item: ${personalItemId}`);
          setInviteData({
            recommenderName: recommendedBy.trim(),
            postTitle: title,
            postId: personalItemId,
            isPost: false
          });
          setShowInviteDialog(true);
          // Don't reset form yet - wait for invite dialog to be handled
          return;
        } else {
          console.log(`❌ SMS Invite: postToFeed=true but no postId`);
        }
      }

      // Only reset form and show success if no invite dialog was shown
      // Reset form
      setTitle('');
      setDescription('');
      setCategory('places');
      setStatus('want_to_try');
      setRecommendedBy('');
      setPostToFeed(true);
      // Reset enhanced fields
      setRating(0);
      setSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error creating item:', error);
    } finally {
      setLoading(false);
    }
  };

  // Render different screens based on mode
  if (mode === 'book-search') {
    return (
      <BookSearch 
        onBookSelect={handleBookSelect}
        onBack={handleBackToSelection}
      />
    );
  }
  
  if (mode === 'book-form' && selectedBook) {
    return (
      <StructuredPostForm
        universalItem={selectedBook}
        onBack={handleBackToSelection}
        onSuccess={handleStructuredSuccess}
      />
    );
  }
  
  if (mode === 'movie-search') {
    return (
      <MovieSearch 
        onMovieSelect={handleMovieSelect}
        onBack={handleBackToSelection}
      />
    );
  }
  
  if (mode === 'movie-form' && selectedMovie) {
    return (
      <StructuredPostForm
        universalItem={selectedMovie}
        onBack={handleBackToSelection}
        onSuccess={handleStructuredSuccess}
      />
    );
  }
  
  if (mode === 'places-search') {
    return (
      <PlacesSearch 
        onPlaceSelect={handlePlaceSelect}
        onBack={handleBackToSelection}
      />
    );
  }
  
  if (mode === 'places-form' && selectedPlace) {
    return (
      <StructuredPostForm
        universalItem={selectedPlace}
        onBack={handleBackToSelection}
        onSuccess={handleStructuredSuccess}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 py-6">
        <div className="max-w-lg mx-auto">
          {/* Post Type Selection */}
          {mode === 'selection' && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Add Something New
                </h2>
              </div>

              <div className="space-y-4 mb-8">
                {/* Places Search Option */}
                <button
                  onClick={handlePlacesSearch}
                  className="w-full p-6 border-2 border-green-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <MapPinIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        📍 Place
                      </h3>
                    </div>
                  </div>
                </button>

                {/* Book Search Option */}
                <button
                  onClick={handleBookSearch}
                  className="w-full p-6 border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <BookOpenIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        📚 Book
                      </h3>
                    </div>
                  </div>
                </button>

                {/* Movie Search Option */}
                <button
                  onClick={handleMovieSearch}
                  className="w-full p-6 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <FilmIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        🎬 Movie or TV Show
                      </h3>
                    </div>
                  </div>
                </button>

                {/* Custom Post Option */}
                <button
                  onClick={handleCustomForm}
                  className="w-full p-6 border-2 border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <PlusIcon className="h-6 w-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        ✨ Other
                      </h3>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Custom Form */}
          {mode === 'custom-form' && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-6">
                {/* Header */}
                <div className="flex items-center mb-6">
                  <button
                    onClick={handleBackToSelection}
                    className="mr-4 text-gray-600 hover:text-gray-800"
                  >
                    ← Back
                  </button>
                  <h2 className="text-xl font-bold text-gray-900">Add to Your List</h2>
                </div>

                {success && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 text-center font-medium">
                      🎉 Successfully added to your list!
                    </p>
                  </div>
                )}

                {/* Title Input */}
                <div className="mb-6">
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What would you like to add?"
                    required
                    maxLength={100}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {title.length}/100 characters
                  </p>
                </div>

                {/* Post Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Status Selection */}
                  <div>
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
                        <div className="font-medium">📝 To Do</div>
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

                  {/* Rating (only for completed) */}
                  {status === 'completed' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        How would you rate it? (optional)
                      </label>
                      <StarRating rating={rating} onRatingChange={setRating} />
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                      Description <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={500}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder:text-gray-500"
                      placeholder="Tell us more about this... (optional)"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {description.length}/500 characters
                    </p>
                  </div>

                  {/* Recommended By */}
                  <div>
                    <label htmlFor="recommendedBy" className="block text-sm font-medium text-gray-700 mb-2">
                      🤝 Recommended by <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      id="recommendedBy"
                      placeholder="Who recommended this to you?"
                      value={recommendedBy}
                      onChange={(e) => setRecommendedBy(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
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
                        Share with friends on the feed
                      </span>
                    </label>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={handleBackToSelection}
                      className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !title.trim()}
                      className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? 'Adding...' : 
                       postToFeed ? (status === 'completed' ? 'Add & Share' : 'Add & Share') : 'Add to List'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
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