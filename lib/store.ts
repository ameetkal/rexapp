import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { User, Post, PersonalItem, Thing, UserThingInteraction, PostV2, Recommendation } from './types';

interface AuthState {
  user: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  setUser: (user: FirebaseUser | null) => void;
  setUserProfile: (profile: User | null) => void;
  setLoading: (loading: boolean) => void;
}

interface AppState {
  // OLD SYSTEM (for backward compatibility)
  posts: Post[];
  personalItems: PersonalItem[];
  
  // NEW SYSTEM
  postsV2: PostV2[];
  things: Thing[];
  userInteractions: UserThingInteraction[];
  recommendations: Recommendation[];
  
  // OLD SYSTEM SETTERS
  setPosts: (posts: Post[]) => void;
  setPersonalItems: (items: PersonalItem[]) => void;
  addPost: (post: Post) => void;
  addPersonalItem: (item: PersonalItem) => void;
  updatePost: (postId: string, updates: Partial<Post>) => void;
  updatePersonalItem: (itemId: string, updates: Partial<PersonalItem>) => void;
  removePost: (postId: string) => void;
  removePersonalItem: (itemId: string) => void;
  
  // NEW SYSTEM SETTERS
  setPostsV2: (posts: PostV2[]) => void;
  setThings: (things: Thing[]) => void;
  setUserInteractions: (interactions: UserThingInteraction[]) => void;
  setRecommendations: (recommendations: Recommendation[]) => void;
  addPostV2: (post: PostV2) => void;
  addThing: (thing: Thing) => void;
  addUserInteraction: (interaction: UserThingInteraction) => void;
  addRecommendation: (recommendation: Recommendation) => void;
  updateUserInteraction: (interactionId: string, updates: Partial<UserThingInteraction>) => void;
  removeUserInteraction: (interactionId: string) => void;
  
  // HELPER FUNCTIONS (OLD SYSTEM)
  getSavedItems: () => PersonalItem[];
  getCompletedItems: () => PersonalItem[];
  getSharedItems: () => PersonalItem[];
  
  // HELPER FUNCTIONS (NEW SYSTEM)
  getBucketListInteractions: () => UserThingInteraction[];
  getCompletedInteractions: () => UserThingInteraction[];
  getInProgressInteractions: () => UserThingInteraction[];
  getThingById: (thingId: string) => Thing | undefined;
  getUserInteractionByThingId: (thingId: string) => UserThingInteraction | undefined;
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
  // OLD SYSTEM INITIALIZATION
  posts: [],
  personalItems: [],
  
  // NEW SYSTEM INITIALIZATION
  postsV2: [],
  things: [],
  userInteractions: [],
  recommendations: [],
  
  // OLD SYSTEM SETTERS
  setPosts: (posts) => set({ posts }),
  setPersonalItems: (personalItems) => set({ personalItems }),
  addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
  addPersonalItem: (item) => set((state) => ({ personalItems: [item, ...state.personalItems] })),
  updatePost: (postId, updates) => set((state) => ({
    posts: state.posts.map((post) =>
      post.id === postId ? { ...post, ...updates } : post
    ),
  })),
  updatePersonalItem: (itemId, updates) => set((state) => ({
    personalItems: state.personalItems.map((item) =>
      item.id === itemId ? { ...item, ...updates } : item
    ),
  })),
  removePost: (postId) => set((state) => ({
    posts: state.posts.filter((post) => post.id !== postId),
  })),
  removePersonalItem: (itemId) => set((state) => ({
    personalItems: state.personalItems.filter((item) => item.id !== itemId),
  })),
  
  // NEW SYSTEM SETTERS
  setPostsV2: (postsV2) => set({ postsV2 }),
  setThings: (things) => set({ things }),
  setUserInteractions: (userInteractions) => set({ userInteractions }),
  setRecommendations: (recommendations) => set({ recommendations }),
  addPostV2: (post) => set((state) => ({ postsV2: [post, ...state.postsV2] })),
  addThing: (thing) => set((state) => ({ things: [thing, ...state.things] })),
  addUserInteraction: (interaction) => set((state) => ({ userInteractions: [interaction, ...state.userInteractions] })),
  addRecommendation: (recommendation) => set((state) => ({ recommendations: [recommendation, ...state.recommendations] })),
  updateUserInteraction: (interactionId, updates) => set((state) => ({
    userInteractions: state.userInteractions.map((interaction) =>
      interaction.id === interactionId ? { ...interaction, ...updates } : interaction
    ),
  })),
  removeUserInteraction: (interactionId) => set((state) => ({
    userInteractions: state.userInteractions.filter((interaction) => interaction.id !== interactionId),
  })),
  
  // OLD SYSTEM HELPER FUNCTIONS
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
  
  // NEW SYSTEM HELPER FUNCTIONS
  getBucketListInteractions: () => {
    const state = get();
    return state.userInteractions.filter(interaction => interaction.state === 'bucketList');
  },
  getCompletedInteractions: () => {
    const state = get();
    return state.userInteractions.filter(interaction => interaction.state === 'completed');
  },
  getInProgressInteractions: () => {
    const state = get();
    return state.userInteractions.filter(interaction => interaction.state === 'inProgress');
  },
  getThingById: (thingId) => {
    const state = get();
    return state.things.find(thing => thing.id === thingId);
  },
  getUserInteractionByThingId: (thingId) => {
    const state = get();
    return state.userInteractions.find(interaction => interaction.thingId === thingId);
  },
})); 