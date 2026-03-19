import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mustChangePassword: boolean;
  role: {
    id: string;
    name: string;
    permissions: string[];
  };
}

interface AuthState {
  user: AuthUser | null;
  permissions: string[];
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
  setMustChangePassword: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      permissions: [],
      isAuthenticated: false,
      mustChangePassword: false,

      login: (user) => {
        set({
          user,
          permissions: user.role.permissions,
          isAuthenticated: true,
          mustChangePassword: user.mustChangePassword,
        });
      },

      logout: () => {
        set({
          user: null,
          permissions: [],
          isAuthenticated: false,
          mustChangePassword: false,
        });
      },

      setMustChangePassword: (value) => {
        set((state) => ({
          mustChangePassword: value,
          user: state.user ? { ...state.user, mustChangePassword: value } : null,
        }));
      },
    }),
    {
      name: 'helpdesk_auth',
      partialize: (state) => ({
        user: state.user,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
        mustChangePassword: state.mustChangePassword,
      }),
    }
  )
);
