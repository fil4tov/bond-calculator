import { create } from 'zustand';

import { ApiError } from '#shared/api';

import { getCurrentUser, loginUser, logoutUser, registerUser } from './api';
import type { Credentials, User, UserStatus } from './types';

interface UserState {
  status: UserStatus;
  user: User | null;
  initialize: () => Promise<void>;
  login: (credentials: Credentials) => Promise<void>;
  register: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
}

let initializationPromise: Promise<void> | null = null;

export const useUserStore = create<UserState>((set, get) => ({
  status: 'checking',
  user: null,

  initialize: async () => {
    if (get().status !== 'checking') return;
    if (!initializationPromise) {
      initializationPromise = (async () => {
        try {
          const user = await getCurrentUser();
          set({ status: 'authenticated', user });
        } catch (error) {
          if (error instanceof ApiError && error.code === 'unauthenticated') {
            set({ status: 'anonymous', user: null });
            return;
          }
          set({ status: 'anonymous', user: null });
        }
      })().finally(() => {
        initializationPromise = null;
      });
    }
    await initializationPromise;
  },

  login: async (credentials) => {
    const user = await loginUser(credentials);
    set({ status: 'authenticated', user });
  },

  register: async (credentials) => {
    const user = await registerUser(credentials);
    set({ status: 'authenticated', user });
  },

  logout: async () => {
    await logoutUser();
    set({ status: 'anonymous', user: null });
  },
}));
