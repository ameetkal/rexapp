'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, DevicePhoneMobileIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

interface PWAInstallPromptProps {
  onDismiss: () => void;
}

export default function PWAInstallPrompt({ onDismiss }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<'ios-safari' | 'android-chrome' | 'android-firefox' | 'desktop-chrome' | 'desktop-edge' | 'desktop-firefox' | 'unknown'>('unknown');

  useEffect(() => {
    // Detect platform and browser more specifically  
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isMobile = /mobile|android|iphone|ipad|ipod/.test(userAgent);
    const isChrome = /chrome/.test(userAgent) && !/edg/.test(userAgent);
    const isEdge = /edg/.test(userAgent);
    const isFirefox = /firefox/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);

    if (isIOS && isSafari) {
      setPlatform('ios-safari');
    } else if (isAndroid && isChrome) {
      setPlatform('android-chrome');
    } else if (isAndroid && isFirefox) {
      setPlatform('android-firefox');
    } else if (!isMobile && isChrome) {
      setPlatform('desktop-chrome');
    } else if (!isMobile && isEdge) {
      setPlatform('desktop-edge');
    } else if (!isMobile && isFirefox) {
      setPlatform('desktop-firefox');
    }

    // Listen for the beforeinstallprompt event (Chrome/Edge on Android)
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent the mini-infobar from appearing
      e.preventDefault();
      // Store the event so it can be triggered later
      setDeferredPrompt(e);
      console.log('PWA install prompt available');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);



    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [deferredPrompt]);

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        onDismiss();
      } else {
        console.log('User dismissed the install prompt');
      }
      
      // Clear the deferredPrompt
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  };

  const getInstructions = (): {
    title: string;
    steps: (string | React.ReactElement)[];
    icon: React.ReactElement;
    buttonText: string;
  } => {
    switch (platform) {
      case 'ios-safari':
        return {
          title: 'Add Rex to Your Home Screen',
          steps: [
            <>Tap the Share button <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 rounded-md mx-1"><ArrowUpTrayIcon className="h-4 w-4 text-white" /></span> at the bottom of Safari</>,
            'Scroll down and tap "Add to Home Screen"',
            'Tap "Add" to confirm'
          ],
          icon: <ArrowUpTrayIcon className="h-5 w-5 text-blue-600" />,
          buttonText: 'Done!'
        };
      case 'android-chrome':
        return {
          title: 'Add Rex to Home Screen',
          steps: deferredPrompt ? [] : [
            'Tap the three dots (⋮) menu in Chrome',
            'Select "Add to Home screen"',
            'Tap "Add" to confirm'
          ],
          icon: <DevicePhoneMobileIcon className="h-5 w-5 text-blue-600" />,
          buttonText: deferredPrompt ? 'Add Now' : 'Done!'
        };
      case 'android-firefox':
        return {
          title: 'Add Rex to Home Screen',
          steps: [
            'Tap the three dots (⋮) menu in Firefox',
            'Select "Add to Home Screen"',
            'Tap "Add" to confirm'
          ],
          icon: <DevicePhoneMobileIcon className="h-5 w-5 text-blue-600" />,
          buttonText: 'Done!'
        };
      case 'desktop-chrome':
        return {
          title: 'Add Rex to Desktop',
          steps: [
            'Look for the add icon (⊞) in Chrome\'s address bar',
            'Or click Chrome menu (⋮) → "Add Rex to Desktop"',
            'Rex will open like a native app'
          ],
          icon: <DevicePhoneMobileIcon className="h-5 w-5 text-blue-600" />,
          buttonText: 'Done!'
        };
      case 'desktop-edge':
        return {
          title: 'Add Rex to Desktop',
          steps: [
            'Look for the add icon (+) in Edge\'s address bar',
            'Or click Edge menu (⋯) → "Apps" → "Add Rex"',
            'Rex will open like a native app'
          ],
          icon: <DevicePhoneMobileIcon className="h-5 w-5 text-blue-600" />,
          buttonText: 'Done!'
        };
      case 'desktop-firefox':
        return {
          title: 'Add Rex to Home Screen',
          steps: [
            'Firefox doesn\'t support app installation',
            'But you can bookmark Rex for easy access',
            'It will still work great in your browser!'
          ],
          icon: <DevicePhoneMobileIcon className="h-5 w-5 text-blue-600" />,
          buttonText: 'Done!'
        };
      default:
        return {
          title: 'Add Rex to Home Screen',
          steps: [
            'Look for "Add to Home Screen" in your browser menu',
            'Or check your browser\'s install options',
            'Rex will work like a native app!'
          ],
          icon: <DevicePhoneMobileIcon className="h-5 w-5 text-blue-600" />,
          buttonText: 'Done!'
        };
    }
  };

  const instructions = getInstructions();
  const canUseNativePrompt = deferredPrompt && platform === 'android-chrome';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📱</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {instructions.title}
          </h2>
          <p className="text-gray-600 text-sm">
            Add Rex to your home screen - no download needed, works like a native app
          </p>
        </div>

        {/* Instructions */}
        {instructions.steps.length > 0 && (
          <div className="mb-6">
            <div className="space-y-3">
              {instructions.steps.map((step, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">
                    {index + 1}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform-specific hints */}
        {platform === 'ios-safari' && (
          <div className="mb-6 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2 text-sm text-blue-800">
              {instructions.icon}
              <span>Look for the share icon in Safari</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          {canUseNativePrompt ? (
            <button
              onClick={handleNativeInstall}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Add Now
            </button>
          ) : (
            <button
              onClick={onDismiss}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {instructions.buttonText}
            </button>
          )}
          
          <button
            onClick={onDismiss}
            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
          >
            Maybe Later
          </button>
        </div>

        {/* Benefits */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg mb-1">⚡</div>
              <div className="text-xs text-gray-600">Faster</div>
            </div>
            <div>
              <div className="text-lg mb-1">📱</div>
              <div className="text-xs text-gray-600">Native Feel</div>
            </div>
            <div>
              <div className="text-lg mb-1">🔔</div>
              <div className="text-xs text-gray-600">Notifications</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 