import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { User, Post } from './types';

interface AuthState {
  user: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  setUser: (user: FirebaseUser | null) => void;
  setUserProfile: (profile: User | null) => void;
  setLoading: (loading: boolean) => void;
}

interface AppState {
  posts: Post[];
  savedPosts: Post[];
  setPosts: (posts: Post[]) => void;
  setSavedPosts: (posts: Post[]) => void;
  addPost: (post: Post) => void;
  toggleSavePost: (postId: string, userId: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userProfile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setUserProfile: (userProfile) => set({ userProfile }),
  setLoading: (loading) => set({ loading }),
}));

export const useAppStore = create<AppState>((set) => ({
  posts: [],
  savedPosts: [],
  setPosts: (posts) => set({ posts }),
  setSavedPosts: (savedPosts) => set({ savedPosts }),
  addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
  toggleSavePost: (postId, userId) => set((state) => ({
    posts: state.posts.map((post) => {
      if (post.id === postId) {
        const savedBy = post.savedBy.includes(userId)
          ? post.savedBy.filter((id) => id !== userId)
          : [...post.savedBy, userId];
        return { ...post, savedBy };
      }
      return post;
    }),
  })),
})); 