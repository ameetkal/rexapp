'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeftIcon, BellIcon, UserPlusIcon, EyeIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/store';
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead, followUser } from '@/lib/firestore';
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
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  
  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [startY, setStartY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Haptic feedback helper
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30]
      };
      navigator.vibrate(patterns[type]);
    }
  }, []);

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || containerRef.current?.scrollTop !== 0) return;
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY);
    
    if (distance > 0) {
      e.preventDefault();
      setPullDistance(Math.min(distance, 100));
      
      // Trigger haptic feedback at threshold
      if (distance > 60 && pullDistance <= 60) {
        triggerHaptic('light');
      }
    }
  }, [isPulling, startY, pullDistance, triggerHaptic]);

  const handleRefresh = useCallback(async () => {
    if (!user || refreshing) return;
    
    setRefreshing(true);
    try {
      const userNotifications = await getUserNotifications(user.uid);
      setNotifications(userNotifications);
      setHasMore(true);
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    
    setIsPulling(false);
    
    if (pullDistance > 60) {
      triggerHaptic('medium');
      await handleRefresh();
    }
    
    setPullDistance(0);
  }, [isPulling, pullDistance, triggerHaptic, handleRefresh]);

  // Infinite scroll handler
  const handleScroll = useCallback(async () => {
    if (!user || loadingMore || !hasMore || !containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      setLoadingMore(true);
      try {
        // Load more notifications (you'll need to implement pagination in getUserNotifications)
        // For now, we'll just set hasMore to false
        setHasMore(false);
      } catch (error) {
        console.error('Error loading more notifications:', error);
      } finally {
        setLoadingMore(false);
      }
    }
  }, [user, loadingMore, hasMore]);

  // Initial load
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

  const handleFollowAction = async (userId: string, userName: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent notification click
    triggerHaptic('light');
    
    if (!user) return;
    
    try {
      await followUser(user.uid, userId);
      // Show success feedback
      console.log(`✅ Started following ${userName}`);
      triggerHaptic('medium'); // Success haptic
      // You could add a toast notification here
    } catch (error) {
      console.error('Error following user:', error);
      triggerHaptic('heavy'); // Error haptic
    }
  };

  const handleViewAction = async (thingId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent notification click
    triggerHaptic('light');
    
    // Navigate to the thing/post
    if (onPostClick) {
      onPostClick(thingId);
    }
  };

  const getActionButtons = (group: { notifications: (Notification & { id: string })[]; mostRecent: Notification & { id: string }; unreadCount: number; totalCount: number }) => {
    const { mostRecent } = group;
    
    switch (mostRecent.type) {
      case 'followed':
        return (
          <button
            onClick={(e) => handleFollowAction(mostRecent.data.fromUserId!, mostRecent.data.fromUserName!, e)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            <UserPlusIcon className="h-4 w-4" />
            <span>Follow back</span>
          </button>
        );
      
      case 'rec_given':
      case 'comment':
      case 'tagged':
        return (
          <button
            onClick={(e) => handleViewAction(mostRecent.data.thingId!, e)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <EyeIcon className="h-4 w-4" />
            <span>View</span>
          </button>
        );
      
      default:
        return null;
    }
  };

  const handleGroupClick = async (group: { notifications: (Notification & { id: string })[]; mostRecent: Notification & { id: string }; unreadCount: number; totalCount: number }) => {
    const { notifications, mostRecent } = group;
    
    // Mark all notifications in the group as read if any are unread
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length > 0) {
      try {
        await Promise.all(unreadNotifications.map(n => markNotificationAsRead(n.id)));
        setNotifications(prev => 
          prev.map(n => 
            unreadNotifications.some(unread => unread.id === n.id) 
              ? { ...n, read: true } 
              : n
          )
        );
      } catch (error) {
        console.error('Error marking notifications as read:', error);
      }
    }

    // Handle tagged notification - show accept modal
    if (mostRecent.type === 'tagged' && mostRecent.data.tagId) {
      setSelectedTagId(mostRecent.data.tagId);
      return;
    }

    // Navigate to post if available
    if (mostRecent.data.postId && onPostClick) {
      onPostClick(mostRecent.data.postId);
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
      case 'followed':
        return '👥';
      default:
        return '🔔';
    }
  };

  const groupNotifications = (notifications: (Notification & { id: string })[]) => {
    const groups: { [key: string]: (Notification & { id: string })[] } = {};
    
    notifications.forEach(notification => {
      // Create a grouping key based on type and related data
      let groupKey: string;
      
      switch (notification.type) {
        case 'followed':
          // Group all follow notifications together
          groupKey = 'followed';
          break;
        case 'rec_given':
          // Group recommendations by thing
          groupKey = `rec_${notification.data.thingId || 'unknown'}`;
          break;
        case 'comment':
          // Group comments by thing
          groupKey = `comment_${notification.data.thingId || 'unknown'}`;
          break;
        case 'tagged':
          // Group tags by thing
          groupKey = `tagged_${notification.data.thingId || 'unknown'}`;
          break;
        default:
          groupKey = notification.id; // Individual notifications
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(notification);
    });
    
    // Convert groups to array and sort by most recent notification in each group
    return Object.values(groups).map(group => ({
      notifications: group.sort((a, b) => {
        const aTime = a.createdAt.toDate().getTime();
        const bTime = b.createdAt.toDate().getTime();
        return bTime - aTime; // Most recent first
      }),
      mostRecent: group.reduce((latest, current) => {
        const latestTime = latest.createdAt.toDate().getTime();
        const currentTime = current.createdAt.toDate().getTime();
        return currentTime > latestTime ? current : latest;
      }),
      unreadCount: group.filter(n => !n.read).length,
      totalCount: group.length
    })).sort((a, b) => {
      const aTime = a.mostRecent.createdAt.toDate().getTime();
      const bTime = b.mostRecent.createdAt.toDate().getTime();
      return bTime - aTime; // Most recent groups first
    });
  };

  const formatGroupedMessage = (group: { notifications: (Notification & { id: string })[]; mostRecent: Notification & { id: string }; unreadCount: number; totalCount: number }) => {
    const { notifications, mostRecent, totalCount } = group;
    
    if (totalCount === 1) {
      return mostRecent.message;
    }
    
    // Get unique user names from notifications
    const userNames = [...new Set(notifications.map(n => n.data.fromUserName).filter(Boolean))];
    
    switch (mostRecent.type) {
      case 'followed':
        if (userNames.length === 1) {
          return `${userNames[0]} started following you`;
        } else if (userNames.length === 2) {
          return `${userNames[0]} and ${userNames[1]} started following you`;
        } else {
          return `${userNames[0]}, ${userNames[1]}, and ${userNames.length - 2} others started following you`;
        }
      
      case 'rec_given':
        if (userNames.length === 1) {
          return `${userNames[0]} completed "${mostRecent.data.thingTitle || 'an item'}"`;
        } else if (userNames.length === 2) {
          return `${userNames[0]} and ${userNames[1]} completed "${mostRecent.data.thingTitle || 'an item'}"`;
        } else {
          return `${userNames[0]}, ${userNames[1]}, and ${userNames.length - 2} others completed "${mostRecent.data.thingTitle || 'an item'}"`;
        }
      
      case 'comment':
        if (userNames.length === 1) {
          return `${userNames[0]} commented on "${mostRecent.data.thingTitle || 'an item'}"`;
        } else if (userNames.length === 2) {
          return `${userNames[0]} and ${userNames[1]} commented on "${mostRecent.data.thingTitle || 'an item'}"`;
        } else {
          return `${userNames[0]}, ${userNames[1]}, and ${userNames.length - 2} others commented on "${mostRecent.data.thingTitle || 'an item'}"`;
        }
      
      case 'tagged':
        if (userNames.length === 1) {
          return `${userNames[0]} tagged you in "${mostRecent.data.thingTitle || 'an item'}"`;
        } else if (userNames.length === 2) {
          return `${userNames[0]} and ${userNames[1]} tagged you in "${mostRecent.data.thingTitle || 'an item'}"`;
        } else {
          return `${userNames[0]}, ${userNames[1]}, and ${userNames.length - 2} others tagged you in "${mostRecent.data.thingTitle || 'an item'}"`;
        }
      
      default:
        return mostRecent.message;
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
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto pb-20"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onScroll={handleScroll}
      style={{
        transform: `translateY(${pullDistance * 0.5}px)`,
        transition: isPulling ? 'none' : 'transform 0.3s ease-out'
      }}
    >
      <div className="px-4 py-6">
        {/* Pull-to-refresh indicator */}
        {pullDistance > 0 && (
          <div className="flex items-center justify-center py-4">
            <div className={`transition-opacity duration-200 ${pullDistance > 60 ? 'opacity-100' : 'opacity-50'}`}>
              {refreshing ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              ) : (
                <div className="text-blue-600 text-sm font-medium">
                  {pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}
                </div>
              )}
            </div>
          </div>
        )}
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
            {groupNotifications(notifications).map((group, index) => (
              <button
                key={`group-${index}`}
                onClick={() => handleGroupClick(group)}
                className={`w-full p-4 rounded-lg border text-left transition-colors ${
                  group.unreadCount > 0
                    ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 text-2xl">
                    {getNotificationIcon(group.mostRecent.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`font-medium ${group.unreadCount > 0 ? 'text-blue-900' : 'text-gray-900'}`}>
                        {group.mostRecent.title}
                      </p>
                      <div className="flex items-center space-x-2">
                        {group.totalCount > 1 && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            {group.totalCount}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatDate(group.mostRecent.createdAt)}
                        </span>
                      </div>
                    </div>
                    <p className={`text-sm ${group.unreadCount > 0 ? 'text-blue-700' : 'text-gray-600'}`}>
                      {formatGroupedMessage(group)}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      {group.unreadCount > 0 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-xs text-blue-600 font-medium">
                            {group.unreadCount} new
                          </span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        {getActionButtons(group)}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        
        {/* Infinite scroll loading indicator */}
        {loadingMore && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
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