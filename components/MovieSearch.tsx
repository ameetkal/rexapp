'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { searchTMDb } from '@/lib/firestore';
import { UniversalItem } from '@/lib/types';
import { MagnifyingGlassIcon, FilmIcon } from '@heroicons/react/24/outline';

interface MovieSearchProps {
  onMovieSelect: (movie: UniversalItem) => void;
  onBack: () => void;
}

export default function MovieSearch({ onMovieSelect, onBack }: MovieSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [movies, setMovies] = useState<UniversalItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        performSearch(searchTerm);
      } else {
        setMovies([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const performSearch = async (query: string) => {
    setSearching(true);
    setShowResults(true);
    try {
      const results = await searchTMDb(query);
      setMovies(results);
    } catch (error) {
      console.error('Error searching movies/TV:', error);
      setMovies([]);
    } finally {
      setSearching(false);
    }
  };

  const handleMovieSelect = (movie: UniversalItem) => {
    console.log('🎬 Selected movie/TV:', movie.title);
    onMovieSelect(movie);
  };

  const getTypeIcon = (type?: string) => {
    if (type === 'tv') return '📺';
    return '🎬';
  };

  const getTypeLabel = (type?: string) => {
    if (type === 'tv') return 'TV Show';
    return 'Movie';
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="mr-4 text-gray-600 hover:text-gray-800"
          >
            ← Back
          </button>
          <h2 className="text-xl font-bold text-gray-900">Find a Movie or TV Show</h2>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for a movie or TV show..."
              className="w-full pl-10 pr-12 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500 text-lg"
              autoFocus
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            {searching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>

        {/* Search Results */}
        {showResults && (
          <div>
            {movies.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  🎬 Select a movie or TV show ({movies.length} found)
                </h3>
                {movies.map((movie) => (
                  <button
                    key={movie.id}
                    onClick={() => handleMovieSelect(movie)}
                    className="w-full p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="flex space-x-4">
                      <div className="flex-shrink-0">
                        {movie.image ? (
                          <Image
                            src={movie.image}
                            alt={movie.title}
                            width={48}
                            height={72}
                            className="w-12 h-18 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-18 bg-gray-200 rounded flex items-center justify-center">
                            <FilmIcon className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">
                            {movie.title}
                          </h4>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                            {getTypeIcon(movie.metadata.type)} {getTypeLabel(movie.metadata.type)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-sm text-gray-600 mb-1">
                          {movie.metadata.year && (
                            <span>{movie.metadata.year}</span>
                          )}
                          {movie.metadata.tmdbRating && (
                            <span className="flex items-center">
                              ⭐ {movie.metadata.tmdbRating}/10
                            </span>
                          )}
                        </div>
                        {movie.description && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                            {movie.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : !searching && searchTerm.trim() ? (
              <div className="text-center py-12">
                <FilmIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No movies or TV shows found
                </h3>
                <p className="text-gray-500 mb-4">
                  Try different keywords or check your spelling
                </p>
                <button
                  onClick={onBack}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Create a custom post instead
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Instructions */}
        {!showResults && (
          <div className="text-center py-12">
            <FilmIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Search for movies & TV shows
            </h3>
            <p className="text-gray-500 mb-6">
              Start typing to find what you want to recommend
            </p>
            <div className="text-sm text-gray-400 space-y-1">
              <p>• Try searching by title: &quot;The Dark Knight&quot;</p>
              <p>• Or TV shows: &quot;Breaking Bad&quot;</p>
              <p>• Or actors: &quot;Tom Hanks&quot;</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 