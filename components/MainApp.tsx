'use client';

import { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState<'feed' | 'post' | 'saved' | 'profile'>('post');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [profileScreen, setProfileScreen] = useState<ProfileScreenType>('main');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const { user, loading } = useAuthStore();

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
  };

  const handleBackToProfile = () => {
    setProfileScreen('main');
    setSelectedUser(null);
  };

  const handleBackToFollowing = () => {
    setProfileScreen('following');
    setSelectedUser(null);
  };

  // Handler for clicking on user profiles from feed
  const handleProfileClickFromFeed = async (authorId: string) => {
    try {
      const userProfile = await getUserProfile(authorId);
      if (userProfile) {
        setSelectedUser(userProfile);
        setProfileScreen('public');
        setActiveTab('profile');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'feed':
        return <FeedScreen onUserProfileClick={handleProfileClickFromFeed} />;
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
                onBack={handleBackToFollowing}
              />
            ) : <ProfileScreen onShowFollowingList={handleShowFollowingList} />;
          default:
            return <ProfileScreen onShowFollowingList={handleShowFollowingList} />;
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