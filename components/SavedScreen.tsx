'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore, useAppStore } from '@/lib/store';
import { getPersonalItems, getUserThingInteractionsWithThings } from '@/lib/firestore';
import PersonalItemCard from './PersonalItemCard';
import PersonalItemDetailModal from './PersonalItemDetailModal';
import ThingInteractionCard from './ThingInteractionCard';
import { CATEGORIES, Category, UserThingInteraction, Thing } from '@/lib/types';
import { ListBulletIcon } from '@heroicons/react/24/outline';

export default function SavedScreen() {
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [useNewSystem, setUseNewSystem] = useState(false);
  
  // NEW SYSTEM STATE
  const [userInteractions, setUserInteractions] = useState<UserThingInteraction[]>([]);
  const [things, setThings] = useState<Thing[]>([]);
  
  const { user } = useAuthStore();
  const { setPersonalItems, getSavedItems } = useAppStore();

  const loadPersonalItems = useCallback(async () => {
    if (!user) return;
    
    try {
      // Load OLD system personal items
      console.log('📋 Loading OLD system personal items...');
      const items = await getPersonalItems(user.uid);
      setPersonalItems(items);
      
      // Load NEW system user interactions
      console.log('🚀 Loading NEW system user interactions...');
      const { interactions, things: thingsData } = await getUserThingInteractionsWithThings(user.uid);
      setUserInteractions(interactions);
      setThings(thingsData);
      
      console.log(`✅ Loaded ${items.length} old items and ${interactions.length} new interactions`);
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

  // Get items based on system
  const bucketListInteractions = userInteractions.filter(i => i.state === 'bucketList');
  const savedPersonalItems = getSavedItems();
  
  const filteredItems = useNewSystem ? (
    selectedCategory === 'all' 
      ? bucketListInteractions 
      : bucketListInteractions.filter(interaction => {
          const thing = things.find(t => t.id === interaction.thingId);
          return thing?.category === selectedCategory;
        })
  ) : (
    selectedCategory === 'all' 
      ? savedPersonalItems 
      : savedPersonalItems.filter(item => item.category === selectedCategory)
  );

  const getCategoryCount = (category: Category | 'all') => {
    if (category === 'all') {
      return useNewSystem ? bucketListInteractions.length : savedPersonalItems.length;
    }
    
    if (useNewSystem) {
      return bucketListInteractions.filter(interaction => {
        const thing = things.find(t => t.id === interaction.thingId);
        return thing?.category === category;
      }).length;
    } else {
      return savedPersonalItems.filter(item => item.category === category).length;
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
          <h2 className="text-lg font-semibold text-gray-900">Bucket List</h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        

      </div>

      {/* System Toggle */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex justify-center">
          <div className="bg-gray-100 rounded-lg p-1 flex">
            <button
              onClick={() => setUseNewSystem(false)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                !useNewSystem 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Old System
            </button>
            <button
              onClick={() => setUseNewSystem(true)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                useNewSystem 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              New System
            </button>
          </div>
        </div>
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
                <p>• Add personal items using the Add tab</p>
                <p>• Mark items complete when you try them</p>
                <p>• Share completed items as recommendations</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {useNewSystem ? (
              // NEW SYSTEM: Show thing interactions
              (filteredItems as UserThingInteraction[]).map((interaction) => {
                const thing = things.find(t => t.id === interaction.thingId);
                if (!thing) {
                  console.warn('Thing not found for interaction:', interaction.id, 'thingId:', interaction.thingId);
                  return null;
                }
                
                return (
                  <ThingInteractionCard
                    key={interaction.id}
                    thing={thing}
                    interaction={interaction}
                  />
                );
              })
            ) : (
              // OLD SYSTEM: Show personal items
              (filteredItems as typeof savedPersonalItems).map((item) => (
                <PersonalItemCard 
                  key={item.id} 
                  item={item} 
                  onItemClick={(itemId) => setSelectedItemId(itemId)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Personal Item Detail Modal - Only for old system */}
      {selectedItemId && !useNewSystem && (
        <PersonalItemDetailModal
          item={savedPersonalItems.find(item => item.id === selectedItemId)!}
          isOpen={true}
          onClose={() => setSelectedItemId(null)}
        />
      )}
    </div>
  );
} 