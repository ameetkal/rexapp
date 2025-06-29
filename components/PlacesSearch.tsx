'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { searchGooglePlaces } from '@/lib/firestore';
import { UniversalItem } from '@/lib/types';
import { MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline';

interface PlacesSearchProps {
  onPlaceSelect: (place: UniversalItem) => void;
  onBack: () => void;
}

export default function PlacesSearch({ onPlaceSelect, onBack }: PlacesSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [places, setPlaces] = useState<UniversalItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        performSearch(searchTerm);
      } else {
        setPlaces([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const performSearch = async (query: string) => {
    setSearching(true);
    setShowResults(true);
    try {
      const results = await searchGooglePlaces(query);
      setPlaces(results);
    } catch (error) {
      console.error('Error searching places:', error);
      setPlaces([]);
    } finally {
      setSearching(false);
    }
  };

  const handlePlaceSelect = (place: UniversalItem) => {
    console.log('📍 Selected place:', place.title);
    onPlaceSelect(place);
  };

  const getPlaceTypeIcon = (type?: string) => {
    switch (type) {
      case 'restaurant': return '🍕';
      case 'cafe': return '☕';
      case 'bar': return '🍸';
      case 'tourist_attraction': return '🏛️';
      case 'lodging': return '🏨';
      case 'store': return '🛍️';
      case 'museum': return '🏛️';
      case 'park': return '🌳';
      default: return '📍';
    }
  };

  const getPlaceTypeLabel = (type?: string) => {
    switch (type) {
      case 'restaurant': return 'Restaurant';
      case 'cafe': return 'Cafe';
      case 'bar': return 'Bar';
      case 'tourist_attraction': return 'Attraction';
      case 'lodging': return 'Hotel';
      case 'store': return 'Store';
      case 'museum': return 'Museum';
      case 'park': return 'Park';
      default: return 'Place';
    }
  };

  const getPriceLevelDisplay = (level?: number) => {
    if (!level) return null;
    return '$'.repeat(level);
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
          <h2 className="text-xl font-bold text-gray-900">Find a Place</h2>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for restaurants, attractions, cafes..."
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
            {places.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  📍 Select a place ({places.length} found)
                </h3>
                {places.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => handlePlaceSelect(place)}
                    className="w-full p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="flex space-x-4">
                      <div className="flex-shrink-0">
                        {place.image ? (
                          <Image
                            src={place.image}
                            alt={place.title}
                            width={48}
                            height={48}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                            <MapPinIcon className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">
                            {place.title}
                          </h4>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                            {getPlaceTypeIcon(place.metadata.placeType)} {getPlaceTypeLabel(place.metadata.placeType)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-sm text-gray-600 mb-1">
                          {place.metadata.rating && (
                            <span className="flex items-center">
                              ⭐ {place.metadata.rating}/5
                            </span>
                          )}
                          {place.metadata.priceLevel && (
                            <span className="text-green-600 font-medium">
                              {getPriceLevelDisplay(place.metadata.priceLevel)}
                            </span>
                          )}
                        </div>
                        {place.metadata.address && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                            📍 {place.metadata.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : !searching && searchTerm.trim() ? (
              <div className="text-center py-12">
                <MapPinIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No places found
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
            <MapPinIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Search for places
            </h3>
            <p className="text-gray-500 mb-6">
              Find restaurants, attractions, cafes, and more
            </p>
            <div className="text-sm text-gray-400 space-y-1">
              <p>• Try searching: &quot;pizza near me&quot;</p>
              <p>• Or specific places: &quot;Statue of Liberty&quot;</p>
              <p>• Or by city: &quot;restaurants in Paris&quot;</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 