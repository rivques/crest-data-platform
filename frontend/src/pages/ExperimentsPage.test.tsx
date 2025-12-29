import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/test-utils'
import ExperimentsPage from './ExperimentsPage'
import { server } from '../test/mocks/server'
import { http, HttpResponse } from 'msw'
import { mockExperiments } from '../test/mocks/handlers'

// Mock window.confirm
vi.stubGlobal('confirm', vi.fn(() => true))

describe('ExperimentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page header', async () => {
    renderWithProviders(<ExperimentsPage />)

    expect(screen.getByText('Experiments')).toBeInTheDocument()
    expect(screen.getByText('Manage your scientific experiments')).toBeInTheDocument()
  })

  it('displays the New Experiment button', () => {
    renderWithProviders(<ExperimentsPage />)

    expect(screen.getByRole('button', { name: /new experiment/i })).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    renderWithProviders(<ExperimentsPage />)

    // Should show loading spinner
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('displays experiment list when loaded', async () => {
    renderWithProviders(<ExperimentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Experiment 1')).toBeInTheDocument()
      expect(screen.getByText('Test Experiment 2')).toBeInTheDocument()
    })
  })

  it('displays experiment status badges', async () => {
    renderWithProviders(<ExperimentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  it('shows table headers', async () => {
    renderWithProviders(<ExperimentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('Created')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })
  })

  it('has edit and delete buttons for each experiment', async () => {
    renderWithProviders(<ExperimentsPage />)

    await waitFor(() => {
      const editButtons = screen.getAllByTitle('Edit')
      const deleteButtons = screen.getAllByTitle('Delete')
      expect(editButtons.length).toBeGreaterThan(0)
      expect(deleteButtons.length).toBeGreaterThan(0)
    })
  })

  it('confirms before deleting an experiment', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ExperimentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Experiment 1')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByTitle('Delete')
    await user.click(deleteButtons[0])

    expect(window.confirm).toHaveBeenCalled()
  })

  it('displays empty state when no experiments', async () => {
    server.use(
      http.get('/api/experiments/', () => {
        return HttpResponse.json({
          count: 0,
          next: null,
          previous: null,
          results: [],
        })
      })
    )

    renderWithProviders(<ExperimentsPage />)

    await waitFor(() => {
      expect(screen.getByText('No experiments yet')).toBeInTheDocument()
      expect(screen.getByText('Create your first experiment')).toBeInTheDocument()
    })
  })

  it('shows experiment descriptions', async () => {
    renderWithProviders(<ExperimentsPage />)

    await waitFor(() => {
      expect(screen.getByText('Description for experiment 1')).toBeInTheDocument()
    })
  })
})
