import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { Plus, Trash2, X, Loader2, BarChart3, Key, PlusCircle, Info } from 'lucide-react'
import type { PaginatedResponse, Sensor, Experiment, SensorCreateRequest } from '../types/api'
import { COLUMN_TYPES } from '../types/api'

interface ColumnDefinition {
  name: string
  type: string
}

interface SensorForm {
  name: string
  sensor_type: string
  description: string
  experiment: string
  columns: ColumnDefinition[]
}

export default function SensorsPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)

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
      const column_schema: Record<string, string> = {}
      data.columns.forEach((col) => {
        if (col.name && col.type) {
          column_schema[col.name] = col.type
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

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<SensorForm>({
    defaultValues: {
      columns: [{ name: '', type: 'DOUBLE PRECISION' }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'columns',
  })

  const onSubmit = (data: SensorForm) => {
    createMutation.mutate(data)
  }

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This will also delete all associated data.`)) {
      deleteMutation.mutate(id)
    }
  }

  const openModal = () => {
    reset({
      name: '',
      sensor_type: '',
      description: '',
      experiment: '',
      columns: [{ name: '', type: 'DOUBLE PRECISION' }],
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
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={20} />
          New Sensor
        </button>
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
                      {Object.entries(sensor.column_schema).slice(0, 3).map(([col, type]) => (
                        <span
                          key={col}
                          className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
                          title={`${col}: ${type}`}
                        >
                          {col}
                        </span>
                      ))}
                      {Object.keys(sensor.column_schema).length > 3 && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          +{Object.keys(sensor.column_schema).length - 3} more
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
                    <div className="flex items-center justify-end gap-2">
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
                        onClick={() => handleDelete(sensor.id, sensor.name)}
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
                    <div className="absolute right-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      Define the columns for your sensor's data table. Reserved columns (id, timestamp, experiment_id, created_at) are created automatically.
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2">
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
                  ))}
                  {errors.columns && (
                    <p className="text-sm text-red-600">
                      {errors.columns.root?.message ||
                        errors.columns.find?.((e) => e?.name)?.name?.message ||
                        'Check column names'}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => append({ name: '', type: 'DOUBLE PRECISION' })}
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
    </div>
  )
}
