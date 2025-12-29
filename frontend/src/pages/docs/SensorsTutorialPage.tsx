import { ArrowRight, AlertTriangle, Info } from 'lucide-react'
import { CodeBlock } from '../../components/docs'

export default function SensorsTutorialPage() {
  return (
    <article className="prose prose-primary max-w-none">
      <h1>Sensors & Experiments</h1>
      <p className="lead text-xl text-gray-600">
        Create experiments, define sensor schemas, issue API keys, and send data from devices.
      </p>

      <h2>Concepts Overview</h2>
      <div className="not-prose bg-gray-50 rounded-lg p-6 my-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-gray-700">
          <div>
            <div className="font-semibold">Experiment</div>
            <div className="text-gray-500">Container for related sensors.</div>
          </div>
          <ArrowRight className="text-gray-400 hidden md:block" />
          <div>
            <div className="font-semibold">Sensor</div>
            <div className="text-gray-500">Has a custom data schema.</div>
          </div>
          <ArrowRight className="text-gray-400 hidden md:block" />
          <div>
            <div className="font-semibold">API Key</div>
            <div className="text-gray-500">Authenticates the device.</div>
          </div>
          <ArrowRight className="text-gray-400 hidden md:block" />
          <div>
            <div className="font-semibold">Data</div>
            <div className="text-gray-500">Stored in a typed table.</div>
          </div>
        </div>
      </div>

      <h2>Step 1: Create an Experiment</h2>
      <p>Experiments group related sensors (e.g., a greenhouse study with temp, humidity, and light sensors).</p>

      <h3>Using the Web Interface</h3>
      <ol>
        <li>Navigate to <strong>Experiments</strong> in the sidebar</li>
        <li>Click <strong>New Experiment</strong></li>
        <li>Fill in the details:
          <ul>
            <li><strong>Name</strong> – A descriptive name (e.g., "Greenhouse Monitoring 2025")</li>
            <li><strong>Description</strong> – What this experiment is studying</li>
          </ul>
        </li>
        <li>Click <strong>Create</strong></li>
      </ol>

      <h3>Using the API</h3>
      <CodeBlock language="bash" code={`# Replace example.com with your actual domain (or use localhost:8000 for local dev)
curl -X POST https://example.com/api/experiments/ \\
  -H "Authorization: Bearer <your-jwt-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Greenhouse Monitoring 2025",
    "description": "Monitor temperature and humidity in greenhouse beds"
  }'`} />

      <h2>Step 2: Create a Sensor</h2>
      <p>Sensors represent devices. Each sensor has a custom schema defining its columns.</p>

      <h3>Defining a Schema</h3>
      <p>Specify columns and PostgreSQL types when creating a sensor; a dedicated table is created for that schema.</p>

      <div className="not-prose bg-blue-50 border border-blue-200 rounded-lg p-4 my-6">
        <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <Info size={18} />
          Available Column Types
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <code className="bg-blue-100 px-2 py-1 rounded text-blue-700">DOUBLE PRECISION</code>
          <code className="bg-blue-100 px-2 py-1 rounded text-blue-700">REAL</code>
          <code className="bg-blue-100 px-2 py-1 rounded text-blue-700">INTEGER</code>
          <code className="bg-blue-100 px-2 py-1 rounded text-blue-700">BIGINT</code>
          <code className="bg-blue-100 px-2 py-1 rounded text-blue-700">SMALLINT</code>
          <code className="bg-blue-100 px-2 py-1 rounded text-blue-700">BOOLEAN</code>
          <code className="bg-blue-100 px-2 py-1 rounded text-blue-700">VARCHAR(50)</code>
          <code className="bg-blue-100 px-2 py-1 rounded text-blue-700">VARCHAR(100)</code>
          <code className="bg-blue-100 px-2 py-1 rounded text-blue-700">VARCHAR(255)</code>
          <code className="bg-blue-100 px-2 py-1 rounded text-blue-700">TEXT</code>
        </div>
      </div>

      <h3>Using the Web Interface</h3>
      <ol>
        <li>Navigate to <strong>Sensors</strong> in the sidebar</li>
        <li>Click <strong>New Sensor</strong></li>
        <li>Select the parent <strong>Experiment</strong></li>
        <li>Enter sensor <strong>Name</strong> and <strong>Description</strong></li>
        <li>Build your schema:
          <ul>
            <li>Click <strong>Add Column</strong></li>
            <li>Enter column name (e.g., <code>temp_c</code>, <code>humidity</code>)</li>
            <li>Select data type from dropdown</li>
            <li>Repeat for each data field</li>
          </ul>
        </li>
        <li>Click <strong>Create</strong></li>
      </ol>

      <h3>Using the API</h3>
      <CodeBlock language="bash" code={`# Replace example.com with your domain (or use localhost:8000 for local dev)
curl -X POST https://example.com/api/sensors/ \\
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
  }'`} />

      <h3>Example Schemas</h3>
      <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Temperature + Humidity</h4>
          <CodeBlock language="json" code={`{
  "temp_c": "REAL",
  "relative_humidity": "REAL"
}`} />
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Air Quality</h4>
          <CodeBlock language="json" code={`{
  "temp_c": "REAL",
  "humidity": "REAL",
  "co2_ppm": "INTEGER",
  "pm2_5": "REAL",
  "pm10": "REAL"
}`} />
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Power Monitor</h4>
          <CodeBlock language="json" code={`{
  "voltage_v": "REAL",
  "current_a": "REAL",
  "power_w": "REAL",
  "energy_kwh": "DOUBLE PRECISION"
}`} />
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">GPS Tracker</h4>
          <CodeBlock language="json" code={`{
  "latitude": "DOUBLE PRECISION",
  "longitude": "DOUBLE PRECISION",
  "altitude_m": "REAL",
  "speed_kmh": "REAL"
}`} />
        </div>
      </div>

      <h2>Computed Fields</h2>
      <p>
        Computed fields allow you to calculate values on the server when data arrives. This is useful for:
      </p>
      <ul>
        <li><strong>Offloading computation</strong> from embedded devices (e.g., converting raw ADC values to temperature)</li>
        <li><strong>Adding contextual data</strong> (e.g., fetching weather data from an API)</li>
        <li><strong>Unit conversions</strong> (e.g., Celsius to Fahrenheit)</li>
        <li><strong>Complex calculations</strong> (e.g., heat index from temperature and humidity)</li>
      </ul>

      <h3>Defining a Computed Field</h3>
      <p>
        When creating a sensor, check the "Computed" checkbox for any field you want calculated server-side.
        Then provide a Python function that computes the value:
      </p>

      <CodeBlock language="json" code={`{
  "temp_c": "REAL",
  "humidity": "REAL",
  "temp_f": {
    "type": "REAL",
    "computed": true,
    "compute_function": "def compute(data):\\n    return data['temp_c'] * 9/5 + 32"
  }
}`} />

      <h3>Compute Function Requirements</h3>
      <div className="not-prose bg-blue-50 border border-blue-200 rounded-lg p-4 my-6">
        <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <Info size={18} />
          Function Structure
        </h4>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Must define a function called <code className="bg-blue-100 px-1 rounded">compute(data)</code></li>
          <li>• The <code className="bg-blue-100 px-1 rounded">data</code> parameter contains all non-computed sensor fields</li>
          <li>• Return the computed value (must match the column type)</li>
          <li>• Runs in a sandboxed environment with limited access</li>
        </ul>
      </div>

      <h3>Available in Compute Functions</h3>
      <div className="not-prose grid grid-cols-2 gap-4 my-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-800 mb-2">✓ Allowed</h4>
          <ul className="text-green-700 text-sm space-y-1">
            <li>• <code>math</code> module (sqrt, sin, cos, etc.)</li>
            <li>• <code>statistics</code> module</li>
            <li>• <code>datetime</code> module</li>
            <li>• <code>json</code> module</li>
            <li>• <code>requests</code> for HTTP calls</li>
            <li>• <code>re</code> for regex</li>
            <li>• Basic Python builtins (int, float, str, list, dict, etc.)</li>
          </ul>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">✗ Blocked</h4>
          <ul className="text-red-700 text-sm space-y-1">
            <li>• File system access (open, os, etc.)</li>
            <li>• System commands (subprocess, etc.)</li>
            <li>• Network access except HTTP</li>
            <li>• Infinite loops (5 second timeout)</li>
          </ul>
        </div>
      </div>

      <h3>Example: Temperature Conversion</h3>
      <CodeBlock language="python" code={`def compute(data):
    # Convert Celsius to Fahrenheit
    return data['temp_c'] * 9/5 + 32`} />

      <h3>Example: Heat Index Calculation</h3>
      <CodeBlock language="python" code={`def compute(data):
    import math
    
    T = data['temp_f']
    R = data['humidity']
    
    if T < 80:
        return T
    
    # Rothfusz regression
    HI = -42.379 + 2.04901523*T + 10.14333127*R
    HI = HI - 0.22475541*T*R - 0.00683783*T*T
    HI = HI - 0.05481717*R*R + 0.00122874*T*T*R
    HI = HI + 0.00085282*T*R*R - 0.00000199*T*T*R*R
    
    return round(HI, 1)`} />

      <h3>Example: Fetch Weather Data</h3>
      <CodeBlock language="python" code={`def compute(data):
    # Fetch current weather for context
    # Note: Use a free API like Open-Meteo
    lat = data.get('latitude', 42.3601)
    lon = data.get('longitude', -71.0589)
    
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m"
    response = requests.get(url)
    weather = response.json()
    
    return weather['current']['temperature_2m']`} />

      <h3>Error Handling</h3>
      <p>
        If a compute function fails (syntax error, runtime error, timeout), the field value will be 
        <code className="bg-gray-100 px-1 rounded">NULL</code> and an error will be logged. You can view 
        errors in the sensor's detail page in the web interface.
      </p>

      <h2>Step 3: Generate an API Key</h2>
      <p>API keys authenticate devices; each key belongs to one sensor and can be revoked.</p>

      <div className="not-prose bg-amber-50 border border-amber-200 rounded-lg p-4 my-6">
        <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
          <AlertTriangle size={18} />
          Important: Save Your API Key!
        </h4>
        <p className="text-amber-700 text-sm">
          The full API key is only shown <strong>once</strong> when created. Store it securely – 
          if lost, you'll need to create a new key.
        </p>
      </div>

      <h3>Using the Web Interface</h3>
      <ol>
        <li>Navigate to <strong>API Keys</strong> in the sidebar</li>
        <li>Click <strong>New API Key</strong></li>
        <li>Select the <strong>Sensor</strong> this key is for</li>
        <li>Enter a <strong>Name</strong> (e.g., "Production Device" or "Test Key")</li>
        <li>Optionally set an <strong>Expiration Date</strong></li>
        <li>Click <strong>Create</strong></li>
        <li><strong>Copy and save the displayed API key immediately!</strong></li>
      </ol>

      <h3>Using the API</h3>
      <CodeBlock language="bash" code={`# Replace example.com with your domain
curl -X POST https://example.com/api/api-keys/ \\
  -H "Authorization: Bearer <your-jwt-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sensor": "<sensor-uuid>",
    "name": "Production Device"
  }'`} />

      <h2>Step 4: Send Data from Your Device</h2>
      <p>Use the ingestion endpoint to send JSON readings once the sensor and API key are ready.</p>

      <h3>API Endpoint</h3>
      <CodeBlock language="text" code={`POST https://example.com/api/ingest/
Header: Authorization: Api-Key <your-api-key>
Content-Type: application/json

# For local development:
POST http://localhost:8000/api/ingest/`} />

      <h3>Payload Format</h3>
      <CodeBlock language="json" code={`{
  "readings": [
    {
      "timestamp": "2025-01-15T14:30:00Z",  // Optional - defaults to server time
      "temp_c": 23.5,
      "relative_humidity": 65.2
    }
  ]
}`} />

      <h3>Python Example</h3>
      <CodeBlock language="python" code={`import requests
from datetime import datetime

API_KEY = "your-api-key-here"
ENDPOINT = "https://example.com/api/ingest/"  # Change to your domain
# For local dev: ENDPOINT = "http://localhost:8000/api/ingest/"

# Single reading
data = {
    "readings": [
        {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "temp_c": 23.5,
            "relative_humidity": 65.2
        }
    ]
}

response = requests.post(
    ENDPOINT,
    json=data,
    headers={"Authorization": f"Api-Key {API_KEY}"}
)

if response.ok:
    print(f"Success! Inserted {response.json()['readings_count']} readings")
else:
    print(f"Error: {response.json()}")`} />

      <h3>MicroPython Example (ESP32, Raspberry Pi Pico W)</h3>
      <CodeBlock language="python" code={`import urequests
import ujson
import time

API_KEY = "your-api-key-here"
ENDPOINT = "http://your-server:8000/api/ingest/"

def send_reading(temp_c, humidity):
    data = {
        "readings": [
            {"temp_c": temp_c, "relative_humidity": humidity}
        ]
    }
    
    try:
        response = urequests.post(
            ENDPOINT,
            data=ujson.dumps(data),
            headers={
                "Authorization": "Api-Key " + API_KEY,
                "Content-Type": "application/json"
            }
        )
        print("Status:", response.status_code)
        response.close()
    except Exception as e:
        print("Error:", e)

# Example: read from DHT22 and send
import dht
import machine

sensor = dht.DHT22(machine.Pin(4))

while True:
    sensor.measure()
    send_reading(sensor.temperature(), sensor.humidity())
    time.sleep(60)  # Send every minute`} />

      <h3>Arduino/C++ Example</h3>
      <CodeBlock language="cpp" code={`#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* API_KEY = "your-api-key-here";
const char* ENDPOINT = "http://your-server:8000/api/ingest/";

void sendReading(float temp_c, float humidity) {
  HTTPClient http;
  http.begin(ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Api-Key ") + API_KEY);
  
  StaticJsonDocument<256> doc;
  JsonArray readings = doc.createNestedArray("readings");
  JsonObject reading = readings.createNestedObject();
  reading["temp_c"] = temp_c;
  reading["relative_humidity"] = humidity;
  
  String payload;
  serializeJson(doc, payload);
  
  int httpCode = http.POST(payload);
  Serial.println("Response: " + String(httpCode));
  http.end();
}`} />

      <h3>Batch Upload</h3>
      <p>
        You can send multiple readings in a single request – useful for devices that buffer data 
        or have intermittent connectivity:
      </p>
      <CodeBlock language="json" code={`{
  "readings": [
    {"timestamp": "2025-01-15T14:00:00Z", "temp_c": 22.1, "relative_humidity": 63.0},
    {"timestamp": "2025-01-15T14:05:00Z", "temp_c": 22.3, "relative_humidity": 62.5},
    {"timestamp": "2025-01-15T14:10:00Z", "temp_c": 22.5, "relative_humidity": 62.0},
    {"timestamp": "2025-01-15T14:15:00Z", "temp_c": 22.8, "relative_humidity": 61.5}
  ]
}`} />

      <h2>Sensor Configuration Export & Import</h2>
      <p>
        You can export sensor configurations to JSON files and re-import them later. This is useful for:
      </p>
      <ul>
        <li><strong>Backup</strong> – Save sensor configurations for disaster recovery</li>
        <li><strong>Replication</strong> – Create identical sensors across environments (dev/staging/prod)</li>
        <li><strong>Sharing</strong> – Share sensor configurations between projects or team members</li>
        <li><strong>Version Control</strong> – Store sensor configs in git alongside your code</li>
      </ul>

      <h3>Exporting a Sensor Configuration</h3>
      <p><strong>Using the Web Interface:</strong></p>
      <ol>
        <li>Navigate to <strong>Sensors</strong></li>
        <li>Find the sensor you want to export</li>
        <li>Click the <strong>Download</strong> icon in the Actions column</li>
        <li>The configuration file will be saved to your downloads folder</li>
      </ol>

      <p><strong>Using the API:</strong></p>
      <CodeBlock language="bash" code={`# Export sensor configuration
curl "https://example.com/api/sensors/<sensor-id>/export_config/" \\
  -H "Authorization: Bearer <jwt-token>" \\
  -o sensor_config.json

# The exported file contains:
# - Sensor name and type
# - Description and metadata
# - Full column schema (including computed fields)
# - Does NOT include: IDs, API keys, statistics, or user info`} />

      <h3>Importing a Sensor Configuration</h3>
      <p><strong>Using the Web Interface:</strong></p>
      <ol>
        <li>Navigate to <strong>Sensors</strong></li>
        <li>Click <strong>Import Config</strong> button</li>
        <li>Choose your JSON configuration file</li>
        <li>Optionally:
          <ul>
            <li>Override the sensor name</li>
            <li>Associate with an experiment</li>
          </ul>
        </li>
        <li>Click <strong>Import Sensor</strong></li>
      </ol>

      <p><strong>Using the API:</strong></p>
      <CodeBlock language="bash" code={`# Import sensor configuration
curl -X POST "https://example.com/api/sensors/import/" \\
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
EOF`} />

      <h3>Example Use Cases</h3>
      <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Development to Production</h4>
          <ol className="text-sm text-gray-700 space-y-1 ml-4">
            <li>Design sensor schema in dev environment</li>
            <li>Export the configuration once finalized</li>
            <li>Import into production with a new name</li>
            <li>Generate new API keys for production use</li>
          </ol>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Sensor Fleet Deployment</h4>
          <ol className="text-sm text-gray-700 space-y-1 ml-4">
            <li>Create one sensor with desired schema</li>
            <li>Export the configuration</li>
            <li>Import multiple times with different names</li>
            <li>Each gets its own API key and data table</li>
          </ol>
        </div>
      </div>

      <div className="not-prose bg-yellow-50 border border-yellow-200 rounded-lg p-4 my-6">
        <div className="flex items-start gap-2">
          <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm">
            <p className="font-semibold text-yellow-800 mb-1">Important Notes</p>
            <ul className="text-yellow-700 space-y-1 ml-4">
              <li>Each import creates a completely new sensor with a new UUID and table</li>
              <li>API keys are never exported for security reasons</li>
              <li>Existing data is not exported – only the configuration</li>
              <li>Computed field functions are preserved in exports</li>
            </ul>
          </div>
        </div>
      </div>

      <h2>Viewing Your Data</h2>
      <p>
        Once data is flowing, you can view it in several ways:
      </p>
      <ul>
        <li><strong>Data Explorer</strong> – Built-in viewer in this web interface</li>
        <li><strong>Grafana</strong> – Create rich dashboards (see next section)</li>
        <li><strong>API</strong> – Query programmatically via REST endpoints</li>
      </ul>

      <h3>Data Query API</h3>
      <CodeBlock language="bash" code={`# For production (replace example.com with your domain)
curl "https://example.com/api/data/<sensor-id>/?limit=100" \\
  -H "Authorization: Bearer <jwt-token>"

# For local development
curl "http://localhost:8000/api/data/<sensor-id>/?limit=100" \\
  -H "Authorization: Bearer <jwt-token>"

# Get latest reading
curl "http://localhost:8000/api/data/<sensor-id>/latest/" \\
  -H "Authorization: Bearer <jwt-token>"

# Get statistics
curl "http://localhost:8000/api/data/<sensor-id>/stats/" \\
  -H "Authorization: Bearer <jwt-token>"`} />

      <div className="not-prose bg-green-50 border border-green-200 rounded-lg p-6 mt-8">
        <h3 className="font-semibold text-green-800 mb-2">✓ Sensor Configured!</h3>
        <p className="text-green-700">
          Your sensor is now sending data to the platform. Continue to the Grafana section to 
          learn how to create beautiful real-time dashboards.
        </p>
      </div>
    </article>
  )
}
