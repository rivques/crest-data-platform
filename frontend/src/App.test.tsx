import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { useAuthStore } from './stores/authStore'

// Mock the auth store
vi.mock('./stores/authStore', () => ({
  useAuthStore: vi.fn(),
}))

const mockUseAuthStore = vi.mocked(useAuthStore)

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default to unauthenticated state
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        isAuthenticated: false,
        accessToken: null,
        refreshToken: null,
        user: null,
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        setTokens: vi.fn(),
        fetchUser: vi.fn(),
      }
      if (typeof selector === 'function') {
        return selector(state)
      }
      return state
    })
  })

  describe('when not authenticated', () => {
    it('redirects to login page when accessing protected routes', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
      })
    })

    it('shows login page elements', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('CREST Data Platform')).toBeInTheDocument()
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      })
    })

    it('shows sign in button', async () => {
      render(<App />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
      })
    })
  })
})
