import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Layout from './Layout'
import { useAuthStore } from '../stores/authStore'

// Mock the auth store
vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}))

const mockUseAuthStore = vi.mocked(useAuthStore)

const renderLayout = () => {
  return render(
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}

describe('Layout', () => {
  const mockLogout = vi.fn()
  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin' as const,
    created_at: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock with selector support - zustand uses selectors
    mockUseAuthStore.mockImplementation((selector?: unknown) => {
      const state = {
        user: mockUser,
        logout: mockLogout,
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: vi.fn(),
        setTokens: vi.fn(),
        fetchUser: vi.fn(),
      }
      if (typeof selector === 'function') {
        return selector(state)
      }
      return state
    })
  })

  it('renders the sidebar with navigation items', () => {
    renderLayout()

    expect(screen.getByText('CREST Data Platform')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Experiments')).toBeInTheDocument()
    expect(screen.getByText('Sensors')).toBeInTheDocument()
    expect(screen.getByText('API Keys')).toBeInTheDocument()
    expect(screen.getByText('Data Explorer')).toBeInTheDocument()
  })

  it('displays user information', () => {
    renderLayout()

    expect(screen.getByText('testuser')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('calls logout when logout button is clicked', async () => {
    const user = userEvent.setup()
    renderLayout()

    const logoutButton = screen.getByTitle('Logout')
    await user.click(logoutButton)

    expect(mockLogout).toHaveBeenCalled()
  })

  it('navigation links have correct paths', () => {
    renderLayout()

    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('href', '/dashboard')
    expect(screen.getByText('Experiments').closest('a')).toHaveAttribute('href', '/experiments')
    expect(screen.getByText('Sensors').closest('a')).toHaveAttribute('href', '/sensors')
    expect(screen.getByText('API Keys').closest('a')).toHaveAttribute('href', '/api-keys')
    expect(screen.getByText('Data Explorer').closest('a')).toHaveAttribute('href', '/data')
  })

  it('toggles mobile sidebar when menu button is clicked', async () => {
    const user = userEvent.setup()
    renderLayout()

    // The sidebar should have the translate class initially (hidden on mobile)
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveClass('-translate-x-full')

    // Click the menu button to open sidebar
    const menuButtons = screen.getAllByRole('button')
    const menuButton = menuButtons.find(btn => btn.className.includes('lg:hidden'))
    
    if (menuButton) {
      await user.click(menuButton)
      await waitFor(() => {
        expect(sidebar).toHaveClass('translate-x-0')
      })
    }
  })
})
