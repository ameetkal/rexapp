'use client';

import { useEffect, useState } from 'react';
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
  
  // Get invite code from URL
  const inviteCode = searchParams.get('i') || searchParams.get('invite');

  useEffect(() => {
    const syncUserToFirestore = async () => {
      
      if (!isLoaded) {
        setLoading(true);
        return;
      }
      
      setLoading(false);
      
      
      // If user is on profile completion page, don't run ClerkAuthProvider
      if (window.location.href.includes('step=profile')) {
        setLoading(false);
        return;
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

            await setDoc(userDocRef, newUserProfile);
            setUserProfile(newUserProfile);
            userProfileData = newUserProfile;
            
            // Clean up localStorage after successful user creation
            localStorage.removeItem('pendingProfileData');
          } else {
            // User hasn't completed profile yet - redirect to profile completion
            if (!window.location.href.includes('step=profile')) {
              window.location.href = '/?step=profile';
              setLoading(false);
              return;
            } else {
              setLoading(false);
              return;
            }
          }
        }
        
        // Process invitation if present (for both new and existing users)
        if (inviteCode && !inviteProcessed) {
          const inviteSuccess = await processInvitation(
            userId,
            userProfileData.name,
            inviteCode,
            !userDoc.exists()
          );
          
          if (inviteSuccess) {
            setInviteProcessed(true);
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