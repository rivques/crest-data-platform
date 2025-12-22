import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { Plus, Trash2, X, Loader2, Copy, Check, Ban } from 'lucide-react'
import type { PaginatedResponse, SensorApiKey, Sensor } from '../types/api'

interface ApiKeyForm {
  sensor: string
  name: string
}

export default function ApiKeysPage() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const sensorFilter = searchParams.get('sensor')
  
  const [showModal, setShowModal] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<SensorApiKey>>('/api-keys/')
      return response.data
    },
  })

  const { data: sensors } = useQuery({
    queryKey: ['sensors'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Sensor>>('/sensors/')
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: ApiKeyForm) => {
      const response = await api.post('/api-keys/', data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
      setNewKey(data.api_key)
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api-keys/${id}/revoke/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api-keys/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ApiKeyForm>({
    defaultValues: {
      sensor: sensorFilter || '',
    },
  })

  const onSubmit = (data: ApiKeyForm) => {
    createMutation.mutate(data)
  }

  const handleCopyKey = async () => {
    if (newKey) {
      await navigator.clipboard.writeText(newKey)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    }
  }

  const handleCloseNewKey = () => {
    setNewKey(null)
    setShowModal(false)
    reset()
  }

  const handleRevoke = (id: string, name: string) => {
    if (confirm(`Are you sure you want to revoke "${name}"? The key will no longer be usable.`)) {
      revokeMutation.mutate(id)
    }
  }

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate(id)
    }
  }

  // Filter keys if sensor filter is active
  const filteredKeys = sensorFilter
    ? apiKeys?.results?.filter((key) => key.sensor === sensorFilter)
    : apiKeys?.results

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-500 mt-1">Manage sensor authentication keys</p>
        </div>
        <button
          onClick={() => {
            reset({ sensor: sensorFilter || '', name: '' })
            setShowModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={20} />
          New API Key
        </button>
      </div>

      {/* Filter indicator */}
      {sensorFilter && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Filtered by sensor:</span>
          <span className="font-medium">
            {sensors?.results?.find((s) => s.id === sensorFilter)?.name || sensorFilter}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : filteredKeys && filteredKeys.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Name</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Sensor</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Key Prefix</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Created</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Last Used</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredKeys.map((key) => (
                <tr key={key.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{key.name}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {key.sensor_name || key.sensor.slice(0, 8)}
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {key.key_prefix}...
                    </code>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {key.last_used_at
                      ? new Date(key.last_used_at).toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        key.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {key.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {key.is_active && (
                        <button
                          onClick={() => handleRevoke(key.id, key.name)}
                          className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Revoke"
                        >
                          <Ban size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(key.id, key.name)}
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
            <p className="text-gray-500">No API keys yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 text-primary-600 hover:text-primary-700"
            >
              Create your first API key
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && !newKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Create New API Key</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sensor</label>
                <select
                  {...register('sensor', { required: 'Sensor is required' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select a sensor...</option>
                  {sensors?.results?.map((sensor) => (
                    <option key={sensor.id} value={sensor.id}>
                      {sensor.name} ({sensor.sensor_type})
                    </option>
                  ))}
                </select>
                {errors.sensor && (
                  <p className="mt-1 text-sm text-red-600">{errors.sensor.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
                <input
                  {...register('name', { required: 'Name is required' })}
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Production Key"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

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
                  Create Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Key Display Modal */}
      {newKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 m-4">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">API Key Created</h2>
              <p className="text-gray-500 mt-1">
                Copy this key now. You won't be able to see it again!
              </p>
            </div>

            <div className="relative">
              <code className="block w-full p-4 bg-gray-100 rounded-lg text-sm break-all font-mono">
                {newKey}
              </code>
              <button
                onClick={handleCopyKey}
                className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                title="Copy to clipboard"
              >
                {copiedKey ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
              </button>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Usage:</strong> Include this key in your requests using the header:
              </p>
              <code className="block mt-2 text-xs bg-yellow-100 p-2 rounded">
                Authorization: Api-Key {newKey.slice(0, 12)}...
              </code>
            </div>

            <button
              onClick={handleCloseNewKey}
              className="w-full mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
