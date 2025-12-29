import { ExternalLink, AlertTriangle } from 'lucide-react'
import { CodeBlock, Step } from '../../components/docs'

export default function GrafanaPage() {
  return (
    <article className="prose prose-primary max-w-none">
      <h1>Grafana Visualization</h1>
      <p className="lead text-xl text-gray-600">
        Build Grafana dashboards to query and visualize sensor data from PostgreSQL.
      </p>

      <div className="not-prose bg-orange-50 border border-orange-200 rounded-lg p-4 my-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <ExternalLink className="text-orange-600" size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-orange-800">Access Grafana</h4>
            <p className="text-orange-700 text-sm mt-1">
              Grafana is available at <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer" className="underline font-medium">http://localhost:3001</a>
              <br />
              Default credentials: <code className="bg-orange-100 px-1 rounded">admin</code> / <code className="bg-orange-100 px-1 rounded">admin</code>
            </p>
          </div>
        </div>
      </div>

      <h2>Understanding the Data Structure</h2>
      <p>Each sensor creates its own PostgreSQL table with a consistent structure.</p>

      <h3>Table Naming Convention</h3>
      <p>
        Sensor tables are named using the pattern: <code>sensor_&lt;type&gt;_&lt;short_uuid&gt;</code>
      </p>
      <p>
        For example, a temperature sensor might have a table named <code>sensor_temperature_a1b2c3d4</code>.
        You can find your sensor's exact table name in the Sensors page or via the API.
      </p>

      <h3>Standard Columns</h3>
      <p>Every sensor table includes these system columns:</p>
      <table>
        <thead>
          <tr>
            <th>Column</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>id</code></td>
            <td>BIGSERIAL</td>
            <td>Auto-incrementing primary key</td>
          </tr>
          <tr>
            <td><code>experiment_id</code></td>
            <td>UUID</td>
            <td>Reference to the experiment (nullable)</td>
          </tr>
          <tr>
            <td><code>timestamp</code></td>
            <td>TIMESTAMPTZ</td>
            <td>When the reading was taken (with timezone)</td>
          </tr>
          <tr>
            <td><code>created_at</code></td>
            <td>TIMESTAMPTZ</td>
            <td>When the server received the data</td>
          </tr>
          <tr>
            <td><em>your columns...</em></td>
            <td><em>as defined</em></td>
            <td>Your custom sensor data columns</td>
          </tr>
        </tbody>
      </table>

      <h2>Getting Started with Grafana</h2>

      <div className="not-prose">
        <Step number={1} title="Log in to Grafana" variant="orange">
          <p className="text-gray-600 mb-3">
            Open <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">http://localhost:3001</a> and log in with:
          </p>
          <ul className="text-gray-600 text-sm space-y-1">
            <li>• Username: <code className="bg-gray-100 px-1 rounded">admin</code></li>
            <li>• Password: <code className="bg-gray-100 px-1 rounded">admin</code> (or your custom password)</li>
          </ul>
          <p className="text-gray-600 mt-3 text-sm">
            You'll be prompted to change the password on first login.
          </p>
        </Step>

        <Step number={2} title="Verify the PostgreSQL data source" variant="orange">
          <p className="text-gray-600 mb-3">
            The CREST platform pre-configures a PostgreSQL data source. Verify it's working:
          </p>
          <ol className="text-gray-600 text-sm space-y-2">
            <li>1. Click the <strong>gear icon</strong> (⚙️) → <strong>Data sources</strong></li>
            <li>2. Click on <strong>PostgreSQL</strong></li>
            <li>3. Scroll down and click <strong>Test</strong></li>
            <li>4. You should see "Database Connection OK"</li>
          </ol>
        </Step>

        <Step number={3} title="Create a new dashboard" variant="orange">
          <p className="text-gray-600 mb-3">
            Create your first dashboard:
          </p>
          <ol className="text-gray-600 text-sm space-y-2">
            <li>1. Click <strong>+</strong> → <strong>Dashboard</strong></li>
            <li>2. Click <strong>Add visualization</strong></li>
            <li>3. Select <strong>PostgreSQL</strong> as the data source</li>
          </ol>
        </Step>
      </div>

      <h2>Writing Queries</h2>
      <p>Use the visual query builder or raw SQL; raw SQL offers the most flexibility for sensor tables.</p>

      <h3>Basic Time Series Query</h3>
      <p>
        This query fetches temperature readings over time:
      </p>
      <CodeBlock code={`SELECT
  timestamp AS time,
  temp_c
FROM sensor_temperature_a1b2c3d4  -- Replace with your table name
WHERE $__timeFilter(timestamp)
ORDER BY timestamp ASC`} />

      <div className="not-prose bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
        <h4 className="font-semibold text-blue-800 mb-2">Grafana Macros</h4>
        <p className="text-blue-700 text-sm">
          <code className="bg-blue-100 px-1 rounded">$__timeFilter(timestamp)</code> is a Grafana macro that automatically 
          filters data based on the dashboard's time range picker.
        </p>
      </div>

      <h3>Multiple Columns (Multi-line Chart)</h3>
      <CodeBlock code={`SELECT
  timestamp AS time,
  temp_c AS "Temperature (°C)",
  relative_humidity AS "Humidity (%)"
FROM sensor_temperature_a1b2c3d4  -- Replace with your table name
WHERE $__timeFilter(timestamp)
ORDER BY timestamp ASC`} />

      <h3>Aggregated Data (for Large Datasets)</h3>
      <p>For larger datasets, aggregate into time buckets:</p>
      <CodeBlock code={`SELECT
  $__timeGroup(timestamp, '5m') AS time,
  AVG(temp_c) AS "Avg Temperature",
  MIN(temp_c) AS "Min Temperature",
  MAX(temp_c) AS "Max Temperature"
FROM sensor_temperature_a1b2c3d4  -- Replace with your table name
WHERE $__timeFilter(timestamp)
GROUP BY 1
ORDER BY 1 ASC`} />

      <h3>Latest Value (Stat Panel)</h3>
      <CodeBlock code={`SELECT
  temp_c AS "Temperature"
FROM sensor_temperature_a1b2c3d4  -- Replace with your table name
ORDER BY timestamp DESC
LIMIT 1`} />

      <h3>Multiple Sensors Comparison</h3>
      <CodeBlock code={`SELECT
  timestamp AS time,
  'Sensor A' AS metric,
  temp_c AS value
FROM sensor_temperature_a1b2c3d4  -- First sensor table
WHERE $__timeFilter(timestamp)

UNION ALL

SELECT
  timestamp AS time,
  'Sensor B' AS metric,
  temp_c AS value
FROM sensor_temperature_e5f6g7h8  -- Second sensor table
WHERE $__timeFilter(timestamp)

ORDER BY time ASC`} />

      <h2>Common Panel Types</h2>

      <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">📈 Time Series</h4>
          <p className="text-gray-600 text-sm mb-3">
            Line charts for data over time. Best for temperature, humidity, power consumption.
          </p>
          <div className="text-xs text-gray-500">
            Query: SELECT time, value FROM ...
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">🔢 Stat</h4>
          <p className="text-gray-600 text-sm mb-3">
            Big number display. Great for current values, totals, averages.
          </p>
          <div className="text-xs text-gray-500">
            Query: SELECT value FROM ... LIMIT 1
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">📊 Gauge</h4>
          <p className="text-gray-600 text-sm mb-3">
            Circular gauge with thresholds. Good for values with defined ranges.
          </p>
          <div className="text-xs text-gray-500">
            Set min/max/thresholds in panel options
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">📋 Table</h4>
          <p className="text-gray-600 text-sm mb-3">
            Tabular data display. Useful for detailed readings or logs.
          </p>
          <div className="text-xs text-gray-500">
            Query: SELECT * FROM ... ORDER BY time DESC
          </div>
        </div>
      </div>

      <h2>Building a Complete Dashboard</h2>
      <p>Example: dashboard for a temperature/humidity sensor.</p>

      <div className="not-prose">
        <Step number={1} title="Create the dashboard">
          <p className="text-gray-600 mb-3">
            Click <strong>+</strong> → <strong>Dashboard</strong> → <strong>Add visualization</strong>
          </p>
        </Step>

        <Step number={2} title="Add a time series panel">
          <ol className="text-gray-600 text-sm space-y-2">
            <li>1. Select <strong>PostgreSQL</strong> data source</li>
            <li>2. Switch to <strong>Code</strong> mode (SQL editor)</li>
            <li>3. Enter this query:</li>
          </ol>
          <CodeBlock code={`SELECT
  timestamp AS time,
  temp_c AS "Temperature (°C)"
FROM sensor_data_<your-uuid>
WHERE $__timeFilter(timestamp)
ORDER BY timestamp ASC`} />
          <ol className="text-gray-600 text-sm space-y-2 mt-3" start={4}>
            <li>4. Set panel title to "Temperature Over Time"</li>
            <li>5. Click <strong>Apply</strong></li>
          </ol>
        </Step>

        <Step number={3} title="Add a current temperature stat">
          <ol className="text-gray-600 text-sm space-y-2">
            <li>1. Click <strong>Add</strong> → <strong>Visualization</strong></li>
            <li>2. Select <strong>Stat</strong> visualization type</li>
            <li>3. Enter this query:</li>
          </ol>
          <CodeBlock code={`SELECT temp_c AS "Current Temp"
FROM sensor_data_<your-uuid>
ORDER BY timestamp DESC
LIMIT 1`} />
          <ol className="text-gray-600 text-sm space-y-2 mt-3" start={4}>
            <li>4. In panel options, set Unit to "Celsius (°C)"</li>
            <li>5. Add thresholds: Green (0-25), Yellow (25-30), Red (30+)</li>
            <li>6. Click <strong>Apply</strong></li>
          </ol>
        </Step>

        <Step number={4} title="Add humidity gauge">
          <ol className="text-gray-600 text-sm space-y-2">
            <li>1. Add another visualization, select <strong>Gauge</strong></li>
            <li>2. Query for latest humidity:</li>
          </ol>
          <CodeBlock code={`SELECT relative_humidity AS "Humidity"
FROM sensor_data_<your-uuid>
ORDER BY timestamp DESC
LIMIT 1`} />
          <ol className="text-gray-600 text-sm space-y-2 mt-3" start={3}>
            <li>3. Set min: 0, max: 100</li>
            <li>4. Unit: "Percent (0-100)"</li>
            <li>5. Add thresholds for comfort zones</li>
          </ol>
        </Step>

        <Step number={5} title="Save the dashboard">
          <ol className="text-gray-600 text-sm space-y-2">
            <li>1. Click the <strong>💾 Save</strong> icon</li>
            <li>2. Enter a name like "Greenhouse Monitoring"</li>
            <li>3. Click <strong>Save</strong></li>
          </ol>
        </Step>
      </div>

      <h2>Auto-Refresh for Live Data</h2>
      <p>
        To see live updates as new data arrives:
      </p>
      <ol>
        <li>Click the <strong>refresh dropdown</strong> in the top-right (🔄)</li>
        <li>Select an interval like <strong>5s</strong> or <strong>10s</strong></li>
        <li>The dashboard will automatically refresh</li>
      </ol>

      <div className="not-prose bg-amber-50 border border-amber-200 rounded-lg p-4 my-6">
        <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
          <AlertTriangle size={18} />
          Performance Tip
        </h4>
        <p className="text-amber-700 text-sm">
          For high-frequency data (multiple readings per second), use aggregation queries 
          and longer time buckets. This reduces database load and improves dashboard performance.
        </p>
      </div>

      <h2>Setting Up Alerts</h2>
      <p>
        Grafana can alert you when sensor values exceed thresholds.
      </p>

      <h3>Create an Alert Rule</h3>
      <ol>
        <li>Open a panel and click <strong>Edit</strong></li>
        <li>Go to the <strong>Alert</strong> tab</li>
        <li>Click <strong>Create alert rule from this panel</strong></li>
        <li>Configure:
          <ul>
            <li>Condition: e.g., "avg() of query(A) is above 30"</li>
            <li>Evaluate every: 1m, for: 5m</li>
          </ul>
        </li>
        <li>Add notification channel (email, Slack, etc.)</li>
      </ol>

      <h3>Example Alert Query</h3>
      <CodeBlock code={`SELECT
  AVG(temp_c) AS temperature
FROM sensor_data_<your-uuid>
WHERE timestamp > NOW() - INTERVAL '5 minutes'`} />

      <h2>Useful Grafana Features</h2>

      <div className="not-prose space-y-4 my-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Variables</h4>
          <p className="text-gray-600 text-sm">
            Create dashboard variables to switch between sensors without editing queries. 
            Go to Dashboard Settings → Variables → Add variable.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Annotations</h4>
          <p className="text-gray-600 text-sm">
            Mark events on your time series (experiments started, calibrations, etc.). 
            Add annotations from Dashboard Settings → Annotations.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Sharing</h4>
          <p className="text-gray-600 text-sm">
            Share dashboards via link, snapshot, or export as JSON. 
            Click the share icon (📤) in the dashboard header.
          </p>
        </div>
      </div>

      <h2>Finding Your Sensor UUIDs</h2>
      <p>
        To write queries, you need your sensor's UUID. Find it by:
      </p>
      <ul>
        <li>Checking the <strong>Sensors</strong> page in this web interface (the ID is shown in the sensor details)</li>
        <li>Using the API: <code>GET /api/sensors/</code></li>
        <li>Looking at the Django Admin panel</li>
      </ul>

      <div className="not-prose bg-green-50 border border-green-200 rounded-lg p-6 mt-8">
        <h3 className="font-semibold text-green-800 mb-2">✓ You're All Set!</h3>
        <p className="text-green-700">
          You now have a complete data pipeline: sensors sending data, storage in PostgreSQL, 
          and beautiful Grafana dashboards for visualization. Happy monitoring!
        </p>
      </div>
    </article>
  )
}
