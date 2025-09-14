'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore, useAppStore } from '@/lib/store';
import { getPersonalItems, getUserRecsGivenCount } from '@/lib/firestore';
import { MagnifyingGlassIcon, ListBulletIcon, DevicePhoneMobileIcon, CogIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import PersonalItemCard from './PersonalItemCard';
import PersonalItemDetailModal from './PersonalItemDetailModal';
import PWAInstallPrompt from './PWAInstallPrompt';
import { usePWAInstallStatus } from './PWAInstallStatus';
import EditProfileModal from './EditProfileModal';

interface ProfileScreenProps {
  onShowFollowingList: () => void;
  onUserClick?: (userId: string) => void;
  onSettingsClick: () => void;
}

export default function ProfileScreen({ onShowFollowingList, onUserClick, onSettingsClick }: ProfileScreenProps) {
  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [recsGivenCount, setRecsGivenCount] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  const { user, userProfile } = useAuthStore();
  const { isInstalled, isLoading } = usePWAInstallStatus();
  const { personalItems, setPersonalItems } = useAppStore();



  const loadPersonalItems = useCallback(async () => {
    if (!user) return;
    
    try {
      const items = await getPersonalItems(user.uid);
      setPersonalItems(items);
    } catch (error) {
      console.error('Error loading personal items:', error);
    }
  }, [user, setPersonalItems]);

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
    loadPersonalItems();
    loadRecsGivenCount();
  }, [loadPersonalItems, loadRecsGivenCount]);





  const filteredPersonalItems = personalItems.filter(item => {
    // Show both completed and shared items in Profile (want_to_try items are in Bucket List tab)
    const isCompletedOrShared = item.status === 'completed' || item.status === 'shared';
    
    // Apply search filter if search term exists
    if (activitySearchTerm.trim()) {
      const searchLower = activitySearchTerm.toLowerCase();
      const matchesSearch = 
        item.title.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower) ||
        (item.recommendedBy && item.recommendedBy.toLowerCase().includes(searchLower));
      return isCompletedOrShared && matchesSearch;
    }
    
    return isCompletedOrShared;
  });

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
                {personalItems.filter(item => item.status === 'completed' || item.status === 'shared').length || 0}
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

        {/* Completed Activities Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Completed Activities</h3>
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
          {filteredPersonalItems.length === 0 ? (
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
              {filteredPersonalItems.map((item) => (
                <PersonalItemCard 
                  key={item.id} 
                  item={item} 
                  onUserClick={onUserClick}
                  onItemClick={(itemId) => setSelectedItemId(itemId)}
                />
              ))}
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

      {/* Personal Item Detail Modal */}
      {selectedItemId && (
        <PersonalItemDetailModal
          item={personalItems.find(item => item.id === selectedItemId)!}
          isOpen={true}
          onClose={() => setSelectedItemId(null)}
          onUserClick={onUserClick}
        />
      )}
    </div>
  );
} 