'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore, useAppStore } from '@/lib/store';
import { getSavedPosts } from '@/lib/firestore';
import PostCard from './PostCard';
import { CATEGORIES, Category } from '@/lib/types';
import { BookmarkIcon } from '@heroicons/react/24/outline';

export default function SavedScreen() {
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  
  const { user } = useAuthStore();
  const { savedPosts, setSavedPosts } = useAppStore();

  const loadSavedPosts = useCallback(async () => {
    if (!user) return;
    
    try {
      const posts = await getSavedPosts(user.uid);
      setSavedPosts(posts);
    } catch (error) {
      console.error('Error loading saved posts:', error);
    } finally {
      setLoading(false);
    }
  }, [user, setSavedPosts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSavedPosts();
    setRefreshing(false);
  };

  useEffect(() => {
    if (user) {
      loadSavedPosts();
    }
  }, [user, loadSavedPosts]);

  const filteredPosts = selectedCategory === 'all' 
    ? savedPosts 
    : savedPosts.filter(post => post.category === selectedCategory);

  const getCategoryCount = (category: Category | 'all') => {
    if (category === 'all') return savedPosts.length;
    return savedPosts.filter(post => post.category === category).length;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your saved recommendations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Saved</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-blue-600 hover:text-blue-700 font-medium text-sm disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Category Filter */}
      <div className="px-4 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex space-x-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center space-x-1 ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span>All</span>
            <span className="text-xs">({getCategoryCount('all')})</span>
          </button>
          
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center space-x-1 ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span>{category.emoji}</span>
              <span>{category.name}</span>
              <span className="text-xs">({getCategoryCount(category.id)})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <BookmarkIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {selectedCategory === 'all' 
                ? "No saved recommendations yet"
                : `No saved ${CATEGORIES.find(c => c.id === selectedCategory)?.name.toLowerCase()} recommendations`
              }
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              {selectedCategory === 'all'
                ? "Start saving recommendations from your feed to build your personal backlog."
                : `Save ${CATEGORIES.find(c => c.id === selectedCategory)?.name.toLowerCase()} recommendations from your feed to see them here.`
              }
            </p>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                How to save recommendations:
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>• Tap the bookmark icon on any post in your feed</p>
                <p>• Build your personal backlog of trusted recommendations</p>
                <p>• Reference them anytime you need ideas</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 