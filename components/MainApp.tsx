'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import AuthForm from './AuthForm';
import Navigation from './Navigation';
import FeedScreen from './FeedScreen';
import PostScreen from './PostScreen';
import SavedScreen from './SavedScreen';
import ProfileScreen from './ProfileScreen';
import FollowingListScreen from './FollowingListScreen';
import PublicProfileScreen from './PublicProfileScreen';
import { User } from '@/lib/types';
import { getUserProfile } from '@/lib/auth';

type ProfileScreenType = 'main' | 'following' | 'public';

export default function MainApp() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'feed' | 'post' | 'saved' | 'profile'>('feed');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [profileScreen, setProfileScreen] = useState<ProfileScreenType>('main');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [profileNavigationSource, setProfileNavigationSource] = useState<'feed' | 'following' | 'direct'>('feed');
  
  const { user, loading } = useAuthStore();

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

  // Reset profile screen when switching tabs
  const handleTabChange = (tab: 'feed' | 'post' | 'saved' | 'profile') => {
    if (tab !== 'profile') {
      setProfileScreen('main');
      setSelectedUser(null);
      setProfileNavigationSource('feed');
    }
    setActiveTab(tab);
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
    switch (activeTab) {
      case 'feed':
        return <FeedScreen onUserProfileClick={handleProfileClickFromFeed} onNavigateToAdd={() => setActiveTab('post')} />;
      case 'post':
        return <PostScreen />;
      case 'saved':
        return <SavedScreen />;
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
            ) : <ProfileScreen onShowFollowingList={handleShowFollowingList} onUserClick={handleProfileClickFromFeed} />;
          default:
            return <ProfileScreen onShowFollowingList={handleShowFollowingList} onUserClick={handleProfileClickFromFeed} />;
        }
      default:
        return <FeedScreen onUserProfileClick={handleProfileClickFromFeed} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="flex-1 flex flex-col">
        {renderActiveScreen()}
      </main>
    </div>
  );
} 