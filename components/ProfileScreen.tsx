'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuthStore } from '@/lib/store';
import { getUserRecsGivenCount, followUser, unfollowUser } from '@/lib/firestore';
import { UserThingInteraction, Thing, Category, CATEGORIES } from '@/lib/types';
import { MagnifyingGlassIcon, CogIcon, ArrowLeftIcon, UserPlusIcon, UserMinusIcon, BookmarkIcon, CheckCircleIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import ThingInteractionCard from './ThingInteractionCard';
import { useFilteredInteractions, useAnyFilteredInteractions, useAnyUserProfile, useThings } from '@/lib/hooks';
import { dataService } from '@/lib/dataService';

interface ProfileScreenProps {
  viewingUserId?: string; // If provided, shows that user's profile; otherwise shows own profile
  onUserClick?: (userId: string) => void;
  onSettingsClick?: () => void;
  onEditInteraction?: (interaction: UserThingInteraction, thing: Thing) => void;
  onBack?: () => void; // For going back when viewing other's profile
}

export default function ProfileScreen({ viewingUserId, onUserClick, onSettingsClick, onEditInteraction, onBack }: ProfileScreenProps) {
  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [recsGivenCount, setRecsGivenCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  
  // Wrapper function to handle both user IDs and usernames
  const handleUserClick = async (userIdOrUsername: string) => {
    if (!onUserClick) return;
    
    // If it looks like a username (starts with @ or doesn't contain special characters), look up user ID
    if (userIdOrUsername.startsWith('@') || !userIdOrUsername.includes('-')) {
      const username = userIdOrUsername.startsWith('@') ? userIdOrUsername.slice(1) : userIdOrUsername;
      
      try {
        // Search for user by username
        const { searchUsers } = await import('@/lib/firestore');
        const users = await searchUsers(username);
        const matchingUser = users.find(u => u.username === username);
        
        if (matchingUser) {
          onUserClick(matchingUser.id);
        } else {
          console.log('User not found:', username);
        }
      } catch (error) {
        console.error('Error looking up user:', error);
      }
    } else {
      // Assume it's a user ID, pass it directly
      onUserClick(userIdOrUsername);
    }
  };
  
  // State and Category filters
  const [selectedState, setSelectedState] = useState<'all' | 'bucketList' | 'completed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { user, userProfile, setUserProfile } = useAuthStore();
  
  // Determine if viewing own profile or someone else's
  const isOwnProfile = !viewingUserId || viewingUserId === user?.uid;
  const displayedUserId = isOwnProfile ? user?.uid : viewingUserId;
  
  // Use our new custom hooks for clean data access - load once, filter locally
  const { interactions: ownInteractions, loading: ownInteractionsLoading } = useFilteredInteractions(displayedUserId || '', 'all');
  const { interactions: otherInteractions, loading: otherInteractionsLoading } = useAnyFilteredInteractions(displayedUserId || '', 'all');
  
  const allInteractions = isOwnProfile ? ownInteractions : otherInteractions;
  const interactionsLoading = isOwnProfile ? ownInteractionsLoading : otherInteractionsLoading;
  
  // Filter interactions locally instead of loading again
  const interactions = useMemo(() => {
    if (selectedState === 'all') return allInteractions;
    return allInteractions.filter(interaction => interaction.state === selectedState);
  }, [allInteractions, selectedState]);
  
  const { userProfile: viewingUserProfile, loading: profileLoading } = useAnyUserProfile(viewingUserId || '');
  
  // Get things for the interactions
  const thingIds = useMemo(() => interactions.map(i => i.thingId), [interactions]);
  const { things, loading: thingsLoading } = useThings(thingIds);
  
  // Determine which profile to display
  const displayedProfile = isOwnProfile ? userProfile : (viewingUserId ? viewingUserProfile : null);
  
  // Load recs given count
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
    loadRecsGivenCount();
  }, [loadRecsGivenCount]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoryDropdown]);

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (!user || !userProfile || !viewingUserId || !viewingUserProfile) return;
    
    setFollowLoading(true);
    try {
      const isFollowing = userProfile.following.includes(viewingUserProfile.id);
      
      if (isFollowing) {
        await unfollowUser(user.uid, viewingUserProfile.id);
        
        // Clear feed cache to force fresh data load
        dataService.clearFeedCache(user.uid);
        
        setUserProfile({
          ...userProfile,
          following: userProfile.following.filter(id => id !== viewingUserProfile.id)
        });
      } else {
        await followUser(user.uid, viewingUserProfile.id);
        
        // Clear feed cache to force fresh data load
        dataService.clearFeedCache(user.uid);
        
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

  const isFollowing = userProfile && viewingUserId && viewingUserProfile 
    ? userProfile.following.includes(viewingUserProfile.id) 
    : false;

  // Filter interactions by category and search
  const filteredInteractions = interactions.filter((interaction: UserThingInteraction) => {
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
  
  // Helper to get count for each state (memoized to prevent unnecessary recalculations)
  const getStateCount = useCallback((state: 'all' | 'bucketList' | 'completed') => {
    // For state counts in tabs, we want to show total counts across all categories
    // Use allInteractions (unfiltered) for accurate counting
    if (state === 'all') return allInteractions.length;
    return allInteractions.filter((i: UserThingInteraction) => i.state === state).length;
  }, [allInteractions]);
  
  // Helper to get count for each category within current state filter (memoized)
  const getCategoryCount = useCallback((category: Category | 'all') => {
    const stateFiltered = selectedState === 'all' 
      ? allInteractions 
      : allInteractions.filter((i: UserThingInteraction) => i.state === selectedState);
    
    if (category === 'all') return stateFiltered.length;
    
    return stateFiltered.filter((interaction: UserThingInteraction) => {
      const thing = things.find(t => t.id === interaction.thingId);
      return thing?.category === category;
    }).length;
  }, [allInteractions, things, selectedState]);
  
  // Debug logging to track interaction changes
  useEffect(() => {
    console.log('🔍 ProfileScreen: Interactions changed', {
      isOwnProfile,
      displayedUserId,
      allInteractionsCount: allInteractions.length,
      interactionsCount: interactions.length,
      selectedState,
      userIds: allInteractions.map(i => i.userId).slice(0, 5) // First 5 user IDs
    });
  }, [allInteractions, interactions, selectedCategory, selectedState, isOwnProfile, displayedUserId]);
  
  const completedCount = allInteractions.filter((i: UserThingInteraction) => i.state === 'completed').length;
  const loading = interactionsLoading || profileLoading || thingsLoading;

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
                aria-label="Go back"
              >
                <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
              </button>
            </div>
          )}

          {/* Settings Button - Top Right (for own profile) */}
          {isOwnProfile && onSettingsClick && (
            <div className="absolute top-0 right-0">
              <button
                onClick={onSettingsClick}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Settings"
              >
                <CogIcon className="h-6 w-6 text-gray-600" />
              </button>
            </div>
          )}

          {/* Profile Avatar */}
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {displayedProfile?.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>

          {/* Profile Info */}
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {displayedProfile?.name || 'Loading...'}
          </h1>
          <p className="text-gray-500 mb-2">@{displayedProfile?.username || 'loading'}</p>
          
          {/* Stats */}
          <div className="flex justify-center space-x-6 mb-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{completedCount}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{recsGivenCount}</div>
              <div className="text-sm text-gray-500">Recs Given</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{displayedProfile?.followers?.length || 0}</div>
              <div className="text-sm text-gray-500">Followers</div>
            </div>
          </div>

          {/* Follow Button (for other users) */}
          {!isOwnProfile && viewingUserId && viewingUserProfile && (
            <button
              onClick={handleFollowToggle}
              disabled={followLoading}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                isFollowing
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {followLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto"></div>
              ) : isFollowing ? (
                <>
                  <UserMinusIcon className="h-4 w-4 inline mr-1" />
                  Following
                </>
              ) : (
                <>
                  <UserPlusIcon className="h-4 w-4 inline mr-1" />
                  Follow
                </>
              )}
            </button>
          )}

        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search your activity..."
            value={activitySearchTerm}
            onChange={(e) => setActivitySearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* State Filter Tabs */}
        <div className="flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1">
          {(['all', 'bucketList', 'completed'] as const).map((state) => (
            <button
              key={state}
              onClick={() => setSelectedState(state)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                selectedState === state
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {state === 'all' && `All (${getStateCount('all')})`}
              {state === 'bucketList' && (
                <>
                  <BookmarkIcon className="h-4 w-4 inline mr-1" />
                  ({getStateCount('bucketList')})
                </>
              )}
              {state === 'completed' && (
                <>
                  <CheckCircleIcon className="h-4 w-4 inline mr-1" />
                  ({getStateCount('completed')})
                </>
              )}
            </button>
          ))}
        </div>

        {/* Category Filter Dropdown */}
        <div className="relative mb-6 inline-block" ref={dropdownRef}>
          <button
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <span className="flex items-center gap-1.5">
              {selectedCategory === 'all' ? (
                <>All</>
              ) : (
                <>
                  <span>{CATEGORIES.find(c => c.id === selectedCategory)?.emoji}</span>
                  <span>{CATEGORIES.find(c => c.id === selectedCategory)?.name}</span>
                </>
              )}
            </span>
            <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showCategoryDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[200px] max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setShowCategoryDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                  selectedCategory === 'all' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                <span>All</span>
                <span className="text-xs text-gray-500">{getCategoryCount('all')}</span>
              </button>
              {CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setShowCategoryDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                    selectedCategory === category.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{category.emoji}</span>
                    <span>{category.name}</span>
                  </span>
                  <span className="text-xs text-gray-500">{getCategoryCount(category.id)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading activity...</p>
          </div>
        )}

        {/* Activity List */}
        {!loading && (
          <div className="space-y-4">
            {filteredInteractions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-2">
                  {selectedState === 'all' ? '📚' : selectedState === 'bucketList' ? '📖' : '✅'}
                </div>
                <p className="text-gray-600">
                  {selectedState === 'all' && 'No activity yet'}
                  {selectedState === 'bucketList' && 'No saved items'}
                  {selectedState === 'completed' && 'No completed items'}
                </p>
              </div>
            ) : (
              filteredInteractions.map((interaction) => {
                const thing = things.find(t => t.id === interaction.thingId);
                if (!thing) return null;
                
                return (
                  <ThingInteractionCard
                    key={interaction.id}
                    thing={thing}
                    interaction={interaction}
                    onEdit={onEditInteraction}
                    onUserClick={handleUserClick}
                  />
                );
              })
            )}
          </div>
        )}
      </div>

    </div>
  );
}