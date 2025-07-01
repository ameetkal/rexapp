'use client';

import { useState, useEffect } from 'react';
import { ArrowLeftIcon, BellIcon, ArrowRightOnRectangleIcon, KeyIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/store';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logOut } from '@/lib/auth';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { NotificationPreferences } from '@/lib/types';

interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { user, userProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'notifications'>('notifications');
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    tagged: true,
    mentioned: true,
    followed: true,
    post_liked: true,
    email_notifications: false,
  });
  const [saving, setSaving] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false);

  useEffect(() => {
    if (userProfile?.notificationPreferences) {
      setNotificationPrefs(userProfile.notificationPreferences);
    }
  }, [userProfile]);

  const handleNotificationPrefChange = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user) return;

    const newPrefs = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(newPrefs);

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notificationPreferences: newPrefs
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      // Revert on error
      setNotificationPrefs(notificationPrefs);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleResetPassword = async () => {
    if (!userProfile?.email || resetPasswordLoading) return;

    setResetPasswordLoading(true);
    try {
      await sendPasswordResetEmail(auth, userProfile.email);
      setResetPasswordSuccess(true);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setResetPasswordSuccess(false);
      }, 5000);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      // Could add error state here if needed
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const tabs = [
    {
      id: 'notifications' as const,
      name: 'Notifications',
      icon: BellIcon,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 border-b border-gray-200">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                  isActive 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
              <p className="text-sm text-gray-600 mb-6">
                Choose which notifications you&apos;d like to receive when using Rex
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="font-medium text-gray-900">🏷️ When tagged in posts</h4>
                    <p className="text-sm text-gray-500">Get notified when someone tags you in the &quot;Experienced With&quot; field</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationPrefs.tagged}
                      onChange={(e) => handleNotificationPrefChange('tagged', e.target.checked)}
                      className="sr-only peer"
                      disabled={saving}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="font-medium text-gray-900">💬 When mentioned</h4>
                    <p className="text-sm text-gray-500">Get notified when someone lists you as a recommender</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationPrefs.mentioned}
                      onChange={(e) => handleNotificationPrefChange('mentioned', e.target.checked)}
                      className="sr-only peer"
                      disabled={saving}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="font-medium text-gray-900">👥 New followers</h4>
                    <p className="text-sm text-gray-500">Get notified when someone follows you</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationPrefs.followed}
                      onChange={(e) => handleNotificationPrefChange('followed', e.target.checked)}
                      className="sr-only peer"
                      disabled={saving}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="font-medium text-gray-900">❤️ Post reactions</h4>
                    <p className="text-sm text-gray-500">Get notified when someone saves your posts</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationPrefs.post_liked}
                      onChange={(e) => handleNotificationPrefChange('post_liked', e.target.checked)}
                      className="sr-only peer"
                      disabled={saving}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <hr className="my-6" />

                <div className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="font-medium text-gray-900">📧 Email notifications</h4>
                    <p className="text-sm text-gray-500">Receive notification summaries via email (coming soon)</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationPrefs.email_notifications}
                      onChange={(e) => handleNotificationPrefChange('email_notifications', e.target.checked)}
                      className="sr-only peer"
                      disabled={true} // Disabled for now
                    />
                    <div className="w-11 h-6 bg-gray-200 opacity-50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Account Actions Section */}
        <div className="mt-12 pt-6 border-t border-gray-200 space-y-2">
          <button
            onClick={handleResetPassword}
            disabled={resetPasswordLoading}
            className="flex items-center space-x-3 w-full p-4 text-left text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <KeyIcon className="h-6 w-6" />
            <div className="flex-1">
              <span className="font-medium">
                {resetPasswordLoading ? 'Sending...' : 'Reset Password'}
              </span>
              {resetPasswordSuccess && (
                <p className="text-sm text-green-600 mt-1">
                  Password reset email sent! Check your inbox.
                </p>
              )}
              {!resetPasswordSuccess && (
                <p className="text-sm text-gray-500 mt-1">
                  Send password reset email to {userProfile?.email}
                </p>
              )}
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 w-full p-4 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <ArrowRightOnRectangleIcon className="h-6 w-6" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>

        {saving && (
          <div className="fixed top-4 right-4 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg text-sm">
            Saving preferences...
          </div>
        )}
      </div>
    </div>
  );
} 