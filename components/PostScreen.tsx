'use client';

import { useState } from 'react';
import { useAuthStore, useAppStore } from '@/lib/store';
import { createPost, createPersonalItem } from '@/lib/firestore';
import { CATEGORIES, Category, PersonalItemStatus, PersonalItem, UniversalItem } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { ChevronDownIcon, ChevronUpIcon, BookOpenIcon, FilmIcon, PlusIcon } from '@heroicons/react/24/outline';
import StarRating from './StarRating';
import UserTagInput from './UserTagInput';
import BookSearch from './BookSearch';
import MovieSearch from './MovieSearch';
import StructuredPostForm from './StructuredPostForm';

type PostMode = 'selection' | 'book-search' | 'book-form' | 'movie-search' | 'movie-form' | 'custom-form';

export default function PostScreen() {
  // Post creation mode state
  const [mode, setMode] = useState<PostMode>('selection');
  const [selectedBook, setSelectedBook] = useState<UniversalItem | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<UniversalItem | null>(null);
  
  // Existing form state
  const [category, setCategory] = useState<Category>('restaurants');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<PersonalItemStatus>('want_to_try');
  const [recommendedBy, setRecommendedBy] = useState('');
  const [postToFeed, setPostToFeed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Enhanced optional fields
  const [showDetails, setShowDetails] = useState(false);
  const [rating, setRating] = useState(0);
  const [location, setLocation] = useState('');
  const [priceRange, setPriceRange] = useState<'$' | '$$' | '$$$' | '$$$$' | ''>('');
  const [customPrice, setCustomPrice] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [experienceDate, setExperienceDate] = useState('');
  const [taggedUsers, setTaggedUsers] = useState<Array<{id: string; name: string; email: string}>>([]);
  const [taggedNonUsers, setTaggedNonUsers] = useState<Array<{name: string; email?: string}>>([]);
  
  const { user, userProfile } = useAuthStore();
  const { addPost, addPersonalItem } = useAppStore();

  // Mode handlers
  const handleBookSearch = () => setMode('book-search');
  const handleMovieSearch = () => setMode('movie-search');
  const handleCustomForm = () => setMode('custom-form');
  const handleBackToSelection = () => {
    setMode('selection');
    setSelectedBook(null);
    setSelectedMovie(null);
  };
  
  const handleBookSelect = (book: UniversalItem) => {
    setSelectedBook(book);
    setMode('book-form');
  };
  
  const handleMovieSelect = (movie: UniversalItem) => {
    setSelectedMovie(movie);
    setMode('movie-form');
  };
  
  const handleStructuredSuccess = () => {
    setMode('selection');
    setSelectedBook(null);
    setSelectedMovie(null);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  // Helper functions for managing enhanced fields
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

  // Dynamic button text
  const getButtonText = () => {
    if (loading) {
      return status === 'want_to_try' ? 'Adding...' : 'Saving...';
    }
    
    if (status === 'want_to_try') {
      return 'Add to My List';
    }
    
    if (postToFeed) {
      return 'Save & Share';
    }
    
    return 'Save to My List';
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
        location: location.trim() || undefined,
        priceRange: priceRange || undefined,
        customPrice: customPrice ? parseFloat(customPrice) : undefined,
        tags: tags.length > 0 ? tags : undefined,
        experienceDate: experienceDate ? new Date(experienceDate) : undefined,
        taggedUsers: taggedUsers.length > 0 ? taggedUsers.map(u => u.id) : undefined,
        taggedNonUsers: taggedNonUsers.length > 0 ? taggedNonUsers : undefined,
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
        ...(location.trim() && { location: location.trim() }),
        ...(priceRange && { priceRange }),
        ...(customPrice && { customPrice: parseFloat(customPrice) }),
        ...(tags.length > 0 && { tags }),
        ...(experienceDate && { experienceDate: Timestamp.fromDate(new Date(experienceDate)) }),
        ...(taggedUsers.length > 0 && { taggedUsers: taggedUsers.map(u => u.id) }),
        ...(taggedNonUsers.length > 0 && { taggedNonUsers }),
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

      // Reset form
      setTitle('');
      setDescription('');
      setCategory('restaurants');
      setStatus('want_to_try');
      setRecommendedBy('');
      setPostToFeed(true);
      // Reset enhanced fields
      setRating(0);
      setLocation('');
      setPriceRange('');
      setCustomPrice('');
      setTags([]);
      setExperienceDate('');
      setTaggedUsers([]);
      setTaggedNonUsers([]);
      setShowDetails(false);
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
                        📚 Find a Book
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
                        🎬 Find a Movie or TV Show
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
                        ✨ Create Custom Post
                      </h3>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Custom Form */}
          {mode === 'custom-form' && (
            <div>
              <div className="flex items-center mb-6">
                <button
                  onClick={handleBackToSelection}
                  className="mr-4 text-gray-600 hover:text-gray-800"
                >
                  ← Back
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Create Custom Post
                  </h2>
                  <p className="text-sm text-gray-600">
                    Track things you want to try or share your experiences
                  </p>
                </div>
              </div>

              {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 text-center font-medium">
                    🎉 Successfully added to your list!
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    id="title"
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

                {/* Category Selector */}
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

                {/* Status Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Status
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="status"
                        value="want_to_try"
                        checked={status === 'want_to_try'}
                        onChange={(e) => setStatus(e.target.value as PersonalItemStatus)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-3 text-sm text-gray-700">
                        📝 Want to try this
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="status"
                        value="completed"
                        checked={status === 'completed'}
                        onChange={(e) => setStatus(e.target.value as PersonalItemStatus)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-3 text-sm text-gray-700">
                        ✅ Already tried this
                      </span>
                    </label>
                  </div>
                </div>

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
                  <label htmlFor="recommendedBy" className="block text-sm font-medium text-gray-700 mb-2">
                    🤝 Recommended by <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="recommendedBy"
                    type="text"
                    value={recommendedBy}
                    onChange={(e) => setRecommendedBy(e.target.value)}
                    maxLength={100}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Sarah, my coworker, TikTok, my mom..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Who suggested this to you?
                  </p>
                </div>

                {/* Post to Feed Option */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={postToFeed}
                      onChange={(e) => setPostToFeed(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      📢 Share with friends on the feed
                    </span>
                  </label>
                </div>

                {/* Enhanced Details Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      ✨ Add Experience Details (Optional)
                    </span>
                    {showDetails ? (
                      <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>

                  {showDetails && (
                    <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
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
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !title.trim()}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {getButtonText()}
                </button>
              </form>

              {/* Tips */}
              <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  💡 Quick posting tips:
                </h3>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• <strong>Title</strong> is all you need to get started</li>
                  <li>• Add details like rating, location, and tags for richer posts</li>
                  <li>• Tag friends to invite them to Rex</li>
                  <li>• Use &quot;Other&quot; category for anything that doesn&apos;t fit elsewhere</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 