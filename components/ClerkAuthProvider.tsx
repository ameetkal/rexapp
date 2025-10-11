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

/**
 * ClerkAuthProvider - Syncs Clerk authentication with Zustand store and Firestore
 * Creates Firebase custom tokens from Clerk sessions so Firestore rules work
 */
export default function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { userId } = useAuth();
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

      if (!isSignedIn || !clerkUser || !userId) {
        // User is signed out
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        setFirebaseSignedIn(false);
        return;
      }

      try {
        console.log('🔐 Clerk user authenticated:', userId);
        
        // Step 1: Get Firebase custom token from our API
        if (!firebaseSignedIn) {
          console.log('🔑 Getting Firebase token...');
          const response = await fetch('/api/auth/firebase-token');
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || 'Failed to get Firebase token');
          }
          
          // Step 2: Sign in to Firebase with the custom token
          console.log('🔥 Signing in to Firebase...');
          await signInWithCustomToken(firebaseAuth, data.token);
          setFirebaseSignedIn(true);
          console.log('✅ Firebase authenticated');
        }
        
        // Set the basic user object for Zustand
        setUser({ uid: userId });

        // Check if Firestore user document exists
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);

        const isNewUser = !userDocSnap.exists();
        let userProfileData: User;
        
        if (userDocSnap.exists()) {
          // Existing user - load their profile
          userProfileData = userDocSnap.data() as User;
          console.log('✅ Loaded existing Firestore user profile:', userProfileData.username);
          setUserProfile(userProfileData);
        } else {
          // New user - create Firestore document
          console.log('🆕 Creating new Firestore user document...');
          
          // Generate username from Clerk user data
          const firstName = clerkUser.firstName || clerkUser.username || 'user';
          const randomSuffix = Math.floor(Math.random() * 10000);
          const generatedUsername = `${firstName.toLowerCase().replace(/\s+/g, '_')}${randomSuffix}`;
          
          const newUserProfile: User = {
            id: userId,
            name: clerkUser.fullName || clerkUser.firstName || 'Rex User',
            email: clerkUser.primaryEmailAddress?.emailAddress || '',
            username: generatedUsername,
            phoneNumber: clerkUser.primaryPhoneNumber?.phoneNumber,
            following: [],
            followers: [],
            createdAt: Timestamp.now(),
          };

          await setDoc(userDocRef, newUserProfile);
          console.log('✅ Created new Firestore user:', generatedUsername);
          setUserProfile(newUserProfile);
          userProfileData = newUserProfile;
        }
        
        // Process invitation if present (for both new and existing users)
        if (inviteCode && !inviteProcessed) {
          console.log(`🎁 Processing invitation for ${isNewUser ? 'new' : 'existing'} user...`);
          const inviteSuccess = await processInvitation(
            userId,
            userProfileData.name,
            inviteCode,
            isNewUser
          );
          
          if (inviteSuccess) {
            setInviteProcessed(true);
            console.log('✅ Invitation processed! Auto-followed inviter and saved thing to bucket list');
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('❌ Error syncing Clerk user to Firestore:', error);
        setLoading(false);
      }
    };

    syncUserToFirestore();
  }, [isLoaded, isSignedIn, clerkUser, userId, setUser, setUserProfile, setLoading, firebaseSignedIn, inviteCode, inviteProcessed]);

  return <>{children}</>;
}

