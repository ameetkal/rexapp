'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuthStore, useAppStore } from '@/lib/store';
import { getUserProfile } from '@/lib/auth';
import { getThing, getUserThingInteraction, createUserThingInteraction, createRecommendation } from '@/lib/firestore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function SharePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, userProfile, setUserProfile } = useAuthStore();
  const { setAutoOpenThingId } = useAppStore();
  
  const [, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const thingId = params.thingId as string;
  const senderId = searchParams.get('from');
  
  useEffect(() => {
    const processShare = async () => {
      try {
        // Check if user is authenticated
        if (!user || !userProfile) {
          // Redirect to signup with return URL
          const returnUrl = encodeURIComponent(window.location.href);
          router.push(`/?signup=true&returnUrl=${returnUrl}`);
          return;
        }
        
        // Load sender profile
        if (!senderId) {
          setError('Invalid share link');
          setLoading(false);
          return;
        }
        
        const senderProfile = await getUserProfile(senderId);
        if (!senderProfile) {
          setError('Sender not found');
          setLoading(false);
          return;
        }
        
        // Check if user is following the sender
        const isFollowing = userProfile.following?.includes(senderId) || false;
        if (!isFollowing) {
          // Auto-follow the sender
          console.log('🔗 Auto-following sender:', senderProfile.name);
          const updatedFollowing = [...(userProfile.following || []), senderId];
          
          // Update user profile in Firestore
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
            following: updatedFollowing
          });
          
          // Update local state
          const updatedProfile = { ...userProfile, following: updatedFollowing };
          setUserProfile(updatedProfile);
        }
        
        // Load the thing
        const thing = await getThing(thingId);
        if (!thing) {
          setError('Thing not found');
          setLoading(false);
          return;
        }
        
        // Check if user already has an interaction with this thing
        const existingInteraction = await getUserThingInteraction(user.uid, thingId);
        
        if (!existingInteraction) {
          // User doesn't have this thing - auto-save it
          console.log('🔗 Auto-saving thing:', thing.title);
          
          // Create interaction (saved state)
          await createUserThingInteraction(
            user.uid,
            userProfile.name,
            thingId,
            'bucketList',
            'friends'
          );
          
          // Create recommendation record
          await createRecommendation(
            senderId,
            user.uid,
            thingId,
            `Shared ${thing.title} via SMS`
          );
          
          console.log('✅ Thing auto-saved');
        }
        
        // Wait a moment for feed data to sync
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Set the thing to auto-open
        setAutoOpenThingId(thingId);
        
        // Navigate to feed
        router.push('/');
        
      } catch (err) {
        console.error('Error processing share:', err);
        setError('Failed to process share link');
        setLoading(false);
      }
    };
    
    processShare();
  }, [user, userProfile, thingId, senderId, router, setAutoOpenThingId, setUserProfile]);
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 mb-2">Error</p>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Opening shared item...</p>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <SharePageContent />
    </Suspense>
  );
}
