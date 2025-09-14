import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from './types';
import { checkUsernameAvailability } from './firestore';

export const signUp = async (email: string, password: string, name: string, username?: string) => {
  try {
    // Check username availability if provided
    if (username) {
      const isAvailable = await checkUsernameAvailability(username);
      if (!isAvailable) {
        throw new Error('Username is already taken');
      }
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create user profile in Firestore
    const userProfile: User = {
      id: user.uid,
      name,
      email,
      username: username ? username.toLowerCase() : undefined,
      following: [],
      followers: [],
      createdAt: serverTimestamp() as unknown as Timestamp,
      notificationPreferences: {
        tagged: true,
        mentioned: true,
        followed: true,
        post_liked: true,
        email_notifications: false,
      }
    };
    
    console.log('📝 Creating user profile in Firestore for:', user.uid);
    await setDoc(doc(db, 'users', user.uid), userProfile);
    console.log('✅ User profile created successfully');
    
    return { user, userProfile };
  } catch (error) {
    console.error('❌ Error in signUp function:', error);
    throw error;
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data() as User;
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

export const onAuthStateChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
}; 