import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/test-utils'
import ApiKeysPage from './ApiKeysPage'
import { server } from '../test/mocks/server'
import { http, HttpResponse } from 'msw'
import { mockApiKeys, mockSensors } from '../test/mocks/handlers'

// Mock window.confirm
vi.stubGlobal('confirm', vi.fn(() => true))

describe('ApiKeysPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page header', () => {
    renderWithProviders(<ApiKeysPage />)

    expect(screen.getByText('API Keys')).toBeInTheDocument()
    expect(screen.getByText('Manage sensor authentication keys')).toBeInTheDocument()
  })

  it('displays New API Key button', () => {
    renderWithProviders(<ApiKeysPage />)

    expect(screen.getByRole('button', { name: /new api key/i })).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    renderWithProviders(<ApiKeysPage />)

    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('displays API keys when loaded', async () => {
    renderWithProviders(<ApiKeysPage />)

    await waitFor(() => {
      expect(screen.getByText('Test API Key')).toBeInTheDocument()
    })
  })

  it('shows key prefix', async () => {
    renderWithProviders(<ApiKeysPage />)

    await waitFor(() => {
      expect(screen.getByText('crest_abc...')).toBeInTheDocument()
    })
  })

  it('shows associated sensor name', async () => {
    renderWithProviders(<ApiKeysPage />)

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument()
    })
  })

  it('opens create modal when New API Key is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ApiKeysPage />)

    await user.click(screen.getByRole('button', { name: /new api key/i }))

    await waitFor(() => {
      expect(screen.getByText('Create New API Key')).toBeInTheDocument()
    })
  })

  it('shows sensor dropdown in create modal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ApiKeysPage />)

    // Wait for sensors to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /new api key/i }))

    await waitFor(() => {
      const sensorSelect = screen.getByRole('combobox')
      expect(sensorSelect).toBeInTheDocument()
    })
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ApiKeysPage />)

    await user.click(screen.getByRole('button', { name: /new api key/i }))

    await waitFor(() => {
      expect(screen.getByText('Create New API Key')).toBeInTheDocument()
    })

    // Click Create without selecting sensor
    const createButton = screen.getByRole('button', { name: 'Create Key' })
    await user.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('Sensor is required')).toBeInTheDocument()
    })
  })

  it('displays empty state when no API keys', async () => {
    server.use(
      http.get('/api/api-keys/', () => {
        return HttpResponse.json({
          count: 0,
          next: null,
          previous: null,
          results: [],
        })
      })
    )

    renderWithProviders(<ApiKeysPage />)

    await waitFor(() => {
      expect(screen.getByText('No API keys yet')).toBeInTheDocument()
    })
  })

  it('shows status badge for active keys', async () => {
    renderWithProviders(<ApiKeysPage />)

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
    })
  })

  it('shows revoked status for inactive keys', async () => {
    server.use(
      http.get('/api/api-keys/', () => {
        return HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [{
            ...mockApiKeys[0],
            is_active: false,
          }],
        })
      })
    )

    renderWithProviders(<ApiKeysPage />)

    await waitFor(() => {
      expect(screen.getByText('Revoked')).toBeInTheDocument()
    })
  })

  it('confirms before revoking a key', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ApiKeysPage />)

    await waitFor(() => {
      expect(screen.getByText('Test API Key')).toBeInTheDocument()
    })

    const revokeButton = screen.getByTitle('Revoke')
    await user.click(revokeButton)

    expect(window.confirm).toHaveBeenCalled()
  })

  it('confirms before deleting a key', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ApiKeysPage />)

    await waitFor(() => {
      expect(screen.getByText('Test API Key')).toBeInTheDocument()
    })

    const deleteButton = screen.getByTitle('Delete')
    await user.click(deleteButton)

    expect(window.confirm).toHaveBeenCalled()
  })

  it('shows last used date when available', async () => {
    renderWithProviders(<ApiKeysPage />)

    await waitFor(() => {
      // Verify the data loaded first
      expect(screen.getByText('Test API Key')).toBeInTheDocument()
    })

    // The mockApiKey has last_used_at set, so we should NOT see "Never"
    // in the last used column for this key
    expect(screen.queryByText('Never')).not.toBeInTheDocument()
  })

  it('displays table headers', async () => {
    renderWithProviders(<ApiKeysPage />)

    await waitFor(() => {
      expect(screen.getByText('Test API Key')).toBeInTheDocument()
    })

    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Sensor')).toBeInTheDocument()
  })
})
