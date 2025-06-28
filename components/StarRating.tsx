'use client';

import { useState } from 'react';
import { StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface StarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  maxRating?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function StarRating({ 
  rating, 
  onRatingChange, 
  maxRating = 10,
  showLabel = true,
  size = 'md'
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);
  
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };
  
  const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const handleClick = (value: number) => {
    onRatingChange(value);
  };

  const handleMouseEnter = (value: number) => {
    setHoverRating(value);
  };

  const handleMouseLeave = () => {
    setHoverRating(0);
  };

  const getStarColor = (starValue: number) => {
    const activeRating = hoverRating || rating;
    if (starValue <= activeRating) {
      // Gold for filled stars
      return 'text-yellow-400';
    }
    return 'text-gray-300';
  };

  const getStarIcon = (starValue: number) => {
    const activeRating = hoverRating || rating;
    return starValue <= activeRating ? StarIconSolid : StarIcon;
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-1">
        {Array.from({ length: maxRating }, (_, index) => {
          const starValue = index + 1;
          const StarComponent = getStarIcon(starValue);
          
          return (
            <button
              key={starValue}
              type="button"
              onClick={() => handleClick(starValue)}
              onMouseEnter={() => handleMouseEnter(starValue)}
              onMouseLeave={handleMouseLeave}
              className={`${getStarColor(starValue)} ${sizeClasses[size]} hover:scale-110 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded`}
            >
              <StarComponent className="w-full h-full" />
            </button>
          );
        })}
      </div>
      
      {showLabel && (
        <span className={`${labelSizeClasses[size]} font-medium text-gray-700`}>
          {rating > 0 ? `${rating}/${maxRating}` : 'No rating'}
        </span>
      )}
    </div>
  );
} 