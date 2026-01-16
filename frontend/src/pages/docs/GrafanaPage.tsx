import { AlertTriangle } from 'lucide-react'
import { CodeBlock, Step } from '../../components/docs'

export default function GrafanaPage() {
  return (
    <article className="prose prose-primary max-w-none">
      <h1>Grafana Visualization</h1>
      <p className="lead text-xl text-gray-600">
        Build Grafana dashboards to query and visualize sensor data from PostgreSQL.
      </p>

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
            <td><em>your columns</em></td>
            <td><em>as defined</em></td>
            <td>Your custom sensor data columns</td>
          </tr>
        </tbody>
      </table>

      <h2>Building an Example Dashboard</h2>
      <p>Example dashboard for a temperature/humidity sensor.</p>

      <div className="not-prose">
        <Step number={1} title="Create the dashboard">
          <p className="text-gray-600 mb-3">
            Click <strong>+</strong> → <strong>Dashboard</strong> → <strong>Add visualization</strong>
          </p>
        </Step>

        <Step number={2} title="Add a time series panel">
          <ol className="text-gray-600 text-sm space-y-2">
            <li>Select <strong>PostgreSQL</strong> data source</li>
            <li>Switch to <strong>Code</strong> mode (SQL editor)</li>
            <li>Enter this query:</li>
          </ol>
          <CodeBlock code={`SELECT
  timestamp AS time,
  temp_c AS "Temperature (°C)"
FROM sensor_temphum_<your-uuid>
WHERE $__timeFilter(timestamp)
ORDER BY timestamp ASC`} />
          <ol className="text-gray-600 text-sm space-y-2 mt-3" start={4}>
            <li>Set panel title to "Temperature Over Time"</li>
            <li>Click <strong>Apply</strong></li>
          </ol>
        </Step>

        <Step number={3} title="Add a current temperature stat">
          <ol className="text-gray-600 text-sm space-y-2">
            <li>Click <strong>Add</strong> → <strong>Visualization</strong></li>
            <li>Select <strong>Stat</strong> visualization type</li>
            <li>Enter this query:</li>
          </ol>
          <CodeBlock code={`SELECT temp_c AS "Current Temp"
FROM sensor_temphum_<your-uuid>
ORDER BY timestamp DESC
LIMIT 1`} />
          <ol className="text-gray-600 text-sm space-y-2 mt-3" start={4}>
            <li>In panel options, set Unit to "Celsius (°C)"</li>
            <li>Add thresholds: Green (0-25), Yellow (25-30), Red (30+)</li>
            <li>Click <strong>Apply</strong></li>
          </ol>
        </Step>

        <Step number={4} title="Add humidity gauge">
          <ol className="text-gray-600 text-sm space-y-2">
            <li>Add another visualization, select <strong>Gauge</strong></li>
            <li>Query for latest humidity:</li>
          </ol>
          <CodeBlock code={`SELECT relative_humidity AS "Humidity"
FROM sensor_temphum_<your-uuid>
ORDER BY timestamp DESC
LIMIT 1`} />
          <ol className="text-gray-600 text-sm space-y-2 mt-3" start={3}>
            <li>Set min: 0, max: 100</li>
            <li>Unit: "Percent (0-100)"</li>
            <li>Add thresholds for comfort zones</li>
          </ol>
        </Step>

        <Step number={5} title="Save the dashboard">
          <ol className="text-gray-600 text-sm space-y-2">
            <li>Click the <strong>💾 Save</strong> icon</li>
            <li>Enter a name like "Greenhouse Monitoring"</li>
            <li>Click <strong>Save</strong></li>
          </ol>
        </Step>
      </div>

      <h2>Auto-Refresh for Live Data</h2>
      <p>
        To see live updates as new data arrives:
      </p>
      <ol>
        <li>Click the <strong>refresh dropdown</strong> in the top-right (🔄)</li>
        <li>Select an interval like <strong>10s</strong> or <strong>5m</strong></li>
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
FROM sensor_temphum_<your-uuid>
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

      <h2>Finding Your Sensor Table Names</h2>
      <p>
        To write queries, you need your sensor's table name. Find it by checking the <strong>Sensors</strong>
        page in this web interface (the name is shown in the sensor details). It'll look something like
        <code>sensor_temperature_a1b2c3d4</code>.
      </p>

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
