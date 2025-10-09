'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import AuthForm from './AuthForm';
import Navigation from './Navigation';
import FeedScreen from './FeedScreen';
import PostScreen from './PostScreen';
import ProfileScreen from './ProfileScreen';
import FollowingListScreen from './FollowingListScreen';
import PublicProfileScreen from './PublicProfileScreen';
import NotificationsScreen from './NotificationsScreen';
import SettingsScreen from './SettingsScreen';
import { User } from '@/lib/types';
import { getUserProfile } from '@/lib/auth';
import { PlusIcon } from '@heroicons/react/24/outline';
import { cleanupDuplicateInteractions } from '@/lib/firestore';

type ProfileScreenType = 'main' | 'following' | 'public' | 'settings';
type AppScreenType = 'notifications' | 'main';

export default function MainApp() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'feed' | 'post' | 'profile'>('post');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [profileScreen, setProfileScreen] = useState<ProfileScreenType>('main');
  const [appScreen, setAppScreen] = useState<AppScreenType>('main');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [profileNavigationSource, setProfileNavigationSource] = useState<'feed' | 'following' | 'direct'>('feed');
  
  const { user, loading } = useAuthStore();

  // Expose cleanup function to window for debugging
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      (window as Window & typeof globalThis & { cleanupDuplicates?: () => Promise<void> }).cleanupDuplicates = async () => {
        try {
          await cleanupDuplicateInteractions(user.uid);
        } catch (error) {
          console.error('Cleanup failed:', error);
          alert('Cleanup failed. Check console for details.');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Rex...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthForm 
        mode={authMode} 
        onToggle={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} 
      />
    );
  }

  // Reset screens when switching tabs
  const handleTabChange = (tab: 'feed' | 'post' | 'profile') => {
    if (tab !== 'profile') {
      setProfileScreen('main');
      setSelectedUser(null);
      setProfileNavigationSource('feed');
    }
    setAppScreen('main'); // Always reset to main app screen
    setActiveTab(tab);
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

  // Post navigation handler
  const handlePostClick = (postId: string) => {
    router.push(`/post/${postId}?from=notifications`);
  };

  // Navigation handlers for profile screens
  const handleShowFollowingList = () => {
    setProfileScreen('following');
  };

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
      const userProfile = await getUserProfile(authorId);
      if (userProfile) {
        setSelectedUser(userProfile);
        setProfileScreen('public');
        setActiveTab('profile');
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
        return <FeedScreen onUserProfileClick={handleProfileClickFromFeed} onNavigateToAdd={() => setActiveTab('post')} />;
      case 'post':
        return <PostScreen />;
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
              <PublicProfileScreen 
                user={selectedUser}
                onBack={handleBackFromPublicProfile}
              />
            ) : (
              <ProfileScreen 
                onShowFollowingList={handleShowFollowingList} 
                onUserClick={handleProfileClickFromFeed}
                onSettingsClick={handleSettingsClick}
              />
            );
          case 'settings':
            return <SettingsScreen onBack={handleBackFromSettings} />;
          default:
            return (
              <ProfileScreen 
                onShowFollowingList={handleShowFollowingList} 
                onUserClick={handleProfileClickFromFeed}
                onSettingsClick={handleSettingsClick}
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
          activeTab={activeTab} 
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