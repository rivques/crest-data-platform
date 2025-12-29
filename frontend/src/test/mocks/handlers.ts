import { http, HttpResponse } from 'msw'
import type { User, Experiment, Sensor, SensorApiKey, PaginatedResponse } from '../../types/api'

// Mock data
export const mockUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'admin',
  created_at: '2024-01-01T00:00:00Z',
}

export const mockExperiments: Experiment[] = [
  {
    id: 'exp-1',
    name: 'Test Experiment 1',
    description: 'Description for experiment 1',
    metadata: {},
    created_by: 1,
    created_by_username: 'testuser',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    is_active: true,
  },
  {
    id: 'exp-2',
    name: 'Test Experiment 2',
    description: 'Description for experiment 2',
    metadata: { key: 'value' },
    created_by: 1,
    created_by_username: 'testuser',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    is_active: false,
  },
]

export const mockSensors: Sensor[] = [
  {
    id: 'sensor-1',
    name: 'Temperature Sensor',
    sensor_type: 'temperature',
    table_name: 'sensor_temperature_sensor',
    description: 'A temperature sensor',
    metadata: {},
    column_schema: {
      temperature: 'DOUBLE PRECISION',
      humidity: 'DOUBLE PRECISION',
    },
    experiment: 'exp-1',
    experiment_name: 'Test Experiment 1',
    is_active: true,
    created_by: 1,
    created_by_username: 'testuser',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_reading_at: '2024-12-29T10:00:00Z',
    reading_count: 1500,
    api_key_count: 2,
    computed_field_error_count: 0,
  },
  {
    id: 'sensor-2',
    name: 'Motion Sensor',
    sensor_type: 'motion',
    table_name: 'sensor_motion_sensor',
    description: 'A motion detector',
    metadata: {},
    column_schema: {
      motion_detected: 'BOOLEAN',
    },
    experiment: null,
    is_active: true,
    created_by: 1,
    created_by_username: 'testuser',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    last_reading_at: null,
    reading_count: 0,
    api_key_count: 1,
    computed_field_error_count: 0,
  },
]

export const mockApiKeys: SensorApiKey[] = [
  {
    id: 'key-1',
    name: 'Test API Key',
    sensor: 'sensor-1',
    sensor_name: 'Temperature Sensor',
    key_prefix: 'crest_abc',
    created_by: 1,
    created_at: '2024-01-01T00:00:00Z',
    expires_at: '2025-01-01T00:00:00Z',
    is_active: true,
    last_used_at: '2024-12-28T10:00:00Z',
  },
]

// Paginated response helper
function paginatedResponse<T>(items: T[]): PaginatedResponse<T> {
  return {
    count: items.length,
    next: null,
    previous: null,
    results: items,
  }
}

export const handlers = [
  // Auth endpoints
  http.post('/api/auth/login/', async ({ request }) => {
    const body = await request.json() as { username: string; password: string }
    
    if (body.username === 'testuser' && body.password === 'password123') {
      return HttpResponse.json({
        access: 'mock-access-token',
        refresh: 'mock-refresh-token',
      })
    }
    
    return HttpResponse.json(
      { detail: 'Invalid credentials' },
      { status: 401 }
    )
  }),

  http.post('/api/auth/refresh/', async ({ request }) => {
    const body = await request.json() as { refresh: string }
    
    if (body.refresh === 'mock-refresh-token') {
      return HttpResponse.json({
        access: 'new-mock-access-token',
      })
    }
    
    return HttpResponse.json(
      { detail: 'Invalid refresh token' },
      { status: 401 }
    )
  }),

  http.get('/api/auth/profile/', () => {
    return HttpResponse.json(mockUser)
  }),

  // Experiments endpoints
  http.get('/api/experiments/', () => {
    return HttpResponse.json(paginatedResponse(mockExperiments))
  }),

  http.get('/api/experiments/:id/', ({ params }) => {
    const experiment = mockExperiments.find((e) => e.id === params.id)
    if (experiment) {
      return HttpResponse.json(experiment)
    }
    return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
  }),

  http.post('/api/experiments/', async ({ request }) => {
    const body = await request.json() as Partial<Experiment>
    const newExperiment: Experiment = {
      id: 'exp-new',
      name: body.name || 'New Experiment',
      description: body.description || '',
      metadata: body.metadata || {},
      created_by: 1,
      created_by_username: 'testuser',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    }
    return HttpResponse.json(newExperiment, { status: 201 })
  }),

  http.delete('/api/experiments/:id/', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Sensors endpoints
  http.get('/api/sensors/', () => {
    return HttpResponse.json(paginatedResponse(mockSensors))
  }),

  http.get('/api/sensors/:id/', ({ params }) => {
    const sensor = mockSensors.find((s) => s.id === params.id)
    if (sensor) {
      return HttpResponse.json(sensor)
    }
    return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
  }),

  http.post('/api/sensors/', async ({ request }) => {
    const body = await request.json() as Partial<Sensor>
    const newSensor: Sensor = {
      id: 'sensor-new',
      name: body.name || 'New Sensor',
      sensor_type: body.sensor_type || 'generic',
      table_name: 'sensor_new_sensor',
      description: body.description || '',
      metadata: body.metadata || {},
      column_schema: body.column_schema || {},
      experiment: body.experiment || null,
      is_active: true,
      created_by: 1,
      created_by_username: 'testuser',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_reading_at: null,
      reading_count: 0,
      api_key_count: 0,
      computed_field_error_count: 0,
    }
    return HttpResponse.json(newSensor, { status: 201 })
  }),

  http.delete('/api/sensors/:id/', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // API Keys endpoints
  http.get('/api/api-keys/', () => {
    return HttpResponse.json(paginatedResponse(mockApiKeys))
  }),

  http.post('/api/api-keys/', async ({ request }) => {
    const body = await request.json() as { name: string; sensor: string }
    return HttpResponse.json({
      id: 'key-new',
      name: body.name,
      sensor: body.sensor,
      sensor_name: 'Temperature Sensor',
      key_prefix: 'crest_xyz',
      key: 'crest_xyz_full_key_value', // Only returned on creation
      created_by: 1,
      created_at: new Date().toISOString(),
      expires_at: null,
      is_active: true,
      last_used_at: null,
    }, { status: 201 })
  }),

  http.delete('/api/api-keys/:id/', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Data endpoints
  http.get('/api/data/:sensorId/', () => {
    return HttpResponse.json({
      columns: ['timestamp', 'temperature', 'humidity'],
      data: [
        { timestamp: '2024-12-29T10:00:00Z', temperature: 22.5, humidity: 45.0 },
        { timestamp: '2024-12-29T10:01:00Z', temperature: 22.6, humidity: 44.8 },
      ],
      total_count: 2,
    })
  }),
]
