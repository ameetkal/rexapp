'use client';

import { useState, useEffect } from 'react';
import { HomeIcon, PlusIcon, BookmarkIcon, UserIcon, BellIcon } from '@heroicons/react/24/outline';
import { HomeIcon as HomeIconSolid, PlusIcon as PlusIconSolid, BookmarkIcon as BookmarkIconSolid, UserIcon as UserIconSolid } from '@heroicons/react/24/solid';
import { useAuthStore } from '@/lib/store';
import { subscribeToNotifications } from '@/lib/firestore';
import { Notification } from '@/lib/types';

interface NavigationProps {
  activeTab: 'feed' | 'post' | 'saved' | 'profile';
  onTabChange: (tab: 'feed' | 'post' | 'saved' | 'profile') => void;
  onNotificationsClick: () => void;
}

export default function Navigation({ activeTab, onTabChange, onNotificationsClick }: NavigationProps) {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<(Notification & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToNotifications(user.uid, (newNotifications) => {
      setNotifications(newNotifications);
    });

    return unsubscribe;
  }, [user]);

  const tabs = [
    {
      id: 'feed' as const,
      name: 'Feed',
      icon: HomeIcon,
      activeIcon: HomeIconSolid,
    },
    {
      id: 'post' as const,
      name: 'Add',
      icon: PlusIcon,
      activeIcon: PlusIconSolid,
    },
    {
      id: 'saved' as const,
      name: 'Want to Try',
      icon: BookmarkIcon,
      activeIcon: BookmarkIconSolid,
    },
    {
      id: 'profile' as const,
      name: 'Profile',
      icon: UserIcon,
      activeIcon: UserIconSolid,
    },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Rex</h1>
          <button
            onClick={onNotificationsClick}
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <BellIcon className="h-6 w-6 text-gray-600" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex items-center justify-around py-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = isActive ? tab.activeIcon : tab.icon;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center px-3 py-2 min-w-0 flex-1 ${
                  isActive 
                    ? 'text-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs mt-1 font-medium">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
} 