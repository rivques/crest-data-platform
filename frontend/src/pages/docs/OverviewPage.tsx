import { Database, Server, Monitor, BarChart3, Shield, Zap } from 'lucide-react'

export default function OverviewPage() {
  return (
    <article className="prose prose-primary max-w-none">
      <h1>CREST Data Platform</h1>
      <p className="lead text-xl text-gray-600">
        A containerized stack for storing, ingesting, querying, and visualizing experiment data.
      </p>

      <h2>System Architecture</h2>
      <p>Core services and their roles:</p>

      <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Server className="text-blue-600" size={24} />
            </div>
            <h3 className="font-semibold text-gray-900">Django Backend</h3>
          </div>
          <p className="text-gray-600 text-sm">
            REST API (Django + DRF) for auth, experiments, sensors, API keys, and data queries.
          </p>
        </div>

        <div className="not-prose bg-green-50 rounded-lg p-6 border border-green-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Database className="text-green-600" size={24} />
            </div>
            <h3 className="font-semibold text-gray-900">PostgreSQL Database</h3>
          </div>
          <p className="text-gray-600 text-sm">
            Stores users, experiments, sensors, API keys, and per-sensor typed tables for readings.
          </p>
        </div>

        <div className="not-prose bg-purple-50 rounded-lg p-6 border border-purple-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Monitor className="text-purple-600" size={24} />
            </div>
            <h3 className="font-semibold text-gray-900">React Frontend</h3>
          </div>
          <p className="text-gray-600 text-sm">
            UI built with React + TypeScript for management, data exploration, and docs.
          </p>
        </div>

        <div className="not-prose bg-orange-50 rounded-lg p-6 border border-orange-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <BarChart3 className="text-orange-600" size={24} />
            </div>
            <h3 className="font-semibold text-gray-900">Grafana</h3>
          </div>
          <p className="text-gray-600 text-sm">
            Visualization and dashboards against the PostgreSQL data source.
          </p>
        </div>
      </div>

      <h2>Key Features</h2>

      <div className="not-prose space-y-4 my-6">
        <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="p-2 bg-primary-100 rounded-lg h-fit">
            <Shield className="text-primary-600" size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">API key auth for sensors</h4>
            <p className="text-gray-600 text-sm mt-1">
              Devices send the <code className="bg-gray-200 px-1 rounded">Api-Key</code> header; keys are hashed and revocable per sensor.
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="p-2 bg-primary-100 rounded-lg h-fit">
            <Database className="text-primary-600" size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Dynamic sensor schemas</h4>
            <p className="text-gray-600 text-sm mt-1">
              Define columns per sensor; each sensor gets a dedicated typed table (REAL, INTEGER, VARCHAR, etc.).
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="p-2 bg-primary-100 rounded-lg h-fit">
            <Zap className="text-primary-600" size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Data ingestion</h4>
            <p className="text-gray-600 text-sm mt-1">
              REST endpoint for readings (batch friendly) with timestamps; usable from Python or microcontrollers.
            </p>
          </div>
        </div>
      </div>

      <h2>Data Flow</h2>
      <div className="not-prose bg-gray-900 text-gray-100 rounded-lg p-6 my-6 font-mono text-sm overflow-x-auto">
        <pre>{`┌─────────────┐     HTTPS + API Key     ┌─────────────┐
│   Sensor    │ ───────────────────────▶│   Django    │
│  (Device)   │    POST /api/ingest/    │   Backend   │
└─────────────┘                         └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐                         ┌─────────────┐
│   Grafana   │◀────── SQL Queries ─────│ PostgreSQL  │
│ Dashboards  │                         │  Database   │
└─────────────┘                         └──────┬──────┘
                                               │
┌─────────────┐      REST API           ┌──────┴──────┐
│    React    │◀────────────────────────│   Django    │
│  Frontend   │   JWT Authentication    │   Backend   │
└─────────────┘                         └─────────────┘`}</pre>
      </div>

      <h2>Service URLs</h2>
      <p>
        When deployed to a VPS with a domain, URLs look like this:
      </p>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Production URL</th>
            <th>Local Dev URL</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Frontend (this app)</td>
            <td><code>https://example.com</code></td>
            <td><code>http://localhost:3000</code></td>
          </tr>
          <tr>
            <td>Django API</td>
            <td><code>https://example.com/api/</code></td>
            <td><code>http://localhost:8000</code></td>
          </tr>
          <tr>
            <td>Django Admin</td>
            <td><code>https://example.com/admin</code></td>
            <td><code>http://localhost:8000/admin</code></td>
          </tr>
          <tr>
            <td>Grafana</td>
            <td>Internal only (via SSH forward or VPN)</td>
            <td><code>http://localhost:3001</code></td>
          </tr>
        </tbody>
      </table>
      <p className="text-sm text-gray-600 mt-4">
        In production, Nginx proxies external HTTPS traffic to Docker containers running on localhost.
        Grafana is not exposed externally for security.
      </p>

      <h2>Next Steps</h2>
      <p>Follow the guides in order:</p>
      <ol>
        <li><strong>System Setup</strong> – start with local development or setup instructions</li>
        <li><strong>Sensors & Experiments</strong> – create experiments and sensors, issue API keys</li>
        <li><strong>Grafana Visualization</strong> – query and chart sensor data</li>
        <li><strong>Production Deployment</strong> – deploy to a VPS with SSL/TLS and proper security</li>
      </ol>
    </article>
  )
}
