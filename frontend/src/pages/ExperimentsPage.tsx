import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import api from '../lib/api'
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import type { PaginatedResponse, Experiment } from '../types/api'

interface ExperimentForm {
  name: string
  description: string
}

export default function ExperimentsPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingExperiment, setEditingExperiment] = useState<Experiment | null>(null)

  const { data: experiments, isLoading } = useQuery({
    queryKey: ['experiments'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Experiment>>('/experiments/')
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: ExperimentForm) => {
      const response = await api.post('/experiments/', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] })
      setShowModal(false)
      reset()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ExperimentForm }) => {
      const response = await api.put(`/experiments/${id}/`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] })
      setShowModal(false)
      setEditingExperiment(null)
      reset()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/experiments/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] })
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExperimentForm>()

  const openCreateModal = () => {
    setEditingExperiment(null)
    reset({ name: '', description: '' })
    setShowModal(true)
  }

  const openEditModal = (experiment: Experiment) => {
    setEditingExperiment(experiment)
    reset({ name: experiment.name, description: experiment.description })
    setShowModal(true)
  }

  const onSubmit = (data: ExperimentForm) => {
    if (editingExperiment) {
      updateMutation.mutate({ id: editingExperiment.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Experiments</h1>
          <p className="text-gray-500 mt-1">Manage your scientific experiments</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={20} />
          New Experiment
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : experiments?.results && experiments.results.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Name</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Description</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Created</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {experiments.results.map((experiment) => (
                <tr key={experiment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{experiment.name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-500 line-clamp-1 max-w-xs">
                      {experiment.description || '—'}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(experiment.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        experiment.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {experiment.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(experiment)}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(experiment.id, experiment.name)}
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
            <p className="text-gray-500">No experiments yet</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-primary-600 hover:text-primary-700"
            >
              Create your first experiment
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingExperiment ? 'Edit Experiment' : 'New Experiment'}
              </h2>
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
                  placeholder="Experiment name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="Optional description"
                />
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
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {editingExperiment ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
