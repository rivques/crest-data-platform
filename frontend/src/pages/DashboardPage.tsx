import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { FlaskConical, Cpu, Key, Activity, ArrowRight } from 'lucide-react'
import type { PaginatedResponse, Experiment, Sensor, SensorApiKey } from '../types/api'

export default function DashboardPage() {
  const { data: experiments } = useQuery({
    queryKey: ['experiments'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Experiment>>('/experiments/')
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

  const { data: apiKeys } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<SensorApiKey>>('/api-keys/')
      return response.data
    },
  })

  const stats = [
    {
      label: 'Experiments',
      value: experiments?.count ?? 0,
      icon: FlaskConical,
      color: 'bg-blue-500',
      link: '/experiments',
    },
    {
      label: 'Sensors',
      value: sensors?.count ?? 0,
      icon: Cpu,
      color: 'bg-green-500',
      link: '/sensors',
    },
    {
      label: 'API Keys',
      value: apiKeys?.count ?? 0,
      icon: Key,
      color: 'bg-purple-500',
      link: '/api-keys',
    },
    {
      label: 'Active Sensors',
      value: sensors?.results?.filter((s) => s.is_active).length ?? 0,
      icon: Activity,
      color: 'bg-orange-500',
      link: '/sensors',
    },
  ]

  // Get recent sensors with readings
  const recentSensors = sensors?.results
    ?.filter((s) => s.last_reading_at)
    .sort((a, b) => 
      new Date(b.last_reading_at!).getTime() - new Date(a.last_reading_at!).getTime()
    )
    .slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your CREST Data Platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(({ label, value, icon: Icon, color, link }) => (
          <Link
            key={label}
            to={link}
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className={`${color} p-3 rounded-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sensors */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Sensor Activity</h2>
            <Link
              to="/sensors"
              className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1"
            >
              View all <ArrowRight size={16} />
            </Link>
          </div>
          
          {recentSensors && recentSensors.length > 0 ? (
            <div className="space-y-4">
              {recentSensors.map((sensor) => (
                <div
                  key={sensor.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium text-gray-900">{sensor.name}</p>
                    <p className="text-sm text-gray-500">{sensor.sensor_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {sensor.reading_count.toLocaleString()} readings
                    </p>
                    <p className="text-xs text-gray-500">
                      Last: {new Date(sensor.last_reading_at!).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No recent sensor activity</p>
          )}
        </div>

        {/* Recent Experiments */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Experiments</h2>
            <Link
              to="/experiments"
              className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1"
            >
              View all <ArrowRight size={16} />
            </Link>
          </div>
          
          {experiments?.results && experiments.results.length > 0 ? (
            <div className="space-y-4">
              {experiments.results.slice(0, 5).map((experiment) => (
                <div
                  key={experiment.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium text-gray-900">{experiment.name}</p>
                    <p className="text-sm text-gray-500 line-clamp-1">
                      {experiment.description || 'No description'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {new Date(experiment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No experiments yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
