import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { useAuthStore } from './authStore'
import { server } from '../test/mocks/server'
import { http, HttpResponse } from 'msw'

describe('authStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    const { getState } = useAuthStore
    act(() => {
      getState().logout()
    })
    // Clear localStorage
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useAuthStore.getState()
      
      expect(state.accessToken).toBeNull()
      expect(state.refreshToken).toBeNull()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('login', () => {
    it('successfully logs in with valid credentials', async () => {
      const { login, getState } = useAuthStore.getState()
      
      await act(async () => {
        await login('testuser', 'password123')
      })
      
      const state = useAuthStore.getState()
      expect(state.accessToken).toBe('mock-access-token')
      expect(state.refreshToken).toBe('mock-refresh-token')
      expect(state.isAuthenticated).toBe(true)
      expect(state.isLoading).toBe(false)
    })

    it('sets loading state during login', async () => {
      // Delay the response to check loading state
      server.use(
        http.post('/api/auth/login/', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return HttpResponse.json({
            access: 'mock-access-token',
            refresh: 'mock-refresh-token',
          })
        })
      )

      const loginPromise = act(async () => {
        const promise = useAuthStore.getState().login('testuser', 'password123')
        // Check loading state immediately
        expect(useAuthStore.getState().isLoading).toBe(true)
        return promise
      })

      await loginPromise
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it('handles login failure', async () => {
      server.use(
        http.post('/api/auth/login/', () => {
          return HttpResponse.json(
            { detail: 'Invalid credentials' },
            { status: 401 }
          )
        })
      )

      await act(async () => {
        try {
          await useAuthStore.getState().login('wronguser', 'wrongpass')
        } catch {
          // Expected to throw
        }
      })

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
    })

    it('fetches user profile after successful login', async () => {
      await act(async () => {
        await useAuthStore.getState().login('testuser', 'password123')
      })

      const state = useAuthStore.getState()
      expect(state.user).toBeDefined()
      expect(state.user?.username).toBe('testuser')
    })
  })

  describe('logout', () => {
    it('clears all auth state on logout', async () => {
      // First login
      await act(async () => {
        await useAuthStore.getState().login('testuser', 'password123')
      })

      // Verify logged in
      expect(useAuthStore.getState().isAuthenticated).toBe(true)

      // Logout
      act(() => {
        useAuthStore.getState().logout()
      })

      const state = useAuthStore.getState()
      expect(state.accessToken).toBeNull()
      expect(state.refreshToken).toBeNull()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('setTokens', () => {
    it('updates tokens and sets authenticated', () => {
      act(() => {
        useAuthStore.getState().setTokens('new-access', 'new-refresh')
      })

      const state = useAuthStore.getState()
      expect(state.accessToken).toBe('new-access')
      expect(state.refreshToken).toBe('new-refresh')
      expect(state.isAuthenticated).toBe(true)
    })
  })

  describe('fetchUser', () => {
    it('fetches and sets user data', async () => {
      // Set tokens first (simulating logged in state)
      act(() => {
        useAuthStore.getState().setTokens('test-access', 'test-refresh')
      })

      await act(async () => {
        await useAuthStore.getState().fetchUser()
      })

      const state = useAuthStore.getState()
      expect(state.user).toBeDefined()
      expect(state.user?.username).toBe('testuser')
      expect(state.user?.email).toBe('test@example.com')
      expect(state.user?.role).toBe('admin')
    })

    it('handles fetch user failure gracefully', async () => {
      server.use(
        http.get('/api/auth/profile/', () => {
          return HttpResponse.json(
            { detail: 'Unauthorized' },
            { status: 401 }
          )
        })
      )

      // Should not throw
      await act(async () => {
        await useAuthStore.getState().fetchUser()
      })

      // User should remain null
      expect(useAuthStore.getState().user).toBeNull()
    })
  })

  describe('persistence', () => {
    it('persists auth state to localStorage', async () => {
      await act(async () => {
        await useAuthStore.getState().login('testuser', 'password123')
      })

      // Check localStorage
      const stored = localStorage.getItem('crest-auth')
      expect(stored).toBeDefined()
      
      const parsed = JSON.parse(stored!)
      expect(parsed.state.accessToken).toBe('mock-access-token')
      expect(parsed.state.isAuthenticated).toBe(true)
    })
  })
})
