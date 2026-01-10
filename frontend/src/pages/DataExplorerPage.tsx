import { useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { Loader2, RefreshCw, Download, ChevronLeft } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { PaginatedResponse, Sensor, SensorDataResponse } from '../types/api'

export default function DataExplorerPage() {
  const { sensorId } = useParams()
  const [, setSearchParams] = useSearchParams()
  
  const [selectedSensor, setSelectedSensor] = useState(sensorId || '')
  const [limit, setLimit] = useState(100)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const { data: sensors } = useQuery({
    queryKey: ['sensors'],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Sensor>>('/sensors/')
      return response.data
    },
  })

  const sensor = sensors?.results?.find((s) => s.id === selectedSensor)

  const { data: sensorData, isLoading, refetch } = useQuery({
    queryKey: ['sensorData', selectedSensor, limit, startTime, endTime],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('limit', limit.toString())
      if (startTime) params.set('start_time', startTime)
      if (endTime) params.set('end_time', endTime)
      
      const response = await api.get<SensorDataResponse>(
        `/data/${selectedSensor}/?${params.toString()}`
      )
      return response.data
    },
    enabled: !!selectedSensor,
  })

  const handleSensorChange = (newSensorId: string) => {
    setSelectedSensor(newSensorId)
    setSearchParams(newSensorId ? { sensor: newSensorId } : {})
  }

  const handleExportCSV = () => {
    if (!sensorData?.data || sensorData.data.length === 0) return

    const headers = Object.keys(sensorData.data[0])
    const csvContent = [
      headers.join(','),
      ...sensorData.data.map((row) =>
        headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${sensor?.name || 'sensor'}_data_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Prepare chart data - reverse to show chronological order
  const chartData = sensorData?.data
    ?.slice()
    .reverse()
    .map((row) => ({
      ...row,
      time: new Date(row.timestamp).toLocaleTimeString(),
    }))

  // Get numeric columns for charting
  const numericColumns = sensor?.column_schema
    ? Object.keys(sensor.column_schema).filter((col) => {
        const t = sensor.column_schema[col]
        const typeStr = typeof t === 'string' ? t : t?.type ?? ''
        return /(?:DOUBLE|INTEGER|REAL)/i.test(typeStr)
      })
    : []

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {sensorId && (
            <Link
              to="/sensors"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft size={20} />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Explorer</h1>
            <p className="text-gray-500 mt-1">View and analyze sensor data</p>
          </div>
        </div>
        {sensorData?.data && sensorData.data.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={20} />
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sensor</label>
            <select
              value={selectedSensor}
              onChange={(e) => handleSensorChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Select a sensor...</option>
              {sensors?.results?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.sensor_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={500}>500 rows</option>
              <option value={1000}>1000 rows</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => refetch()}
              disabled={!selectedSensor || isLoading}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {!selectedSensor ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">Select a sensor to view its data</p>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : sensorData?.data && sensorData.data.length > 0 ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-sm text-gray-500">Total Readings</p>
              <p className="text-2xl font-bold text-gray-900">
                {sensorData.total_count.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-sm text-gray-500">Showing</p>
              <p className="text-2xl font-bold text-gray-900">
                {sensorData.returned_count.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-sm text-gray-500">First Reading</p>
              <p className="text-lg font-medium text-gray-900">
                {new Date(sensorData.data[sensorData.data.length - 1].timestamp).toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-sm text-gray-500">Latest Reading</p>
              <p className="text-lg font-medium text-gray-900">
                {new Date(sensorData.data[0].timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Chart */}
          {numericColumns.length > 0 && chartData && chartData.length > 1 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sensor Data Chart</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    {numericColumns.slice(0, 6).map((col, index) => (
                      <Line
                        key={col}
                        type="monotone"
                        dataKey={col}
                        stroke={colors[index % colors.length]}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Timestamp</th>
                    {numericColumns.map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sensorData.data.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(row.timestamp).toLocaleString()}
                      </td>
                      {numericColumns.map((col) => (
                        <td key={col} className="px-4 py-3 text-sm text-gray-900">
                          {typeof row[col] === 'number'
                            ? (row[col] as number).toFixed(2)
                            : String(row[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">No data found for this sensor</p>
        </div>
      )}
    </div>
  )
}
