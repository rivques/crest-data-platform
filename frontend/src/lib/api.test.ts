import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import api from './api'
import { useAuthStore } from '../stores/authStore'
import { server } from '../test/mocks/server'
import { http, HttpResponse } from 'msw'

// Mock the auth store
vi.mock('../stores/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}))

const mockUseAuthStore = vi.mocked(useAuthStore)

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuthStore.getState.mockReturnValue({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      user: null,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      setTokens: vi.fn(),
      fetchUser: vi.fn(),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('request interceptor', () => {
    it('adds authorization header when token exists', async () => {
      server.use(
        http.get('/api/test/', ({ request }) => {
          const authHeader = request.headers.get('Authorization')
          return HttpResponse.json({ auth: authHeader })
        })
      )

      const response = await api.get('/test/')
      
      expect(response.data.auth).toBe('Bearer test-access-token')
    })

    it('does not add authorization header when no token', async () => {
      mockUseAuthStore.getState.mockReturnValue({
        accessToken: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        login: vi.fn(),
        logout: vi.fn(),
        setTokens: vi.fn(),
        fetchUser: vi.fn(),
      })

      server.use(
        http.get('/api/test/', ({ request }) => {
          const authHeader = request.headers.get('Authorization')
          return HttpResponse.json({ auth: authHeader })
        })
      )

      const response = await api.get('/test/')
      
      expect(response.data.auth).toBeNull()
    })
  })

  describe('response interceptor', () => {
    it('returns response data on success', async () => {
      server.use(
        http.get('/api/test/', () => {
          return HttpResponse.json({ data: 'success' })
        })
      )

      const response = await api.get('/test/')
      
      expect(response.data).toEqual({ data: 'success' })
    })

    it('rejects on network error', async () => {
      server.use(
        http.get('/api/test/', () => {
          return HttpResponse.error()
        })
      )

      await expect(api.get('/test/')).rejects.toThrow()
    })

    it('rejects on 4xx errors', async () => {
      server.use(
        http.get('/api/test/', () => {
          return HttpResponse.json(
            { detail: 'Not found' },
            { status: 404 }
          )
        })
      )

      await expect(api.get('/test/')).rejects.toThrow()
    })

    it('rejects on 5xx errors', async () => {
      server.use(
        http.get('/api/test/', () => {
          return HttpResponse.json(
            { detail: 'Server error' },
            { status: 500 }
          )
        })
      )

      await expect(api.get('/test/')).rejects.toThrow()
    })
  })

  describe('api methods', () => {
    it('makes GET requests', async () => {
      server.use(
        http.get('/api/resource/', () => {
          return HttpResponse.json({ items: [1, 2, 3] })
        })
      )

      const response = await api.get('/resource/')
      
      expect(response.data).toEqual({ items: [1, 2, 3] })
    })

    it('makes POST requests with data', async () => {
      server.use(
        http.post('/api/resource/', async ({ request }) => {
          const body = await request.json()
          return HttpResponse.json({ received: body }, { status: 201 })
        })
      )

      const response = await api.post('/resource/', { name: 'test' })
      
      expect(response.data).toEqual({ received: { name: 'test' } })
      expect(response.status).toBe(201)
    })

    it('makes PUT requests with data', async () => {
      server.use(
        http.put('/api/resource/1/', async ({ request }) => {
          const body = await request.json()
          return HttpResponse.json({ id: 1, ...body as object })
        })
      )

      const response = await api.put('/resource/1/', { name: 'updated' })
      
      expect(response.data).toEqual({ id: 1, name: 'updated' })
    })

    it('makes DELETE requests', async () => {
      server.use(
        http.delete('/api/resource/1/', () => {
          return new HttpResponse(null, { status: 204 })
        })
      )

      const response = await api.delete('/resource/1/')
      
      expect(response.status).toBe(204)
    })

    it('makes PATCH requests with data', async () => {
      server.use(
        http.patch('/api/resource/1/', async ({ request }) => {
          const body = await request.json()
          return HttpResponse.json({ id: 1, ...body as object })
        })
      )

      const response = await api.patch('/resource/1/', { name: 'patched' })
      
      expect(response.data).toEqual({ id: 1, name: 'patched' })
    })
  })

  describe('base URL', () => {
    it('uses /api as base URL', () => {
      expect(api.defaults.baseURL).toBe('/api')
    })

    it('sets Content-Type header to application/json', () => {
      expect(api.defaults.headers['Content-Type']).toBe('application/json')
    })
  })
})
