'use client';

import { useEffect, useState, useRef } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '@/lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { User } from '@/lib/types';
import { processInvitation } from '@/lib/firestore';

interface ClerkAuthProviderProps {
  children: React.ReactNode;
}

export default function ClerkAuthProvider({ children }: ClerkAuthProviderProps) {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { userId } = useAuth();
  const searchParams = useSearchParams();
  const { setUser, setUserProfile, setLoading } = useAuthStore();
  const [firebaseSignedIn, setFirebaseSignedIn] = useState(false);
  const [inviteProcessed, setInviteProcessed] = useState(false);
  // Use ref for synchronous lock to prevent race conditions (state updates are async)
  const inviteProcessingRef = useRef(false);
  
  // Get invite code from URL
  const inviteCode = searchParams.get('i') || searchParams.get('invite');

  useEffect(() => {
    const syncUserToFirestore = async () => {
      
      if (!isLoaded) {
        setLoading(true);
        return;
      }
      
      // Check if this is account creation (has pending profile data)
      const hasPendingProfileData = localStorage.getItem('pendingProfileData');
      const isOnProfilePage = window.location.href.includes('step=profile');
      const isAccountCreationFlow = hasPendingProfileData || isOnProfilePage;
      
      if (isAccountCreationFlow) {
        setLoading(true);
      } else {
        setLoading(false);
      }
      
      

      if (!isSignedIn || !clerkUser || !userId) {
        // User is signed out
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        setFirebaseSignedIn(false);
        return;
      }

      try {
        // Step 1: Get Firebase custom token from our API
        if (!firebaseSignedIn) {
          // Add timeout and retry logic
          let attempts = 0;
          const maxAttempts = 3;
          let data;
          
          while (attempts < maxAttempts) {
            try {
              attempts++;
              
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
              
              const response = await fetch('/api/auth/firebase-token', {
                signal: controller.signal,
                headers: {
                  'Content-Type': 'application/json',
                }
              });
              
              clearTimeout(timeoutId);
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              const responseText = await response.text();
              
              if (!responseText.trim()) {
                throw new Error('Empty response from server');
              }
              
              data = JSON.parse(responseText);
              break; // Success, exit retry loop
              
            } catch (error) {
              
              if (attempts >= maxAttempts) {
                if (error instanceof SyntaxError) {
                  throw new Error('Server communication error. Please refresh the page and try again.');
                } else {
                  throw error;
                }
              }
              
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
          }
          
          // Step 2: Sign in to Firebase with the custom token
          await signInWithCustomToken(firebaseAuth, data.token);
          setFirebaseSignedIn(true);
        }
        
        // Set the basic user object for Zustand
        setUser({ uid: userId });

        // Check if Firestore user document exists
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        
        let userProfileData: User;
        
        if (userDoc.exists()) {
          // User exists in Firestore - load their profile
          userProfileData = userDoc.data() as User;
          setUserProfile(userProfileData);
        } else {
          // New user - check if they have completed profile setup
          
          // Check for pending profile data from ProfileCompletion
          let pendingProfileData = null;
          try {
            const stored = localStorage.getItem('pendingProfileData');
            if (stored) {
              pendingProfileData = JSON.parse(stored);
            }
          } catch (error) {
            console.error('Error parsing pending profile data:', error);
          }
          
          if (pendingProfileData) {
            // User has completed profile - create Firestore document
            console.log('👤 Creating new user profile with data:', {
              name: pendingProfileData.name,
              username: pendingProfileData.username,
              email: pendingProfileData.email
            });
            
            const userName = pendingProfileData.name;
            const userUsername = pendingProfileData.username;
            const userEmail = pendingProfileData.email || '';
            
            const newUserProfile: User = {
              id: userId,
              name: userName,
              email: userEmail,
              username: userUsername,
              phoneNumber: clerkUser.primaryPhoneNumber?.phoneNumber,
              following: [],
              followers: [],
              createdAt: Timestamp.now(),
            };

            console.log('💾 Saving new user profile to Firestore...');
            await setDoc(userDocRef, newUserProfile);
            console.log('✅ New user profile saved to Firestore');
            
            console.log('📝 Setting user profile in Zustand store:', newUserProfile.name);
            setUserProfile(newUserProfile);
            userProfileData = newUserProfile;
            
            // Clean up localStorage after successful user creation
            localStorage.removeItem('pendingProfileData');
            console.log('🧹 Cleaned up pendingProfileData from localStorage');
          } else {
            // User hasn't completed profile yet - redirect to profile completion
            if (!isOnProfilePage) {
              window.location.href = '/?step=profile';
              return; // Don't set loading false here, let the redirect handle it
            }
            setLoading(false);
            return;
          }
        }
        
        // Process invitation if present (for both new and existing users)
        // Use ref check for synchronous lock (state updates are async and can cause race conditions)
        if (inviteCode && !inviteProcessed && !inviteProcessingRef.current) {
          // Set ref IMMEDIATELY for synchronous lock (prevents race condition)
          inviteProcessingRef.current = true;
          setInviteProcessed(true);
          
          console.log('🎁 ClerkAuthProvider: Processing invitation...', {
            inviteCode,
            userId,
            userName: userProfileData.name,
            isNewUser: !userDoc.exists(),
            userProfileData,
            existingFollowingCount: userProfileData.following?.length || 0
          });
          
          const inviteSuccess = await processInvitation(
            userId,
            userProfileData.name,
            inviteCode,
            !userDoc.exists()
          );
          
          console.log('🎁 ClerkAuthProvider: Invitation processing result:', inviteSuccess);
          
          if (inviteSuccess) {
            
            // Small delay to ensure Firestore writes are complete
            console.log('⏳ Waiting 500ms for Firestore writes to complete...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Refresh user profile to get updated following list
            console.log('🔄 Refreshing user profile after invitation processing...');
            const updatedUserDoc = await getDoc(userDocRef);
            if (updatedUserDoc.exists()) {
              const updatedProfile = updatedUserDoc.data() as User;
              console.log('📊 Profile comparison:', {
                before: userProfileData.following?.length || 0,
                after: updatedProfile.following?.length || 0,
                newFollowingList: updatedProfile.following
              });
              setUserProfile(updatedProfile);
              console.log('✅ User profile refreshed with following:', updatedProfile.following);
              
              // Trigger feed reload by dispatching a custom event
              // This ensures the feed loads with the updated following list
              console.log('🔄 Triggering feed reload after invitation...');
              window.dispatchEvent(new CustomEvent('invitationProcessed', { 
                detail: { following: updatedProfile.following } 
              }));
              
              // Also redirect to feed tab to show the new content
              console.log('🔄 Redirecting to feed tab after invitation...');
              setTimeout(() => {
                if (typeof window !== 'undefined') {
                  // Update URL to show feed tab
                  const currentUrl = new URL(window.location.href);
                  currentUrl.searchParams.delete('invite');
                  currentUrl.searchParams.delete('i');
                  currentUrl.searchParams.delete('step');
                  window.history.replaceState({}, '', currentUrl.toString());
                  
                  // Dispatch event to switch to feed tab
                  window.dispatchEvent(new CustomEvent('switchToFeed'));
                }
              }, 1000); // Small delay to ensure profile is updated
            } else {
              console.error('❌ Updated user profile not found in Firestore');
            }
          } else {
            console.error('❌ Invitation processing returned false');
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('❌ Error syncing Clerk user to Firestore:', error);
        setLoading(false);
      }
    };

    syncUserToFirestore();
  }, [isLoaded, isSignedIn, clerkUser, userId, firebaseSignedIn, inviteCode, inviteProcessed]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}