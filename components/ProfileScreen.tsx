'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { getUserThingInteractionsWithThings, getUserRecsGivenCount } from '@/lib/firestore';
import { UserThingInteraction, Thing, Category, CATEGORIES } from '@/lib/types';
import { MagnifyingGlassIcon, ListBulletIcon, DevicePhoneMobileIcon, CogIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import ThingInteractionCard from './ThingInteractionCard';
import PWAInstallPrompt from './PWAInstallPrompt';
import { usePWAInstallStatus } from './PWAInstallStatus';
import EditProfileModal from './EditProfileModal';

interface ProfileScreenProps {
  onShowFollowingList: () => void;
  onUserClick?: (userId: string) => void;
  onSettingsClick: () => void;
  onEditInteraction?: (interaction: UserThingInteraction, thing: Thing) => void;
}

export default function ProfileScreen({ onShowFollowingList, onSettingsClick, onEditInteraction }: ProfileScreenProps) {
  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [recsGivenCount, setRecsGivenCount] = useState(0);
  const [userInteractions, setUserInteractions] = useState<UserThingInteraction[]>([]);
  const [things, setThings] = useState<Thing[]>([]);
  
  // NEW: State and Category filters
  const [selectedState, setSelectedState] = useState<'all' | 'bucketList' | 'inProgress' | 'completed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  
  const { user, userProfile } = useAuthStore();
  const { isInstalled, isLoading } = usePWAInstallStatus();

  const loadUserActivity = useCallback(async () => {
    if (!user) return;
    
    try {
      const { interactions, things: thingsData } = await getUserThingInteractionsWithThings(user.uid);
      setUserInteractions(interactions);
      setThings(thingsData);
    } catch (error) {
      console.error('Error loading user activity:', error);
    }
  }, [user]);

  const loadRecsGivenCount = useCallback(async () => {
    if (!user) return;
    
    try {
      const count = await getUserRecsGivenCount(user.uid);
      setRecsGivenCount(count);
    } catch (error) {
      console.error('Error loading recs given count:', error);
    }
  }, [user]);

  useEffect(() => {
    loadUserActivity();
    loadRecsGivenCount();
  }, [loadUserActivity, loadRecsGivenCount]);





  // Filter interactions by state, category, and search
  const filteredInteractions = userInteractions.filter(interaction => {
    // State filter
    if (selectedState !== 'all' && interaction.state !== selectedState) {
      return false;
    }
    
    const thing = things.find(t => t.id === interaction.thingId);
    if (!thing) return false;
    
    // Category filter
    if (selectedCategory !== 'all' && thing.category !== selectedCategory) {
      return false;
    }
    
    // Search filter
    if (activitySearchTerm.trim()) {
      const searchLower = activitySearchTerm.toLowerCase();
      const matchesSearch = 
        thing.title.toLowerCase().includes(searchLower) ||
        (thing.description && thing.description.toLowerCase().includes(searchLower));
      return matchesSearch;
    }
    
    return true;
  });
  
  // Helper to get count for each state
  const getStateCount = (state: 'all' | 'bucketList' | 'inProgress' | 'completed') => {
    if (state === 'all') return userInteractions.length;
    return userInteractions.filter(i => i.state === state).length;
  };
  
  // Helper to get count for each category within current state filter
  const getCategoryCount = (category: Category | 'all') => {
    const stateFiltered = selectedState === 'all' 
      ? userInteractions 
      : userInteractions.filter(i => i.state === selectedState);
    
    if (category === 'all') return stateFiltered.length;
    
    return stateFiltered.filter(interaction => {
      const thing = things.find(t => t.id === interaction.thingId);
      return thing?.category === category;
    }).length;
  };
  
  const completedCount = userInteractions.filter(i => i.state === 'completed').length;

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 py-6">
        {/* User Profile Section */}
        <div className="relative text-center mb-8">
          <div className="absolute top-0 right-0 flex space-x-2">
            <button
              onClick={() => setShowEditProfile(true)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Edit Profile"
            >
              <PencilSquareIcon className="h-6 w-6 text-gray-600" />
            </button>
            <button
              onClick={onSettingsClick}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Settings"
            >
              <CogIcon className="h-6 w-6 text-gray-600" />
            </button>
          </div>
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            {userProfile?.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{userProfile?.name}</h2>
          <p className="text-gray-600 text-sm">
            {userProfile?.username ? `@${userProfile.username}` : 'Setting up...'}
          </p>
          <div className="flex justify-center space-x-4 mt-4">
            <div className="text-center">
              {(userProfile?.following.length || 0) > 0 ? (
                <button
                  onClick={onShowFollowingList}
                  className="text-center hover:opacity-75 transition-opacity"
                >
                  <div className="text-xl font-bold text-blue-600">{userProfile?.following.length || 0}</div>
                  <div className="text-sm text-gray-500">Following</div>
                </button>
              ) : (
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{userProfile?.following.length || 0}</div>
                  <div className="text-sm text-gray-500">Following</div>
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">
                {completedCount || 0}
              </div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">
                {recsGivenCount}
              </div>
              <div className="text-sm text-gray-500">Recs Given</div>
            </div>
          </div>
        </div>

        {/* PWA Install Prompt - Only show when not installed */}
        {!isLoading && !isInstalled && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100 border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DevicePhoneMobileIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      Add Rex to Home Screen
                    </h4>
                    <p className="text-sm text-gray-600">
                      No download needed - works like a native app
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInstallPrompt(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                >
                  Add Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Activities Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Activities</h3>
          </div>
          
          {/* State Filter Tabs */}
          <div className="mb-4 flex space-x-2 overflow-x-auto pb-2">
            {[
              { id: 'all', label: 'All', icon: '📋' },
              { id: 'bucketList', label: 'To Do', icon: '📝' },
              { id: 'inProgress', label: 'In Progress', icon: '▶️' },
              { id: 'completed', label: 'Completed', icon: '✅' },
            ].map((state) => {
              const count = getStateCount(state.id as 'all' | 'bucketList' | 'inProgress' | 'completed');
              return (
                <button
                  key={state.id}
                  onClick={() => setSelectedState(state.id as 'all' | 'bucketList' | 'inProgress' | 'completed')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedState === state.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {state.icon} {state.label} ({count})
                </button>
              );
            })}
          </div>
          
          {/* Category Filter Pills */}
          <div className="mb-4 flex space-x-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({getCategoryCount('all')})
            </button>
            {CATEGORIES.map((category) => {
              const count = getCategoryCount(category.id);
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.emoji} {category.name} ({count})
                </button>
              );
            })}
          </div>
          
          {/* Activity Search */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                value={activitySearchTerm}
                onChange={(e) => setActivitySearchTerm(e.target.value)}
                placeholder="Search your activities..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
          </div>

          {/* Activity Items List */}
          {filteredInteractions.length === 0 ? (
            <div className="text-center py-8">
              <ListBulletIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              {activitySearchTerm.trim() ? (
                <>
                  <p className="text-gray-500">
                    No activities match &quot;{activitySearchTerm}&quot;
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Try different keywords or clear the search
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gray-500">
                    You haven&apos;t completed anything yet
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Complete items from your Bucket List to see them here
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInteractions.map((interaction) => {
                const thing = things.find(t => t.id === interaction.thingId);
                if (!thing) return null;
                
                return (
                  <ThingInteractionCard
                    key={interaction.id}
                    thing={thing}
                    interaction={interaction}
                    onEdit={onEditInteraction}
                  />
                );
              })}
            </div>
          )}
        </div>




              </div>
        
      {/* PWA Install Prompt */}
      {showInstallPrompt && (
        <PWAInstallPrompt onDismiss={() => setShowInstallPrompt(false)} />
      )}

      {/* Edit Profile Modal */}
      <EditProfileModal 
        isOpen={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />

    </div>
  );
} 