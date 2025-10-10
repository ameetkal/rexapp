import { create } from 'zustand';
import { User, Thing, UserThingInteraction, PostV2, Recommendation } from './types';

// Simple auth user type (works with both Firebase and Clerk)
export interface AuthUser {
  uid: string;
}

interface AuthState {
  user: AuthUser | null;
  userProfile: User | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  setUserProfile: (profile: User | null) => void;
  setLoading: (loading: boolean) => void;
}

interface AppState {
  // DEPRECATED: postsV2 no longer used - replaced by userInteractions with visibility field
  postsV2: PostV2[];
  
  things: Thing[];
  userInteractions: UserThingInteraction[];
  recommendations: Recommendation[];
  
  // DEPRECATED: postsV2 setters no longer used
  setPostsV2: (posts: PostV2[]) => void;
  addPostV2: (post: PostV2) => void;
  
  setThings: (things: Thing[]) => void;
  setUserInteractions: (interactions: UserThingInteraction[]) => void;
  setRecommendations: (recommendations: Recommendation[]) => void;
  addThing: (thing: Thing) => void;
  addUserInteraction: (interaction: UserThingInteraction) => void;
  addRecommendation: (recommendation: Recommendation) => void;
  updateUserInteraction: (interactionId: string, updates: Partial<UserThingInteraction>) => void;
  removeUserInteraction: (interactionId: string) => void;
  
  // HELPER FUNCTIONS
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
  postsV2: [],
  things: [],
  userInteractions: [],
  recommendations: [],
  
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
  
  // HELPER FUNCTIONS
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