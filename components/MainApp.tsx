'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import AuthForm from './AuthForm';
import Navigation from './Navigation';
import FeedScreen from './FeedScreen';
import PostScreen from './PostScreen';
import SavedScreen from './SavedScreen';
import ProfileScreen from './ProfileScreen';

export default function MainApp() {
  const [activeTab, setActiveTab] = useState<'feed' | 'post' | 'saved' | 'profile'>('feed');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
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

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'feed':
        return <FeedScreen />;
      case 'post':
        return <PostScreen />;
      case 'saved':
        return <SavedScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <FeedScreen />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 flex flex-col">
        {renderActiveScreen()}
      </main>
    </div>
  );
} 