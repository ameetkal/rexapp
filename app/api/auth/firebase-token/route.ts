import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin (lazy initialization)
function initializeFirebaseAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    
    console.log('🔧 Firebase Admin Init Check:');
    console.log('- Project ID:', projectId ? '✅' : '❌ MISSING');
    console.log('- Client Email:', clientEmail ? '✅' : '❌ MISSING');
    console.log('- Private Key:', privateKey ? `✅ (${privateKey.substring(0, 30)}...)` : '❌ MISSING');
    
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase Admin credentials in environment variables');
    }
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized successfully');
  }
  return admin;
}

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      console.error('❌ No Clerk userId in request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🔑 Creating Firebase token for Clerk user:', userId);
    
    // Initialize Firebase Admin (only when actually needed)
    const adminApp = initializeFirebaseAdmin();
    
    // Create Firebase custom token for this Clerk user ID
    const firebaseToken = await adminApp.auth().createCustomToken(userId);
    
    console.log('✅ Firebase token created successfully');
    return NextResponse.json({ token: firebaseToken });
  } catch (error) {
    console.error('❌ Error creating Firebase token:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create token', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
}


