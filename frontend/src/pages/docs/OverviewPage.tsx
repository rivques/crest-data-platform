import { Database, Server, Monitor, BarChart3, Shield, Zap } from 'lucide-react'

export default function OverviewPage() {
  return (
    <article className="prose prose-primary max-w-none">
      <h1>CREST Data Platform</h1>
      <p className="lead text-xl text-gray-600">
        A system for ingesting, querying, and visualizing experiment data.
      </p>


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

      <h2>Support</h2>
      <p>
        This project was developed by River. Get in touch via email or the CREST Slack
        if you need help or have questions.
      </p>

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
            <td><code>https://example.com/admin/</code></td>
            <td><code>http://localhost:8000/admin/</code></td>
          </tr>
          <tr>
            <td>Grafana</td>
            <td><code>https://example.com/grafana/</code></td>
            <td><code>http://localhost:3001</code></td>
          </tr>
        </tbody>
      </table>
      <p className="text-sm text-gray-600 mt-4">
        In production, Nginx proxies external HTTPS traffic to Docker containers running on localhost.
      </p>

      <h2>Next Steps</h2>
      <p>If you're trying to set up a sensor you've built:</p>
      <ol>
        <li>Follow <a href="/docs/sensors">Sensors & Experiments Setup</a> to configure your sensor and get an API key</li>
        <li>Follow <a href="/docs/grafana">Grafana Visualization</a> to make charts and live dashboards with your data</li>
      </ol>

      <p>If you're trying to set up the platform for development or production:</p>
      <ol>
        <li>Follow <a href="/docs/setup">Development Setup</a> to run the platform locally for development</li>
        <li>Follow <a href="/docs/deployment">Production Deployment</a> to deploy the platform to a VPS</li>
      </ol>
    </article>
  )
}
