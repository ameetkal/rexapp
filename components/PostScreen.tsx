'use client';

import { useState } from 'react';
import { UniversalItem } from '@/lib/types';
import { BookOpenIcon, FilmIcon, MapPinIcon, PlusIcon } from '@heroicons/react/24/outline';
import BookSearch from './BookSearch';
import MovieSearch from './MovieSearch';
import PlacesSearch from './PlacesSearch';
import PostForm from './PostForm';

type PostMode = 'selection' | 'book-search' | 'book-form' | 'movie-search' | 'movie-form' | 'places-search' | 'places-form' | 'custom-form';

export default function PostScreen() {
  // Post creation mode state
  const [mode, setMode] = useState<PostMode>('selection');
  const [selectedBook, setSelectedBook] = useState<UniversalItem | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<UniversalItem | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<UniversalItem | null>(null);

  // Mode handlers
  const handleBookSearch = () => setMode('book-search');
  const handleMovieSearch = () => setMode('movie-search');
  const handlePlacesSearch = () => setMode('places-search');
  const handleCustomForm = () => {
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
      <PostForm
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
      <PostForm
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
      <PostForm
        universalItem={selectedPlace}
        onBack={handleBackToSelection}
        onSuccess={handleStructuredSuccess}
      />
    );
  }
  
  if (mode === 'custom-form') {
    return (
      <PostForm
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
                <p className="text-gray-600">
                  Share something you want to do or have already done
                </p>
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

        </div>
      </div>

    </div>
  );
} 