'use client';

import { useState, useEffect } from 'react';
import { ArrowLeftIcon, BellIcon, ArrowRightOnRectangleIcon, UserIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/lib/store';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useClerk } from '@clerk/nextjs';
import { UserProfile } from '@clerk/nextjs';
import { NotificationPreferences } from '@/lib/types';
import { updateUserWithUsername, checkUsernameAvailability } from '@/lib/firestore';

interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { user, userProfile, setUserProfile } = useAuthStore();
  const { signOut } = useClerk();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications'>('profile');
  
  // Profile edit state
  const [name, setName] = useState(userProfile?.name || '');
  const [username, setUsername] = useState(userProfile?.username || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  
  // Notification state
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    tagged: true,
    mentioned: true,
    followed: true,
    post_liked: true,
    email_notifications: false,
  });
  const [notificationSaving, setNotificationSaving] = useState(false);

  // Sync profile fields when userProfile loads
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name);
      setUsername(userProfile.username);
      setEmail(userProfile.email);
    }
  }, [userProfile]);

  // Sync notification preferences
  useEffect(() => {
    if (userProfile?.notificationPreferences) {
      setNotificationPrefs(userProfile.notificationPreferences);
    }
  }, [userProfile]);

  // Check username availability as user types
  useEffect(() => {
    if (username !== userProfile?.username && username.length >= 3) {
      const checkUsername = async () => {
        setCheckingUsername(true);
        try {
          const available = await checkUsernameAvailability(username.toLowerCase());
          setUsernameAvailable(available);
        } catch (error) {
          console.error('Error checking username:', error);
          setUsernameAvailable(null);
        } finally {
          setCheckingUsername(false);
        }
      };

      const timeoutId = setTimeout(checkUsername, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setUsernameAvailable(null);
      setCheckingUsername(false);
    }
  }, [username, userProfile]);

  const handleSaveProfile = async () => {
    if (!user || !userProfile) return;

    if (!name.trim()) {
      setProfileError('Name is required');
      return;
    }

    if (!username.trim()) {
      setProfileError('Username is required');
      return;
    }

    if (!email.trim()) {
      setProfileError('Email is required');
      return;
    }

    if (usernameAvailable === false) {
      setProfileError('Username is already taken');
      return;
    }

    setProfileSaving(true);
    setProfileError('');

    try {
      const result = await updateUserWithUsername(user.uid, {
        name: name.trim(),
        email: email.trim(),
        username: username.trim() || undefined,
      });

      if (!result.success) {
        setProfileError(result.error || 'Failed to update profile');
        return;
      }

      // Update local state
      setUserProfile({
        ...userProfile,
        name: name.trim(),
        email: email.trim(),
        username: username.trim() || userProfile.username,
      });

      setProfileError('');
      // Show success briefly
      setTimeout(() => setProfileError(''), 2000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setProfileError('Failed to update profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleNotificationPrefChange = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user) return;

    const newPrefs = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(newPrefs);

    setNotificationSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notificationPreferences: newPrefs
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      // Revert on error
      setNotificationPrefs(notificationPrefs);
    } finally {
      setNotificationSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      // Clerk will handle the redirect and cleanup
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const tabs = [
    {
      id: 'profile' as const,
      name: 'Profile',
      icon: UserIcon,
    },
    {
      id: 'notifications' as const,
      name: 'Notifications',
      icon: BellIcon,
    },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto pb-32">
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
        {activeTab === 'profile' && (
          <div className="space-y-8">
            {/* Edit Profile Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>
              
              {profileError && (
                <div className={`mb-4 rounded-lg p-3 ${
                  profileError === '' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <p className={`text-sm ${profileError === '' ? 'text-green-600' : 'text-red-600'}`}>
                    {profileError || 'Profile updated successfully!'}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="username"
                      pattern="^[a-z0-9_]*$"
                      maxLength={20}
                    />
                    {checkingUsername && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    {!checkingUsername && username.length >= 3 && username !== userProfile?.username && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {usernameAvailable ? (
                          <span className="text-green-600 text-xl">✓</span>
                        ) : (
                          <span className="text-red-600 text-xl">✗</span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Letters, numbers, and underscores only
                    {!checkingUsername && username.length >= 3 && username !== userProfile?.username && (
                      <span className={usernameAvailable ? 'text-green-600' : 'text-red-600'}>
                        {' - '}{usernameAvailable ? 'Available!' : 'Already taken'}
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={userProfile?.phoneNumber || 'Not set'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                    disabled={true}
                    readOnly
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Phone number is managed by your account settings
                  </p>
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={profileSaving || !name.trim() || !username.trim() || !email.trim() || usernameAvailable === false}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Connected Accounts Section */}
            <div className="border-t border-gray-200 pt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Connected Accounts</h3>
              <p className="text-sm text-gray-600 mb-6">
                Manage your sign-in methods and connected accounts
              </p>
              
              <UserProfile 
                routing="hash"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none border-0",
                    navbar: "hidden",
                    pageScrollBox: "p-0",
                  }
                }}
              />
            </div>
          </div>
        )}

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
                      disabled={notificationSaving}
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
                      disabled={notificationSaving}
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
                      disabled={notificationSaving}
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
                      disabled={notificationSaving}
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
        </div>
      </div>

      {/* Sticky Footer with Sign Out */}
      <div className="border-t border-gray-200 bg-white px-4 py-4">
        <button
          onClick={handleLogout}
          className="flex items-center justify-center space-x-2 w-full p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Saving Indicators */}
      {profileSaving && (
        <div className="fixed top-4 right-4 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg text-sm shadow-lg">
          Saving profile...
        </div>
      )}
      {notificationSaving && (
        <div className="fixed top-4 right-4 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg text-sm shadow-lg">
          Saving preferences...
        </div>
      )}
    </div>
  );
} 