'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { searchGoogleBooks } from '@/lib/firestore';
import { UniversalItem } from '@/lib/types';
import { MagnifyingGlassIcon, BookOpenIcon } from '@heroicons/react/24/outline';

interface BookSearchProps {
  onBookSelect: (book: UniversalItem) => void;
  onBack: () => void;
}

export default function BookSearch({ onBookSelect, onBack }: BookSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [books, setBooks] = useState<UniversalItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        performSearch(searchTerm);
      } else {
        setBooks([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const performSearch = async (query: string) => {
    setSearching(true);
    setShowResults(true);
    try {
      const results = await searchGoogleBooks(query);
      setBooks(results);
    } catch (error) {
      console.error('Error searching books:', error);
      setBooks([]);
    } finally {
      setSearching(false);
    }
  };

  const handleBookSelect = (book: UniversalItem) => {
    console.log('📚 Selected book:', book.title);
    onBookSelect(book);
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
          <h2 className="text-xl font-bold text-gray-900">Find a Book</h2>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for a book title, author, or ISBN..."
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
            {books.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  📚 Select a book ({books.length} found)
                </h3>
                {books.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => handleBookSelect(book)}
                    className="w-full p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="flex space-x-4">
                      <div className="flex-shrink-0">
                        {book.image ? (
                          <Image
                            src={book.image}
                            alt={book.title}
                            width={48}
                            height={64}
                            className="w-12 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center">
                            <BookOpenIcon className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 mb-1">
                          {book.title}
                        </h4>
                        {book.metadata.author && (
                          <p className="text-sm text-gray-600 mb-1">
                            by {book.metadata.author}
                          </p>
                        )}
                        {book.metadata.publishedDate && (
                          <p className="text-xs text-gray-500">
                            Published: {book.metadata.publishedDate}
                          </p>
                        )}
                        {book.description && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                            {book.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : !searching && searchTerm.trim() ? (
              <div className="text-center py-12">
                <BookOpenIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No books found
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
            <BookOpenIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Search for a book
            </h3>
            <p className="text-gray-500 mb-6">
              Start typing to find the book you want to recommend
            </p>
            <div className="text-sm text-gray-400 space-y-1">
              <p>• Try searching by title: &quot;Harry Potter&quot;</p>
              <p>• Or by author: &quot;J.K. Rowling&quot;</p>
              <p>• Or by ISBN for exact matches</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 