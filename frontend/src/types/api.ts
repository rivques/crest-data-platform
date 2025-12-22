/**
 * TypeScript types for the CREST Data Platform API
 */

export interface User {
  id: number
  username: string
  email: string
  role: 'viewer' | 'editor' | 'admin'
  created_at: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface Experiment {
  id: string
  name: string
  description: string
  metadata: Record<string, unknown>
  created_by: number
  created_by_username?: string
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface Sensor {
  id: string
  name: string
  sensor_type: string
  table_name: string
  description: string
  metadata: Record<string, unknown>
  column_schema: Record<string, string>
  experiment: string | null
  experiment_name?: string
  is_active: boolean
  created_by: number
  created_by_username?: string
  created_at: string
  updated_at: string
  last_reading_at: string | null
  reading_count: number
  api_key_count: number
}

export interface SensorCreateRequest {
  name: string
  sensor_type: string
  description?: string
  experiment?: string | null
  metadata?: Record<string, unknown>
  column_schema: Record<string, string>
}

export interface SensorApiKey {
  id: string
  sensor: string
  sensor_name?: string
  name: string
  key_prefix: string
  api_key?: string // Only returned on creation
  created_by: number
  created_by_username?: string
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
}

// Available PostgreSQL column types for sensor schemas
export const COLUMN_TYPES = [
  'DOUBLE PRECISION',
  'REAL',
  'INTEGER',
  'BIGINT',
  'SMALLINT',
  'BOOLEAN',
  'VARCHAR(50)',
  'VARCHAR(100)',
  'VARCHAR(255)',
  'TEXT',
  'TIMESTAMPTZ',
  'DATE',
] as const

export type ColumnType = typeof COLUMN_TYPES[number]

export interface SensorReading {
  id: number
  experiment_id: string | null
  timestamp: string
  created_at: string
  [key: string]: unknown // Dynamic columns from sensor schema
}

export interface SensorDataResponse {
  sensor_id: string
  sensor_name: string
  table_name: string
  total_count: number
  returned_count: number
  data: SensorReading[]
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiError {
  detail?: string
  error?: string
  [key: string]: unknown
}
