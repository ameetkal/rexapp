'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore, useAppStore } from '@/lib/store';
import { getPersonalItems, createPersonalItem } from '@/lib/firestore';
import { Timestamp } from 'firebase/firestore';
import PersonalItemCard from './PersonalItemCard';
import { CATEGORIES, Category } from '@/lib/types';
import { ListBulletIcon, PlusIcon } from '@heroicons/react/24/outline';

export default function SavedScreen() {
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  
  // Add Item Form State
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [newItemCategory, setNewItemCategory] = useState<Category>('restaurants');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  
  const { user } = useAuthStore();
  const { setPersonalItems, getSavedItems, addPersonalItem } = useAppStore();

  const loadPersonalItems = useCallback(async () => {
    if (!user) return;
    
    try {
      const items = await getPersonalItems(user.uid);
      setPersonalItems(items);
    } catch (error) {
      console.error('Error loading personal items:', error);
    } finally {
      setLoading(false);
    }
  }, [user, setPersonalItems]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPersonalItems();
    setRefreshing(false);
  };

  useEffect(() => {
    if (user) {
      loadPersonalItems();
    }
  }, [user, loadPersonalItems]);

  // Get only "want to try" items
  const savedItems = getSavedItems();
  
  const filteredItems = selectedCategory === 'all' 
    ? savedItems 
    : savedItems.filter(item => item.category === selectedCategory);

  const getCategoryCount = (category: Category | 'all') => {
    if (category === 'all') return savedItems.length;
    return savedItems.filter(item => item.category === category).length;
  };

  const handleAddPersonalItem = async () => {
    if (!user || !newItemTitle.trim() || !newItemDescription.trim()) return;
    
    setAddingItem(true);
    try {
      const itemId = await createPersonalItem(
        user.uid,
        newItemCategory,
        newItemTitle,
        newItemDescription
      );
      
      const newItem = {
        id: itemId,
        userId: user.uid,
        category: newItemCategory,
        title: newItemTitle,
        description: newItemDescription,
        status: 'want_to_try' as const,
        createdAt: Timestamp.now(),
        source: 'personal' as const,
      };
      
      addPersonalItem(newItem);
      
      // Reset form
      setNewItemTitle('');
      setNewItemDescription('');
      setShowAddItemForm(false);
    } catch (error) {
      console.error('Error adding personal item:', error);
    } finally {
      setAddingItem(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your want to try list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Want to Try</h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        
        <button
          onClick={() => setShowAddItemForm(true)}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Something to Try</span>
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
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <ListBulletIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {selectedCategory === 'all' 
                ? "Nothing on your want to try list yet"
                : `No ${CATEGORIES.find(c => c.id === selectedCategory)?.name.toLowerCase()} items to try`
              }
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              {selectedCategory === 'all'
                ? "Add items you want to try or save recommendations from your friends!"
                : `Add or save ${CATEGORIES.find(c => c.id === selectedCategory)?.name.toLowerCase()} items you want to try.`
              }
            </p>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                How to build your want to try list:
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>• Save friend recommendations from your feed</p>
                <p>• Add personal items in your Profile</p>
                <p>• Mark items complete when you try them</p>
                <p>• Share completed items as recommendations</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <PersonalItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Add Personal Item Modal */}
      {showAddItemForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Something to Try</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value as Category)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.emoji} {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What do you want to try?
                </label>
                <input
                  type="text"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder="e.g. Tanuki Ramen in Chinatown"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Why do you want to try this?
                </label>
                <textarea
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  rows={3}
                  placeholder="Heard great things about their tonkotsu ramen..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddItemForm(false);
                  setNewItemTitle('');
                  setNewItemDescription('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPersonalItem}
                disabled={addingItem || !newItemTitle.trim() || !newItemDescription.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {addingItem ? 'Adding...' : 'Add to List'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 