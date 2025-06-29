'use client';

import { useState, useEffect } from 'react';

export function usePWAInstallStatus() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkInstallStatus = () => {
      try {
        // Method 1: Check if running in standalone mode (PWA is installed and launched)
        const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
        
        // Method 2: Check for iOS standalone mode
        const isIOSStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
        
        // PWA is considered installed if running in standalone mode
        const installed = isStandalone || isIOSStandalone;
        
        setIsInstalled(installed);
        setIsLoading(false);
        
        return installed;
      } catch (error) {
        console.error('Error checking PWA install status:', error);
        setIsLoading(false);
        return false;
      }
    };

    // Check immediately
    checkInstallStatus();

    // Also listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => checkInstallStatus();
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return { isInstalled, isLoading };
} 