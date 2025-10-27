import { create } from 'zustand';
import { User, Thing, UserThingInteraction, Recommendation } from './types';

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
  things: Thing[];
  userInteractions: UserThingInteraction[];
  recommendations: Recommendation[];
  autoOpenThingId: string | null;
  
  setThings: (things: Thing[]) => void;
  setUserInteractions: (interactions: UserThingInteraction[]) => void;
  setRecommendations: (recommendations: Recommendation[]) => void;
  setAutoOpenThingId: (thingId: string | null) => void;
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
  setLoading: (loading) => {
    console.log('🔄 Zustand setLoading called with:', loading);
    set({ loading });
  },
}));

export const useAppStore = create<AppState>((set, get) => ({
  things: [],
  userInteractions: [],
  recommendations: [],
  autoOpenThingId: null,
  
  setThings: (things) => set({ things }),
  setUserInteractions: (userInteractions) => set({ userInteractions }),
  setRecommendations: (recommendations) => set({ recommendations }),
  setAutoOpenThingId: (thingId) => set({ autoOpenThingId: thingId }),
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