import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { User, Post, PersonalItem } from './types';

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
  personalItems: PersonalItem[];
  setPosts: (posts: Post[]) => void;
  setPersonalItems: (items: PersonalItem[]) => void;
  addPost: (post: Post) => void;
  addPersonalItem: (item: PersonalItem) => void;
  updatePersonalItem: (itemId: string, updates: Partial<PersonalItem>) => void;
  removePersonalItem: (itemId: string) => void;
  getSavedItems: () => PersonalItem[];
  getCompletedItems: () => PersonalItem[];
  getSharedItems: () => PersonalItem[];
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userProfile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setUserProfile: (userProfile) => set({ userProfile }),
  setLoading: (loading) => set({ loading }),
}));

export const useAppStore = create<AppState>((set, get) => ({
  posts: [],
  personalItems: [],
  setPosts: (posts) => set({ posts }),
  setPersonalItems: (personalItems) => set({ personalItems }),
  addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
  addPersonalItem: (item) => set((state) => ({ personalItems: [item, ...state.personalItems] })),
  updatePersonalItem: (itemId, updates) => set((state) => ({
    personalItems: state.personalItems.map((item) =>
      item.id === itemId ? { ...item, ...updates } : item
    ),
  })),
  removePersonalItem: (itemId) => set((state) => ({
    personalItems: state.personalItems.filter((item) => item.id !== itemId),
  })),
  getSavedItems: () => {
    const state = get();
    return state.personalItems.filter(item => item.status === 'want_to_try');
  },
  getCompletedItems: () => {
    const state = get();
    return state.personalItems.filter(item => item.status === 'completed');
  },
  getSharedItems: () => {
    const state = get();
    return state.personalItems.filter(item => item.status === 'shared');
  },
})); 