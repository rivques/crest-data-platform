import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/test-utils'
import DashboardPage from './DashboardPage'
import { server } from '../test/mocks/server'
import { http, HttpResponse } from 'msw'
import { mockExperiments, mockSensors, mockApiKeys } from '../test/mocks/handlers'

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dashboard header', () => {
    renderWithProviders(<DashboardPage />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Overview of your CREST Data Platform')).toBeInTheDocument()
  })

  it('displays stats cards with correct counts', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      // Check for section headings
      expect(screen.getByText('Experiments')).toBeInTheDocument()
      expect(screen.getByText('Sensors')).toBeInTheDocument()
      
      // Look for stats container - should have count for experiments (2) and sensors (2)
      // Since both counts are 2, just verify the 2 appears multiple times for stats
      const twos = screen.getAllByText('2')
      expect(twos.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('displays API keys count', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument()
      expect(screen.getByText(mockApiKeys.length.toString())).toBeInTheDocument()
    })
  })

  it('displays active sensors count', async () => {
    renderWithProviders(<DashboardPage />)

    const activeSensorsCount = mockSensors.filter(s => s.is_active).length

    await waitFor(() => {
      expect(screen.getByText('Active Sensors')).toBeInTheDocument()
      // Active sensors count should be displayed
      const stats = screen.getAllByText(activeSensorsCount.toString())
      expect(stats.length).toBeGreaterThan(0)
    })
  })

  it('displays recent sensor activity section', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Recent Sensor Activity')).toBeInTheDocument()
    })
  })

  it('displays recent experiments section', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Recent Experiments')).toBeInTheDocument()
    })
  })

  it('shows sensor names in recent activity', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      // Temperature Sensor has last_reading_at, so it should appear
      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument()
    })
  })

  it('shows experiment names in recent experiments', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Experiment 1')).toBeInTheDocument()
      expect(screen.getByText('Test Experiment 2')).toBeInTheDocument()
    })
  })

  it('displays "View all" links', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      const viewAllLinks = screen.getAllByText('View all')
      expect(viewAllLinks).toHaveLength(2) // One for sensors, one for experiments
    })
  })

  it('displays empty state when no sensors have activity', async () => {
    server.use(
      http.get('/api/sensors/', () => {
        return HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [{
            ...mockSensors[1],
            last_reading_at: null, // No readings
          }],
        })
      })
    )

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('No recent sensor activity')).toBeInTheDocument()
    })
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

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('No experiments yet')).toBeInTheDocument()
    })
  })

  it('handles loading state', () => {
    // Before data loads, should show 0 counts
    renderWithProviders(<DashboardPage />)

    // Initial state before data loads
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThan(0)
  })

  it('stat cards link to correct pages', async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      const experimentsLink = screen.getByText('Experiments').closest('a')
      expect(experimentsLink).toHaveAttribute('href', '/experiments')

      const sensorsLink = screen.getByText('Sensors').closest('a')
      expect(sensorsLink).toHaveAttribute('href', '/sensors')
    })
  })
})
