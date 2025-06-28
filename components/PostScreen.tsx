'use client';

import { useState } from 'react';
import { useAuthStore, useAppStore } from '@/lib/store';
import { createPost } from '@/lib/firestore';
import { CATEGORIES, Category } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

export default function PostScreen() {
  const [category, setCategory] = useState<Category>('restaurants');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const { user, userProfile } = useAuthStore();
  const { addPost } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;

    setLoading(true);
    try {
      const postId = await createPost(
        user.uid,
        userProfile.name,
        category,
        title,
        description
      );

      // Add to local store
      const newPost = {
        id: postId,
        authorId: user.uid,
        authorName: userProfile.name,
        category,
        title,
        description,
        createdAt: Timestamp.now(),
        savedBy: [],
      };
      addPost(newPost);

      // Reset form
      setTitle('');
      setDescription('');
      setCategory('restaurants');
      setSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 py-6">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Share a Recommendation
            </h2>
            <p className="text-gray-600">
              Help your friends discover something amazing
            </p>
          </div>

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-center font-medium">
                🎉 Recommendation shared successfully!
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="What are you recommending?"
              />
              <p className="text-xs text-gray-500 mt-1">
                {title.length}/100 characters
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={500}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Tell your friends why they should try this..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {description.length}/500 characters
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !title.trim() || !description.trim()}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Sharing...' : 'Share Recommendation'}
            </button>
          </form>

          {/* Tips */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              💡 Tips for great recommendations:
            </h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Be specific about what makes it special</li>
              <li>• Include details like location, genre, or style</li>
              <li>• Explain why your friends would love it</li>
              <li>• Keep it concise and engaging</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 