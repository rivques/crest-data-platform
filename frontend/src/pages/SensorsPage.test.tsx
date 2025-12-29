import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/test-utils'
import SensorsPage from './SensorsPage'
import { server } from '../test/mocks/server'
import { http, HttpResponse } from 'msw'
import { mockSensors, mockExperiments } from '../test/mocks/handlers'

// Mock window.confirm
vi.stubGlobal('confirm', vi.fn(() => true))

describe('SensorsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page header', () => {
    renderWithProviders(<SensorsPage />)

    expect(screen.getByText('Sensors')).toBeInTheDocument()
    expect(screen.getByText('Manage your sensor devices')).toBeInTheDocument()
  })

  it('displays the New Sensor button', () => {
    renderWithProviders(<SensorsPage />)

    expect(screen.getByRole('button', { name: /new sensor/i })).toBeInTheDocument()
  })

  it('displays the Import button', () => {
    renderWithProviders(<SensorsPage />)

    expect(screen.getByRole('button', { name: /import config/i })).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    renderWithProviders(<SensorsPage />)

    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('displays sensor list when loaded', async () => {
    renderWithProviders(<SensorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument()
      expect(screen.getByText('Motion Sensor')).toBeInTheDocument()
    })
  })

  it('shows reading count for sensors', async () => {
    renderWithProviders(<SensorsPage />)

    await waitFor(() => {
      expect(screen.getByText('1,500')).toBeInTheDocument()
    })
  })

  it('displays active status badge', async () => {
    renderWithProviders(<SensorsPage />)

    await waitFor(() => {
      const activeStatuses = screen.getAllByText('Active')
      expect(activeStatuses.length).toBeGreaterThan(0)
    })
  })

  it('has link to data explorer', async () => {
    renderWithProviders(<SensorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument()
    })

    // Find data explorer button/link
    const dataButtons = screen.getAllByTitle('View Data')
    expect(dataButtons.length).toBeGreaterThan(0)
  })

  it('has link to manage API keys', async () => {
    renderWithProviders(<SensorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument()
    })

    // Find API keys button/link
    const keyButtons = screen.getAllByTitle('API Keys')
    expect(keyButtons.length).toBeGreaterThan(0)
  })

  it('shows em dash for sensors without last reading', async () => {
    renderWithProviders(<SensorsPage />)

    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  it('shows table column headers', async () => {
    renderWithProviders(<SensorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument()
    })

    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Schema')).toBeInTheDocument()
    expect(screen.getByText('Readings')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('shows sensor info button', async () => {
    renderWithProviders(<SensorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument()
    })

    const infoButtons = screen.getAllByTitle('Sensor Info')
    expect(infoButtons.length).toBeGreaterThan(0)
  })

  it('shows export config button', async () => {
    renderWithProviders(<SensorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument()
    })

    const exportButtons = screen.getAllByTitle('Export Config')
    expect(exportButtons.length).toBeGreaterThan(0)
  })
})
