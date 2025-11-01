'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore, useAppStore } from '@/lib/store';
import AuthScreen from './AuthScreen';
import Navigation from './Navigation';
import FeedScreen from './FeedScreen';
import PostScreen from './PostScreen';
import ProfileScreen from './ProfileScreen';
import FollowingListScreen from './FollowingListScreen';
import NotificationsScreen from './NotificationsScreen';
import SettingsScreen from './SettingsScreen';
import { User, Thing, UserThingInteraction } from '@/lib/types';
import { getUserProfile } from '@/lib/auth';
import { PlusIcon } from '@heroicons/react/24/outline';
import { cleanupDuplicateInteractions, migrateInProgressToBucketList } from '@/lib/firestore';
import Image from 'next/image';

type ProfileScreenType = 'main' | 'following' | 'public' | 'settings';
type AppScreenType = 'notifications' | 'main';

export default function MainApp() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'feed' | 'post' | 'profile'>('feed');
  const [profileScreen, setProfileScreen] = useState<ProfileScreenType>('main');
  const [appScreen, setAppScreen] = useState<AppScreenType>('main');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [profileNavigationSource, setProfileNavigationSource] = useState<'feed' | 'following' | 'direct'>('feed');
  const [editingInteraction, setEditingInteraction] = useState<{interaction: UserThingInteraction; thing: Thing} | null>(null);
  const [returnTabAfterPost, setReturnTabAfterPost] = useState<'feed' | 'profile'>('feed');
  const [isSignupProcess, setIsSignupProcess] = useState(false);
  
  const { user, loading } = useAuthStore();
  const { setAutoOpenThingId } = useAppStore();
  
  // Track if Clerk has loaded to avoid showing Auth screen during initial load
  const [clerkLoaded, setClerkLoaded] = useState(false);

  // Check for signup process after hydration to avoid SSR mismatch
  useEffect(() => {
    const checkSignupProcess = () => {
      const hasStepProfile = window.location.href.includes('step=profile');
      const hasPendingProfileData = localStorage.getItem('pendingProfileData');
      setIsSignupProcess(hasStepProfile || !!hasPendingProfileData);
    };
    
    checkSignupProcess();
  }, []);
  
  // Track Clerk loaded state
  useEffect(() => {
    // Wait a bit for Clerk to initialize, then mark as loaded
    const timeoutId = setTimeout(() => {
      setClerkLoaded(true);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // Listen for invitation completion to switch to feed tab
  useEffect(() => {
    const handleSwitchToFeed = () => {
      console.log('🎁 MainApp: Switching to feed tab after invitation...');
      setActiveTab('feed');
    };

    window.addEventListener('switchToFeed', handleSwitchToFeed);
    
    return () => {
      window.removeEventListener('switchToFeed', handleSwitchToFeed);
    };
  }, []);

  // Expose cleanup functions to window for debugging
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      (window as Window & typeof globalThis & { 
        cleanupDuplicates?: () => Promise<void>;
        migrateInProgress?: () => Promise<void>;
      }).cleanupDuplicates = async () => {
        try {
          await cleanupDuplicateInteractions(user.uid);
        } catch (error) {
          console.error('Cleanup failed:', error);
          alert('Cleanup failed. Check console for details.');
        }
      };
      
      (window as Window & typeof globalThis & { migrateInProgress?: () => Promise<void> }).migrateInProgress = async () => {
        try {
          await migrateInProgressToBucketList(user.uid);
        } catch (error) {
          console.error('Migration failed:', error);
          alert('Migration failed. Check console for details.');
        }
      };
    }
  }, [user]);

  // Handle URL parameters for profile navigation
  useEffect(() => {
    const viewProfileId = searchParams.get('viewProfile');
    const viewProfileName = searchParams.get('userName');
    
    if (viewProfileId && viewProfileName && user) {
      // Load the profile and switch to profile view
      const loadProfile = async () => {
        try {
          const userProfile = await getUserProfile(viewProfileId);
          if (userProfile) {
            setSelectedUser(userProfile);
            setProfileScreen('public');
            setActiveTab('profile');
            setProfileNavigationSource('direct');
          }
        } catch (error) {
          console.error('Error loading profile from URL:', error);
        }
      };
      
      loadProfile();
      
      // Clear the URL parameters after processing
      if (typeof window !== 'undefined') {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [searchParams, user]);


  // Only show Auth screen if Clerk has loaded AND user is not authenticated
  // This prevents the flash of Auth screen during initial load
  if (!user && clerkLoaded) {
    return <AuthScreen />;
  }
  
  // If still loading or Clerk hasn't loaded, show loading screen
  if (loading || !clerkLoaded) {
    const loadingMessage = isSignupProcess ? 'Creating your Rex account...' : 'Loading Rex...';
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          {/* Rex Logo */}
          <div className="mb-6">
            <Image 
              src="/rexlogo.png" 
              alt="Rex" 
              width={64}
              height={64}
              className="mx-auto rounded-lg shadow-sm"
            />
          </div>
          
          {/* Loading Spinner */}
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          
          {/* Loading Message */}
          <p className="text-gray-600 text-lg font-medium">{loadingMessage}</p>
          
          {/* Additional context for signup */}
          {isSignupProcess && (
            <p className="text-gray-500 text-sm mt-2">
              Setting up your profile and connecting your account...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Reset screens when switching tabs
  const handleTabChange = (tab: 'feed' | 'post' | 'profile') => {
    // Reset profile screen state when switching tabs
    if (tab !== 'profile') {
      setProfileScreen('main');
      setSelectedUser(null);
      setProfileNavigationSource('feed');
    } else {
      // When clicking Profile tab, always go to own profile
      setProfileScreen('main');
      setSelectedUser(null);
      setProfileNavigationSource('feed');
    }
    setAppScreen('main'); // Always reset to main app screen
    setActiveTab(tab);
    
    // Dispatch event to reset to Things feed when clicking Discover tab
    if (tab === 'feed' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('switchToThingsFeed'));
    }
  };

  // Navigation handlers for notifications and settings
  const handleNotificationsClick = () => {
    setAppScreen('notifications');
  };

  const handleSettingsClick = () => {
    setProfileScreen('settings');
  };

  const handleBackFromNotifications = () => {
    setAppScreen('main');
  };

  const handleBackFromSettings = () => {
    setProfileScreen('main');
  };

  // Post navigation handler (open Thing modal in feed)
  const handlePostClick = (thingId: string) => {
    // Ensure we're on the main app and feed tab
    setAppScreen('main');
    setActiveTab('feed');
    // Signal feed view (not map/search overlay)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('switchToThingsFeed'));
    }
    // Ask feed to auto-open this thing's modal
    setAutoOpenThingId(thingId);
  };

  // Navigation handlers for profile screens

  const handleShowPublicProfile = (user: User) => {
    setSelectedUser(user);
    setProfileScreen('public');
    setProfileNavigationSource('following');
  };

  const handleBackToProfile = () => {
    setProfileScreen('main');
    setSelectedUser(null);
    setProfileNavigationSource('feed');
  };

  const handleBackFromPublicProfile = () => {
    // Use the navigation source to determine where to go back to
    if (profileNavigationSource === 'following') {
      // Go back to following list
      setProfileScreen('following');
      setSelectedUser(null);
    } else {
      // Go back to feed (for 'feed' or 'direct' sources)
      setActiveTab('feed');
      setProfileScreen('main');
      setSelectedUser(null);
    }
    setProfileNavigationSource('feed'); // Reset for next time
  };

  // Handler for clicking on user profiles from feed
  const handleProfileClickFromFeed = async (authorId: string) => {
    try {
      // If clicking own profile, just go to Profile tab
      if (user && authorId === user.uid) {
        setActiveTab('profile');
        setProfileScreen('main');
        setSelectedUser(null);
        return;
      }
      
      // Otherwise, show other user's profile
      const userProfile = await getUserProfile(authorId);
      if (userProfile) {
        setSelectedUser(userProfile);
        setProfileScreen('public');
        setActiveTab('profile'); // Switch to profile tab to render the profile
        setProfileNavigationSource('feed');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const renderActiveScreen = () => {
    // Handle app-level screens first
    if (appScreen === 'notifications') {
      return (
        <NotificationsScreen 
          onBack={handleBackFromNotifications}
          onPostClick={handlePostClick}
        />
      );
    }

    // Handle main app screens
    switch (activeTab) {
      case 'feed':
        return (
          <FeedScreen 
            onUserProfileClick={handleProfileClickFromFeed} 
            onNavigateToAdd={() => setActiveTab('post')}
            onEditInteraction={(interaction, thing) => {
              setEditingInteraction({ interaction, thing });
              setReturnTabAfterPost('feed');
              setActiveTab('post');
            }}
          />
        );
      case 'post':
        return (
          <PostScreen 
            editMode={editingInteraction || undefined}
            onEditComplete={() => {
              setEditingInteraction(null);
              setActiveTab(returnTabAfterPost);
            }}
          />
        );
      case 'profile':
        switch (profileScreen) {
          case 'following':
            return (
              <FollowingListScreen 
                onBack={handleBackToProfile}
                onUserClick={handleShowPublicProfile}
              />
            );
          case 'public':
            return selectedUser ? (
              <ProfileScreen 
                viewingUserId={selectedUser.id}
                onBack={handleBackFromPublicProfile}
                onEditInteraction={(interaction, thing) => {
                  setEditingInteraction({ interaction, thing });
                  setReturnTabAfterPost('profile');
                  setActiveTab('post');
                }}
              />
            ) : (
              <ProfileScreen 
                onUserClick={handleProfileClickFromFeed}
                onSettingsClick={handleSettingsClick}
                onEditInteraction={(interaction, thing) => {
                  setEditingInteraction({ interaction, thing });
                  setReturnTabAfterPost('profile');
                  setActiveTab('post');
                }}
              />
            );
          case 'settings':
            return <SettingsScreen onBack={handleBackFromSettings} />;
          default:
            return (
              <ProfileScreen 
                onUserClick={handleProfileClickFromFeed}
                onSettingsClick={handleSettingsClick}
                onEditInteraction={(interaction, thing) => {
                  setEditingInteraction({ interaction, thing });
                  setReturnTabAfterPost('profile');
                  setActiveTab('post');
                }}
              />
            );
        }
      default:
        return <PostScreen />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Only show navigation on main app screens, not notifications/settings */}
      {appScreen === 'main' && profileScreen !== 'settings' && (
        <Navigation 
          activeTab={profileScreen === 'public' ? null : activeTab}
          onTabChange={handleTabChange} 
          onNotificationsClick={handleNotificationsClick}
        />
      )}
      
      {/* Floating Action Button - only show when not on Add screen */}
      {appScreen === 'main' && profileScreen !== 'settings' && activeTab !== 'post' && (
        <button
          onClick={() => setActiveTab('post')}
          className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
          aria-label="Add new item"
        >
          <PlusIcon className="h-7 w-7" />
        </button>
      )}
      
      <main className="flex-1 flex flex-col">
        {renderActiveScreen()}
      </main>
    </div>
  );
} 