import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { Plus, Trash2, X, Loader2, BarChart3, Key, PlusCircle, Info, Code, AlertTriangle, Settings, Download, Upload, FileJson } from 'lucide-react'
import type { PaginatedResponse, Sensor, Experiment, SensorCreateRequest, ColumnSchema, ComputedFieldError, SensorConfig, SensorImportRequest } from '../types/api'
import { COLUMN_TYPES } from '../types/api'

interface ColumnFormDefinition {
  name: string
  type: string
  computed: boolean
  compute_function: string
}

interface SensorForm {
  name: string
  sensor_type: string
  description: string
  experiment: string
  columns: ColumnFormDefinition[]
}

export default function SensorsPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importConfig, setImportConfig] = useState<SensorConfig | null>(null)
  const [importNameOverride, setImportNameOverride] = useState('')
  const [importExperiment, setImportExperiment] = useState('')
  const [infoSensor, setInfoSensor] = useState<Sensor | null>(null)
  const [deleteSensor, setDeleteSensor] = useState<Sensor | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  const { data: sensors, isLoading } = useQuery({
    queryKey: ['sensors'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Sensor>>('/sensors/')
      return response.data
    },
  })

  const { data: experiments } = useQuery({
    queryKey: ['experiments'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Experiment>>('/experiments/')
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: SensorForm) => {
      // Convert columns array to schema object
      const column_schema: ColumnSchema = {}
      data.columns.forEach((col) => {
        if (col.name && col.type) {
          if (col.computed && col.compute_function) {
            column_schema[col.name] = {
              type: col.type,
              computed: true,
              compute_function: col.compute_function,
            }
          } else {
            column_schema[col.name] = col.type
          }
        }
      })

      const payload: SensorCreateRequest = {
        name: data.name,
        sensor_type: data.sensor_type,
        description: data.description,
        experiment: data.experiment || null,
        column_schema,
      }
      const response = await api.post('/sensors/', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensors'] })
      setShowModal(false)
      reset()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/sensors/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensors'] })
    },
  })

  const exportMutation = useMutation({
    mutationFn: async (sensorId: string) => {
      const response = await api.get<SensorConfig>(`/sensors/${sensorId}/export_config/`)
      return { sensorId, config: response.data }
    },
    onSuccess: ({ sensorId, config }) => {
      // Download as JSON file
      const sensor = sensors?.results.find(s => s.id === sensorId)
      const fileName = `${sensor?.name || 'sensor'}_config.json`
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
  })

  const importMutation = useMutation({
    mutationFn: async (data: SensorImportRequest) => {
      const response = await api.post<Sensor>('/sensors/import/', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensors'] })
      setShowImportModal(false)
      setImportFile(null)
      setImportConfig(null)
      setImportNameOverride('')
      setImportExperiment('')
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<SensorForm>({
    defaultValues: {
      columns: [{ name: '', type: 'DOUBLE PRECISION', computed: false, compute_function: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'columns',
  })

  // Watch column computed states
  const watchedColumns = useWatch({ control, name: 'columns' })

  const onSubmit = (data: SensorForm) => {
    createMutation.mutate(data)
  }

  const handleDeleteClick = (sensor: Sensor) => {
    setDeleteSensor(sensor)
    setDeleteConfirmName('')
  }

  const confirmDelete = () => {
    if (deleteSensor && deleteConfirmName === deleteSensor.name) {
      deleteMutation.mutate(deleteSensor.id)
      setDeleteSensor(null)
      setDeleteConfirmName('')
    }
  }

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)
    
    try {
      const text = await file.text()
      const config = JSON.parse(text) as SensorConfig
      setImportConfig(config)
    } catch (error) {
      console.error('Failed to parse config file:', error)
      alert('Invalid config file format')
      setImportFile(null)
      setImportConfig(null)
    }
  }

  const handleImportSubmit = () => {
    if (!importConfig) return

    const data: SensorImportRequest = {
      config: importConfig,
    }

    if (importNameOverride.trim()) {
      data.name_override = importNameOverride.trim()
    }

    if (importExperiment) {
      data.experiment = importExperiment
    }

    importMutation.mutate(data)
  }

  const openModal = () => {
    reset({
      name: '',
      sensor_type: '',
      description: '',
      experiment: '',
      columns: [{ name: '', type: 'DOUBLE PRECISION', computed: false, compute_function: '' }],
    })
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sensors</h1>
          <p className="text-gray-500 mt-1">Manage your sensor devices</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload size={20} />
            Import Config
          </button>
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={20} />
            New Sensor
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : sensors?.results && sensors.results.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Name</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Type</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Schema</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Readings</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Last Reading</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sensors.results.map((sensor) => (
                <tr key={sensor.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{sensor.name}</p>
                    <p className="text-sm text-gray-500">{sensor.table_name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                      {sensor.sensor_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(sensor.column_schema).slice(0, 3).map(([col, colDef]) => {
                        const isComputed = typeof colDef === 'object' && colDef.computed
                        const typeStr = typeof colDef === 'string' ? colDef : colDef.type
                        return (
                          <span
                            key={col}
                            className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                              isComputed 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}
                            title={`${col}: ${typeStr}${isComputed ? ' (computed)' : ''}`}
                          >
                            {isComputed && <Code size={10} />}
                            {col}
                          </span>
                        )
                      })}
                      {Object.keys(sensor.column_schema).length > 3 && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          +{Object.keys(sensor.column_schema).length - 3} more
                        </span>
                      )}
                      {sensor.computed_field_error_count > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded flex items-center gap-1" title="Computed field errors">
                          <AlertTriangle size={10} />
                          {sensor.computed_field_error_count}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-medium">
                    {sensor.reading_count.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {sensor.last_reading_at
                      ? new Date(sensor.last_reading_at).toLocaleString()
                      : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        sensor.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {sensor.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInfoSensor(sensor)}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Sensor Info"
                      >
                        <Settings size={18} />
                      </button>
                      <button
                        onClick={() => exportMutation.mutate(sensor.id)}
                        disabled={exportMutation.isPending}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Export Config"
                      >
                        <Download size={18} />
                      </button>
                      <Link
                        to={`/data/${sensor.id}`}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="View Data"
                      >
                        <BarChart3 size={18} />
                      </Link>
                      <Link
                        to={`/api-keys?sensor=${sensor.id}`}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="API Keys"
                      >
                        <Key size={18} />
                      </Link>
                      <button
                        onClick={() => handleDeleteClick(sensor)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No sensors registered yet</p>
            <button
              onClick={openModal}
              className="mt-4 text-primary-600 hover:text-primary-700"
            >
              Register your first sensor
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Register New Sensor</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  {...register('name', { required: 'Name is required' })}
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Lab Temperature Sensor"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sensor Type</label>
                <input
                  {...register('sensor_type', { required: 'Sensor type is required' })}
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., temperature, air_quality, custom"
                />
                <p className="mt-1 text-xs text-gray-500">A label for this type of sensor</p>
                {errors.sensor_type && (
                  <p className="mt-1 text-sm text-red-600">{errors.sensor_type.message}</p>
                )}
              </div>

              {/* Column Schema Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Data Columns</label>
                  <div className="group relative">
                    <Info size={16} className="text-gray-400 cursor-help" />
                    <div className="absolute right-0 top-6 w-72 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      Define the columns for your sensor's data table. Reserved columns (id, timestamp, experiment_id, created_at) are created automatically. Mark a column as "computed" to calculate its value server-side.
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="flex gap-2">
                        <input
                          {...register(`columns.${index}.name`, {
                            required: 'Column name is required',
                            pattern: {
                              value: /^[a-zA-Z][a-zA-Z0-9_]*$/,
                              message: 'Must start with a letter, alphanumeric and underscores only',
                            },
                          })}
                          type="text"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                          placeholder="Column name"
                        />
                        <select
                          {...register(`columns.${index}.type`)}
                          className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        >
                          {COLUMN_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="p-2 text-gray-400 hover:text-red-500 rounded-lg"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      
                      {/* Computed field toggle */}
                      <div className="flex items-center gap-2">
                        <input
                          {...register(`columns.${index}.computed`)}
                          type="checkbox"
                          id={`computed-${index}`}
                          className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                        />
                        <label htmlFor={`computed-${index}`} className="text-sm text-gray-600 flex items-center gap-1">
                          <Code size={14} className="text-purple-600" />
                          Computed field (calculated server-side)
                        </label>
                      </div>
                      
                      {/* Compute function editor - only show if computed is checked */}
                      {watchedColumns?.[index]?.computed && (
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Compute Function
                          </label>
                          <textarea
                            {...register(`columns.${index}.compute_function`, {
                              validate: (value) => {
                                if (watchedColumns?.[index]?.computed && !value?.trim()) {
                                  return 'Compute function is required for computed fields'
                                }
                                return true
                              }
                            })}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm font-mono bg-gray-50"
                            placeholder={`def compute(data):
    # data contains all non-computed fields
    # Return the computed value
    return data['some_field'] * 2`}
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Define a <code className="bg-gray-100 px-1 rounded">compute(data)</code> function. The <code className="bg-gray-100 px-1 rounded">data</code> dict contains all sensor-reported fields.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  {errors.columns && (
                    <p className="text-sm text-red-600">
                      {errors.columns.root?.message ||
                        errors.columns.find?.((e) => e?.name)?.name?.message ||
                        errors.columns.find?.((e) => e?.compute_function)?.compute_function?.message ||
                        'Check column definitions'}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => append({ name: '', type: 'DOUBLE PRECISION', computed: false, compute_function: '' })}
                  className="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                >
                  <PlusCircle size={16} />
                  Add Column
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Experiment (optional)
                </label>
                <select
                  {...register('experiment')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">No experiment</option>
                  {experiments?.results?.map((exp) => (
                    <option key={exp.id} value={exp.id}>
                      {exp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  {...register('description')}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Optional description"
                />
              </div>

              {createMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">
                    {(createMutation.error as Error)?.message || 'Failed to create sensor'}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Sensor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sensor Info Modal */}
      {infoSensor && <SensorInfoModal sensor={infoSensor} onClose={() => setInfoSensor(null)} />}

      {/* Delete Confirmation Modal */}
      {deleteSensor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteSensor(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Delete Sensor</h2>
              <button
                onClick={() => setDeleteSensor(null)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex gap-3">
                  <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />
                  <div className="text-sm text-red-700">
                    <p className="font-semibold mb-1">Warning: This action cannot be undone</p>
                    <p>Deleting this sensor will permanently remove:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>The sensor configuration</li>
                      <li>All {deleteSensor.reading_count.toLocaleString()} readings</li>
                      <li>All API keys</li>
                      <li>The database table "{deleteSensor.table_name}"</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="font-mono bg-gray-100 px-1 rounded">{deleteSensor.name}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter sensor name"
                  autoFocus
                />
              </div>

              {deleteMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">
                    {(deleteMutation.error as Error)?.message || 'Failed to delete sensor'}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setDeleteSensor(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteConfirmName !== deleteSensor.name || deleteMutation.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete Sensor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Config Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowImportModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Import Sensor Configuration</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration File
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 cursor-pointer transition-colors">
                    <FileJson className="text-gray-400" size={20} />
                    <span className="text-sm text-gray-600">
                      {importFile ? importFile.name : 'Choose JSON file'}
                    </span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Select a sensor configuration JSON file exported from this platform
                </p>
              </div>

              {importConfig && (
                <>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                      <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">Configuration Preview</p>
                        <ul className="space-y-1">
                          <li><span className="font-medium">Name:</span> {importConfig.sensor.name}</li>
                          <li><span className="font-medium">Type:</span> {importConfig.sensor.sensor_type}</li>
                          <li><span className="font-medium">Columns:</span> {Object.keys(importConfig.sensor.column_schema).length}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Override Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={importNameOverride}
                      onChange={(e) => setImportNameOverride(e.target.value)}
                      placeholder="Leave empty to use original name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Provide a custom name for the imported sensor
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Associate with Experiment (Optional)
                    </label>
                    <select
                      value={importExperiment}
                      onChange={(e) => setImportExperiment(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">No experiment</option>
                      {experiments?.results.map((exp) => (
                        <option key={exp.id} value={exp.id}>
                          {exp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {importMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">
                    {(importMutation.error as any)?.response?.data?.error || 
                     (importMutation.error as Error)?.message || 
                     'Failed to import sensor configuration'}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportSubmit}
                  disabled={!importConfig || importMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {importMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Import Sensor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Sensor Info Modal Component
function SensorInfoModal({ sensor, onClose }: { sensor: Sensor; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'info' | 'schema' | 'errors'>('info')
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editedFunctions, setEditedFunctions] = useState<Record<string, string>>({})

  const { data: errors, isLoading: errorsLoading } = useQuery({
    queryKey: ['sensor-errors', sensor.id],
    queryFn: async () => {
      const response = await api.get<{ count: number; results: ComputedFieldError[] }>(
        `/sensors/${sensor.id}/compute_errors/`
      )
      return response.data
    },
    enabled: activeTab === 'errors',
  })

  const clearErrorsMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/sensors/${sensor.id}/clear_compute_errors/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensor-errors', sensor.id] })
      queryClient.invalidateQueries({ queryKey: ['sensors'] })
    },
  })

  const updateComputeFunctionsMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const response = await api.patch(`/sensors/${sensor.id}/update_compute_functions/`, updates)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensors'] })
      setEditingField(null)
      setEditedFunctions({})
    },
  })

  const getComputedColumns = () => {
    return Object.entries(sensor.column_schema).filter(
      ([_, def]) => typeof def === 'object' && def.computed
    )
  }

  const getRegularColumns = () => {
    return Object.entries(sensor.column_schema).filter(
      ([_, def]) => typeof def === 'string' || (typeof def === 'object' && !def.computed)
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden m-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{sensor.name}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {sensor.sensor_type} • {sensor.table_name}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setActiveTab('schema')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'schema'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Schema
            </button>
            <button
              onClick={() => setActiveTab('errors')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'errors'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Compute Errors
              {sensor.computed_field_error_count > 0 && (
                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                  {sensor.computed_field_error_count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sensor ID</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono">
                    {sensor.id}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(sensor.id)}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <p className="text-sm text-gray-600">{sensor.description || 'No description provided'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                  <p className="text-sm text-gray-600">{new Date(sensor.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                  <p className="text-sm text-gray-600">{new Date(sensor.updated_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Readings</label>
                  <p className="text-sm text-gray-600">{sensor.reading_count.toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Reading</label>
                  <p className="text-sm text-gray-600">
                    {sensor.last_reading_at ? new Date(sensor.last_reading_at).toLocaleString() : 'Never'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    sensor.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {sensor.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {sensor.experiment_name && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Experiment</label>
                  <p className="text-sm text-gray-600">{sensor.experiment_name}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Regular Columns</h3>
                <div className="space-y-2">
                  {getRegularColumns().map(([name, def]) => (
                    <div key={name} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{name}</span>
                        <code className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {typeof def === 'string' ? def : def.type}
                        </code>
                      </div>
                    </div>
                  ))}
                  {getRegularColumns().length === 0 && (
                    <p className="text-sm text-gray-500">No regular columns</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Code size={16} className="text-purple-600" />
                  Computed Columns
                </h3>
                <div className="space-y-3">
                  {getComputedColumns().map(([name, def]) => {
                    const colDef = def as { type: string; compute_function: string }
                    const isEditing = editingField === name
                    const currentFunction = editedFunctions[name] ?? colDef.compute_function
                    
                    return (
                      <div key={name} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{name}</span>
                          <div className="flex items-center gap-2">
                            <code className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                              {colDef.type}
                            </code>
                            {!isEditing && (
                              <button
                                onClick={() => {
                                  setEditingField(name)
                                  setEditedFunctions({ ...editedFunctions, [name]: colDef.compute_function })
                                }}
                                className="p-1 text-purple-600 hover:text-purple-700 hover:bg-purple-100 rounded"
                                title="Edit function"
                              >
                                <Code size={14} /> Edit function
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Compute Function</label>
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={currentFunction}
                                onChange={(e) => setEditedFunctions({ ...editedFunctions, [name]: e.target.value })}
                                className="w-full px-3 py-2 font-mono text-xs bg-gray-900 text-gray-100 rounded border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                rows={6}
                                spellCheck={false}
                              />
                              {updateComputeFunctionsMutation.isError && (
                                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                                  {(updateComputeFunctionsMutation.error as any)?.response?.data?.errors?.[name] ||
                                    (updateComputeFunctionsMutation.error as Error)?.message ||
                                    'Failed to update function'}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    updateComputeFunctionsMutation.mutate({ [name]: currentFunction })
                                  }}
                                  disabled={updateComputeFunctionsMutation.isPending}
                                  className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  {updateComputeFunctionsMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingField(null)
                                    const newFunctions = { ...editedFunctions }
                                    delete newFunctions[name]
                                    setEditedFunctions(newFunctions)
                                  }}
                                  disabled={updateComputeFunctionsMutation.isPending}
                                  className="px-3 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                              <code>{colDef.compute_function}</code>
                            </pre>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {getComputedColumns().length === 0 && (
                    <p className="text-sm text-gray-500">No computed columns</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'errors' && (
            <div className="space-y-4">
              {errorsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                </div>
              ) : errors && errors.results.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      {errors.count} error{errors.count !== 1 ? 's' : ''} logged
                    </p>
                    <button
                      onClick={() => clearErrorsMutation.mutate()}
                      disabled={clearErrorsMutation.isPending}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {clearErrorsMutation.isPending ? 'Clearing...' : 'Clear All'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {errors.results.map((error) => (
                      <div key={error.id} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">{error.field_name}</span>
                              <code className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                {error.error_type}
                              </code>
                            </div>
                            <p className="text-sm text-red-700 mb-2">{error.error_message}</p>
                            <details className="text-xs">
                              <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                                Input Data
                              </summary>
                              <pre className="mt-2 p-2 bg-gray-900 text-gray-100 rounded overflow-x-auto">
                                <code>{JSON.stringify(error.input_data, null, 2)}</code>
                              </pre>
                            </details>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(error.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                    <Info className="text-green-600" size={32} />
                  </div>
                  <p className="text-gray-600">No compute errors logged</p>
                  <p className="text-sm text-gray-500 mt-1">All computed fields are working correctly</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
