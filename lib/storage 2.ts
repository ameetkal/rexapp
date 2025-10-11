import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PHOTOS = 3;

export const uploadPhotos = async (files: File[], userId: string): Promise<string[]> => {
  try {
    // Validate number of files
    if (files.length > MAX_PHOTOS) {
      throw new Error(`Maximum ${MAX_PHOTOS} photos allowed`);
    }

    const urls: string[] = [];

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Photo "${file.name}" exceeds 5MB limit`);
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error(`File "${file.name}" is not an image`);
      }

      // Create unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const extension = file.name.split('.').pop();
      const filename = `${timestamp}_${randomString}.${extension}`;

      // Upload to Firebase Storage
      const storageRef = ref(storage, `users/${userId}/photos/${filename}`);
      await uploadBytes(storageRef, file);

      // Get download URL
      const url = await getDownloadURL(storageRef);
      urls.push(url);
      
      console.log('✅ Uploaded photo:', filename);
    }

    return urls;
  } catch (error) {
    console.error('Error uploading photos:', error);
    throw error;
  }
};

export const deletePhoto = async (photoUrl: string): Promise<void> => {
  try {
    // Extract path from URL
    const urlObj = new URL(photoUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)\?/);
    
    if (!pathMatch) {
      console.error('Could not extract path from URL:', photoUrl);
      return;
    }
    
    const path = decodeURIComponent(pathMatch[1]);
    const storageRef = ref(storage, path);
    
    await deleteObject(storageRef);
    console.log('✅ Deleted photo:', path);
  } catch (error) {
    console.error('Error deleting photo:', error);
    // Don't throw - photo deletion is not critical
  }
};

export const validatePhotoFile = (file: File): { valid: boolean; error?: string } => {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'Image must be under 5MB' };
  }
  
  return { valid: true };
};

export { MAX_PHOTOS, MAX_FILE_SIZE };

