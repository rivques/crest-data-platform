import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../lib/api'
import type { User } from '../types/api'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  _hasHydrated: boolean
  
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  setTokens: (access: string, refresh: string) => void
  fetchUser: () => Promise<void>
  initializeAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      _hasHydrated: false,
      
      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/auth/login/', { username, password })
          const { access, refresh } = response.data
          
          set({
            accessToken: access,
            refreshToken: refresh,
            isAuthenticated: true,
            isLoading: false,
          })
          
          // Fetch user profile after login
          await get().fetchUser()
        } catch (error: unknown) {
          const message = error instanceof Error 
            ? error.message 
            : 'Login failed. Please check your credentials.'
          set({
            isLoading: false,
            error: message,
            isAuthenticated: false,
          })
          throw error
        }
      },
      
      logout: () => {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
          error: null,
        })
      },
      
      setTokens: (access: string, refresh: string) => {
        set({
          accessToken: access,
          refreshToken: refresh,
          isAuthenticated: true,
        })
      },
      
      fetchUser: async () => {
        try {
          const response = await api.get('/auth/profile/')
          set({ user: response.data })
        } catch (error) {
          // If fetching user fails (e.g., token expired), log out
          if (import.meta.env.DEV) {
            console.error('Failed to fetch user profile:', error)
          }
        }
      },
      
      initializeAuth: async () => {
        // Called after hydration to fetch user if tokens exist
        const state = get()
        if (state.isAuthenticated && state.accessToken && !state.user) {
          await state.fetchUser()
        }
      },
    }),
    {
      name: 'crest-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => async (state) => {
        // After hydration, fetch user if authenticated
        if (state) {
          state._hasHydrated = true
          if (state.isAuthenticated && state.accessToken) {
            await state.fetchUser()
          }
        }
      },
    }
  )
)
