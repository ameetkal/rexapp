import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from './types';
import { checkUsernameAvailability } from './firestore';

// Helper function to remove undefined values from objects
const cleanObject = <T>(obj: T): Partial<T> => {
  const cleaned: Partial<T> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively clean nested objects
        const cleanedNested = cleanObject(value);
        if (Object.keys(cleanedNested).length > 0) {
          (cleaned as Record<string, unknown>)[key] = cleanedNested;
        }
      } else {
        (cleaned as Record<string, unknown>)[key] = value;
      }
    }
  }
  return cleaned;
};

// Generate a unique username based on the user's name
const generateUniqueUsername = async (name: string): Promise<string> => {
  // Clean the name and create a base username
  const baseUsername = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special characters
    .substring(0, 15); // Limit length
  
  // For now, just append a random number to ensure uniqueness
  // TODO: Implement proper username availability checking after user is created
  const randomSuffix = Math.floor(Math.random() * 10000);
  const username = `${baseUsername}${randomSuffix}`;
  
  console.log('🎲 Generated username:', username);
  return username;
};

export const signUp = async (email: string, password: string, name: string, username?: string) => {
  try {
    let finalUsername: string;
    
    if (username) {
      // User provided a username - use it directly (availability check can be done later)
      finalUsername = username.toLowerCase();
    } else {
      // Auto-generate a unique username
      finalUsername = await generateUniqueUsername(name);
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create user profile in Firestore (always include username)
    const userProfile: User = {
      id: user.uid,
      name,
      email,
      username: finalUsername,
      following: [],
      followers: [],
      createdAt: serverTimestamp() as unknown as Timestamp,
      notificationPreferences: {
        tagged: true,
        rec_given: true,
        comment: true,
        post_liked: true,
        followed: true,
        email_notifications: false,
      }
    };
    
    console.log('📝 Creating user profile in Firestore for:', user.uid);
    // Clean the userProfile to remove any undefined values before writing to Firestore
    const cleanedUserProfile = cleanObject(userProfile);
    await setDoc(doc(db, 'users', user.uid), cleanedUserProfile);
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

export const updateUsername = async (userId: string, newUsername: string): Promise<void> => {
  try {
    // Check if username is available
    const isAvailable = await checkUsernameAvailability(newUsername);
    if (!isAvailable) {
      throw new Error('Username is already taken');
    }

    // Update the username in Firestore
    await updateDoc(doc(db, 'users', userId), {
      username: newUsername.toLowerCase()
    });
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