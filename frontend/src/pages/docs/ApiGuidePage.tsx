import { CodeBlock } from '../../components/docs'

export default function ApiGuidePage() {
  return (
    <article className="prose prose-primary max-w-none">
      <h1>API Guide</h1>
      <p className="lead text-xl text-gray-600">
        If you want to interact with the platform with code, beyond just sending it data, use the REST API. You probably don't need this. (This is how the frontend communicates with the backend.)
      </p>

      <h2>Base URL & Auth</h2>
      <p>
        All endpoints live under <code>/api</code>. Use JWTs for user-scoped requests and Api Keys for device ingest.
      </p>

      <h3>Get a JWT</h3>
      <CodeBlock
        language="bash"
        code={`curl -X POST https://example.com/api/auth/login/ \\
  -H "Content-Type: application/json" \\
  -d '{"username": "admin", "password": "your-password"}'`}
      />
      <p className="text-sm text-gray-600">
        The response contains <code>access</code> and <code>refresh</code> tokens. Send the access token with
        <code>Authorization: Bearer &lt;token&gt;</code>. Refresh with <code>POST /api/auth/refresh/</code> when needed.
      </p>

      <h2>Experiments</h2>
      <p>Create or list experiments to group sensors and runs.</p>
      <CodeBlock
        language="bash"
        code={`# Create
curl -X POST https://example.com/api/experiments/ \\
  -H "Authorization: Bearer <your-jwt-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Greenhouse Monitoring 2025",
    "description": "Monitor temperature and humidity in greenhouse beds"
  }'

# List
curl -H "Authorization: Bearer <your-jwt-token>" \
  https://example.com/api/experiments/`}
      />

      <h2>Sensors</h2>
      <p>Define a schema and create a sensor; each sensor gets its own table.</p>
      <CodeBlock
        language="bash"
        code={`curl -X POST https://example.com/api/sensors/ \\
  -H "Authorization: Bearer <your-jwt-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "experiment": "<experiment-uuid>",
    "name": "DHT22 Sensor - Bed A",
    "description": "Temperature and humidity sensor in greenhouse bed A",
    "column_schema": {
      "temp_c": "REAL",
      "relative_humidity": "REAL"
    }
  }'

# Column type options
curl -H "Authorization: Bearer <your-jwt-token>" \
  https://example.com/api/column-types/`}
      />
      <p className="text-sm text-gray-600">
        Include computed fields by setting <code>computed: true</code> and <code>compute_function</code> in a column
        definition. See the Sensors guide for examples of compute functions.
      </p>

      <h2>API Keys</h2>
      <p>Issue per-sensor keys for device ingest.</p>
      <CodeBlock
        language="bash"
        code={`curl -X POST https://example.com/api/api-keys/ \\
  -H "Authorization: Bearer <your-jwt-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sensor": "<sensor-uuid>",
    "name": "Production Device"
  }'`}
      />

      <h2>Sensor Configuration Export & Import</h2>
      <p>Back up or duplicate sensors across environments using the export/import endpoints.</p>

      <h3>Export a Sensor</h3>
      <CodeBlock
        language="bash"
        code={`curl "https://example.com/api/sensors/<sensor-id>/export_config/" \\
  -H "Authorization: Bearer <jwt-token>" \\
  -o sensor_config.json

# The exported file contains:
# - Sensor name and type
# - Description and metadata
# - Full column schema (including computed fields)
# - Does NOT include: IDs, API keys, statistics, or user info`}
      />

      <h3>Import a Sensor</h3>
      <CodeBlock
        language="bash"
        code={`curl -X POST "https://example.com/api/sensors/import/" \\
  -H "Authorization: Bearer <jwt-token>" \\
  -H "Content-Type: application/json" \\
  -d @- << 'EOF'
{
  "config": {
    "config_format_version": "1.0",
    "sensor": {
      "name": "DHT22 Sensor",
      "sensor_type": "temperature",
      "description": "Temperature and humidity",
      "metadata": {},
      "column_schema": {
        "temp_c": "DOUBLE PRECISION",
        "humidity": "DOUBLE PRECISION"
      }
    }
  },
  "name_override": "DHT22 Sensor - Production",
  "experiment": "<experiment-uuid>"
}
EOF`}
      />

      <h2>Read Sensor Data</h2>
      <p>Query data collected for a sensor using its UUID.</p>
      <CodeBlock
        language="bash"
        code={`# Paginated readings (supports start_time, end_time, experiment_id, limit, offset, order_by, order_dir)
curl -H "Authorization: Bearer <your-jwt-token>" \
  "https://example.com/api/data/<sensor-uuid>/?limit=100&order_dir=desc"

# Latest reading
curl -H "Authorization: Bearer <your-jwt-token>" \
  https://example.com/api/data/<sensor-uuid>/latest/

# Aggregations (interval: 1 minute|5 minutes|15 minutes|1 hour|1 day)
curl -H "Authorization: Bearer <your-jwt-token>" \
  "https://example.com/api/data/<sensor-uuid>/aggregate/?column=temp_c&aggregation=avg&interval=1%20hour"

# Column stats
curl -H "Authorization: Bearer <your-jwt-token>" \
  "https://example.com/api/data/<sensor-uuid>/stats/?column=temp_c"`}
      />

      <h2>Ingest from Devices</h2>
      <p>
        Devices send readings with an Api Key to <code>POST /api/ingest/</code>. See <a href="/docs/sensors">the Sensors & Experiments
        guide</a> for full payload and language-specific examples.
      </p>
    </article>
  )
}
