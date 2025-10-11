'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { getUserThingInteractionsWithThings, getUserRecsGivenCount, followUser, unfollowUser } from '@/lib/firestore';
import { getUserProfile } from '@/lib/auth';
import { UserThingInteraction, Thing, Category, CATEGORIES, User } from '@/lib/types';
import { MagnifyingGlassIcon, ListBulletIcon, DevicePhoneMobileIcon, CogIcon, ArrowLeftIcon, UserPlusIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import ThingInteractionCard from './ThingInteractionCard';
import PWAInstallPrompt from './PWAInstallPrompt';
import { usePWAInstallStatus } from './PWAInstallStatus';

interface ProfileScreenProps {
  viewingUserId?: string; // If provided, shows that user's profile; otherwise shows own profile
  onShowFollowingList?: () => void;
  onUserClick?: (userId: string) => void;
  onSettingsClick?: () => void;
  onEditInteraction?: (interaction: UserThingInteraction, thing: Thing) => void;
  onBack?: () => void; // For going back when viewing other's profile
}

export default function ProfileScreen({ viewingUserId, onShowFollowingList, onSettingsClick, onEditInteraction, onBack }: ProfileScreenProps) {
  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [recsGivenCount, setRecsGivenCount] = useState(0);
  const [userInteractions, setUserInteractions] = useState<UserThingInteraction[]>([]);
  const [things, setThings] = useState<Thing[]>([]);
  const [viewingUserProfile, setViewingUserProfile] = useState<User | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  
  // State and Category filters (removed 'inProgress')
  const [selectedState, setSelectedState] = useState<'all' | 'bucketList' | 'completed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  
  const { user, userProfile, setUserProfile } = useAuthStore();
  const { isInstalled, isLoading } = usePWAInstallStatus();
  
  // Determine if viewing own profile or someone else's
  const isOwnProfile = !viewingUserId || viewingUserId === user?.uid;
  const displayedProfile = isOwnProfile ? userProfile : viewingUserProfile;
  const displayedUserId = isOwnProfile ? user?.uid : viewingUserId;

  // Load viewing user's profile data (if viewing someone else)
  useEffect(() => {
    const loadViewingUser = async () => {
      if (!viewingUserId || viewingUserId === user?.uid) {
        setViewingUserProfile(null);
        return;
      }
      
      try {
        const profile = await getUserProfile(viewingUserId);
        setViewingUserProfile(profile);
      } catch (error) {
        console.error('Error loading viewing user profile:', error);
      }
    };
    
    loadViewingUser();
  }, [viewingUserId, user]);

  const loadUserActivity = useCallback(async () => {
    if (!displayedUserId) return;
    
    try {
      const { interactions, things: thingsData } = await getUserThingInteractionsWithThings(displayedUserId);
      
      // If viewing someone else's profile, filter to only public/friends visibility
      const visibleInteractions = isOwnProfile 
        ? interactions 
        : interactions.filter(i => i.visibility === 'public' || i.visibility === 'friends');
      
      setUserInteractions(visibleInteractions);
      setThings(thingsData);
    } catch (error) {
      console.error('Error loading user activity:', error);
    }
  }, [displayedUserId, isOwnProfile]);

  const loadRecsGivenCount = useCallback(async () => {
    if (!displayedUserId) return;
    
    try {
      const count = await getUserRecsGivenCount(displayedUserId);
      setRecsGivenCount(count);
    } catch (error) {
      console.error('Error loading recs given count:', error);
    }
  }, [displayedUserId]);

  useEffect(() => {
    loadUserActivity();
    loadRecsGivenCount();
  }, [loadUserActivity, loadRecsGivenCount]);





  // Follow/Unfollow handlers
  const handleFollowToggle = async () => {
    if (!user || !userProfile || !viewingUserProfile) return;
    
    setFollowLoading(true);
    try {
      const isFollowing = userProfile.following.includes(viewingUserProfile.id);
      
      if (isFollowing) {
        await unfollowUser(user.uid, viewingUserProfile.id);
        setUserProfile({
          ...userProfile,
          following: userProfile.following.filter(id => id !== viewingUserProfile.id)
        });
      } else {
        await followUser(user.uid, viewingUserProfile.id);
        setUserProfile({
          ...userProfile,
          following: [...userProfile.following, viewingUserProfile.id]
        });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const isFollowing = userProfile && viewingUserProfile 
    ? userProfile.following.includes(viewingUserProfile.id) 
    : false;

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
  const getStateCount = (state: 'all' | 'bucketList' | 'completed') => {
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
          {/* Back Button - Top Left (for other's profile) */}
          {!isOwnProfile && (
            <div className="absolute top-0 left-0">
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Back"
              >
                <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
              </button>
            </div>
          )}
          
          {/* Settings - Top Right (for own profile) */}
          {isOwnProfile && (
            <div className="absolute top-0 right-0">
              <button
                onClick={onSettingsClick}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Settings"
              >
                <CogIcon className="h-6 w-6 text-gray-600" />
              </button>
            </div>
          )}
          
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            {displayedProfile?.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{displayedProfile?.name}</h2>
          <p className="text-gray-600 text-sm">
            {displayedProfile?.username ? `@${displayedProfile.username}` : 'Setting up...'}
          </p>
          <div className="flex justify-center space-x-4 mt-4">
            <div className="text-center">
              {(displayedProfile?.following.length || 0) > 0 && onShowFollowingList && isOwnProfile ? (
                <button
                  onClick={onShowFollowingList}
                  className="text-center hover:opacity-75 transition-opacity"
                >
                  <div className="text-xl font-bold text-blue-600">{displayedProfile?.following.length || 0}</div>
                  <div className="text-sm text-gray-500">Following</div>
                </button>
              ) : (
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{displayedProfile?.following.length || 0}</div>
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
          
          {/* Follow/Unfollow Button - Below Stats (for other's profile) */}
          {!isOwnProfile && (
            <div className="mt-4">
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`w-full max-w-xs mx-auto px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center ${
                  isFollowing
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {followLoading ? (
                  'Loading...'
                ) : isFollowing ? (
                  <>
                    <UserMinusIcon className="h-5 w-5 mr-2" />
                    Unfollow
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="h-5 w-5 mr-2" />
                    Follow
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* PWA Install Prompt - Only show for own profile when not installed */}
        {isOwnProfile && !isLoading && !isInstalled && (
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
              { id: 'completed', label: 'Completed', icon: '✅' },
            ].map((state) => {
              const count = getStateCount(state.id as 'all' | 'bucketList' | 'completed');
              return (
                <button
                  key={state.id}
                  onClick={() => setSelectedState(state.id as 'all' | 'bucketList' | 'completed')}
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
          
          {/* Category Dropdown & Search Row */}
          <div className="mb-4 flex items-center space-x-3">
            {/* Category Dropdown */}
            <div className="flex-shrink-0">
              <label htmlFor="category-select" className="sr-only">Category</label>
              <select
                id="category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as Category | 'all')}
                className="px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
              >
                <option value="all">All Categories ({getCategoryCount('all')})</option>
                {CATEGORIES.map((category) => {
                  const count = getCategoryCount(category.id);
                  return (
                    <option key={category.id} value={category.id}>
                      {category.emoji} {category.name} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
            
            {/* Activity Search */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={activitySearchTerm}
                onChange={(e) => setActivitySearchTerm(e.target.value)}
                placeholder="Search your activities..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500"
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
    </div>
  );
} 