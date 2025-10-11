'use client';

import { useState, useEffect } from 'react';
import { ArrowLeftIcon, BellIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/store';
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/lib/firestore';
import { Notification } from '@/lib/types';
import TagAcceptModal from './TagAcceptModal';

interface NotificationsScreenProps {
  onBack: () => void;
  onPostClick?: (postId: string) => void;
}

export default function NotificationsScreen({ onBack, onPostClick }: NotificationsScreenProps) {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<(Notification & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadNotifications = async () => {
      try {
        const userNotifications = await getUserNotifications(user.uid);
        setNotifications(userNotifications);
      } catch (error) {
        console.error('Error loading notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [user]);

  const handleNotificationClick = async (notification: Notification & { id: string }) => {
    // Mark as read if unread
    if (!notification.read) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        );
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Handle tagged notification - show accept modal
    if (notification.type === 'tagged' && notification.data.tagId) {
      setSelectedTagId(notification.data.tagId);
      return;
    }

    // Navigate to post if available
    if (notification.data.postId && onPostClick) {
      onPostClick(notification.data.postId);
    }
  };

  const handleTagAccepted = () => {
    // Reload notifications to remove accepted tag notification
    if (user) {
      getUserNotifications(user.uid).then(setNotifications);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    try {
      await markAllNotificationsAsRead(user.uid);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const formatDate = (timestamp: { toDate: () => Date }) => {
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins < 1 ? 'Just now' : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'tagged':
        return '🏷️';
      case 'rec_given':
        return '🎁';
      case 'comment':
        return '💬';
      case 'post_liked':
        return '❤️';
      case 'followed':
        return '👥';
      default:
        return '🔔';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-6">
          <div className="flex items-center mb-6">
            <button
              onClick={onBack}
              className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          </div>
          
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <BellIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications yet</h3>
            <p className="text-gray-500">
              When someone tags you or interacts with your posts, you&apos;ll see it here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full p-4 rounded-lg border text-left transition-colors ${
                  notification.read 
                    ? 'bg-white border-gray-200 hover:bg-gray-50' 
                    : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 text-2xl">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`font-medium ${notification.read ? 'text-gray-900' : 'text-blue-900'}`}>
                        {notification.title}
                      </p>
                      <span className="text-xs text-gray-500">
                        {formatDate(notification.createdAt)}
                      </span>
                    </div>
                    <p className={`text-sm ${notification.read ? 'text-gray-600' : 'text-blue-700'}`}>
                      {notification.message}
                    </p>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tag Accept Modal */}
      {selectedTagId && (
        <TagAcceptModal
          tagId={selectedTagId}
          onClose={() => setSelectedTagId(null)}
          onAccepted={handleTagAccepted}
        />
      )}
    </div>
  );
} 