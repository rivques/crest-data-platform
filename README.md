# CREST Data Platform

A data management platform for the CREST Lab that stores, ingests, manages, and visualizes scientific experiment data.

## Features

- **Store**: PostgreSQL database for relational data with per-sensor typed tables (user-defined schemas)
- **Ingest**: HTTPS REST API for secure sensor data ingestion with API key authentication
- **Manage**: Django admin + REST API for managing experiments, sensors, and API keys
- **Visualize**: Grafana integration for real-time dashboards

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Running with Docker Compose

1. Clone the repository and navigate to the project directory:

```bash
cd crest-data-platform
```

2. Start the services:

```bash
docker compose up -d
```

3. Create an admin user:

```bash
docker compose exec web python manage.py createdevadmin
```

4. Access the services:
   - **Django API**: http://localhost:8000
   - **Django Admin**: http://localhost:8000/admin (login: admin / admin)
   - **Frontend**: http://localhost:3000
   - **Grafana**: http://localhost:3001 (login: admin / admin)

### Running Locally (Development)

1. Create a virtual environment:

```bash
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Start PostgreSQL (via Docker):

```bash
docker compose up -d db
```

4. Set environment variables (or create `.env` from `.env.example`):

```bash
copy .env.example .env
```

5. Run migrations and create admin user:

```bash
python manage.py migrate
python manage.py createdevadmin
```

6. Start the development server:

```bash
python manage.py runserver
```

7. (Optional) Run the frontend locally:

```bash
cd frontend
npm install
npm run dev
```

## Secrets / Environment

- Copy `.env.example` to `.env` and replace placeholders before running in any shared or production environment.
- Keep `.env` out of git (already ignored). Store real secrets in your secret manager of choice.
- Docker Compose and Grafana datasource pull credentials from environment variables; defaults are development-only. Set strong values for:
    - `SECRET_KEY`
    - `DB_NAME`, `DB_USER`, `DB_PASSWORD`
    - `GRAFANA_ADMIN_PASSWORD`
    - `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` (match your deployment URLs)
    - `VITE_API_URL` (frontend → API base URL)

Example `.env` for local overrides:

```dotenv
SECRET_KEY=change-me
DB_NAME=crest
DB_USER=crest
DB_PASSWORD=change-me
GRAFANA_ADMIN_PASSWORD=change-me
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
VITE_API_URL=http://localhost:8000
```

## API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login/` | POST | Get JWT tokens |
| `/api/auth/refresh/` | POST | Refresh JWT token |
| `/api/auth/register/` | POST | Register new user |
| `/api/auth/profile/` | GET/PUT | Get/update user profile |

### Experiments

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/experiments/` | GET/POST | List/create experiments |
| `/api/experiments/{id}/` | GET/PUT/DELETE | Get/update/delete experiment |
| `/api/experiments/{id}/sensors/` | GET | List sensors for experiment |

### Sensors

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sensors/` | GET/POST | List/create sensors |
| `/api/sensors/{id}/` | GET/PUT/DELETE | Get/update/delete sensor |
| `/api/sensors/{id}/export_config/` | GET | Export sensor configuration as JSON |
| `/api/sensors/import/` | POST | Import sensor configuration from JSON |
| `/api/column-types/` | GET | List allowed PostgreSQL column types for sensor schemas |
| `/api/api-keys/` | GET/POST | List/create API keys |
| `/api/api-keys/{id}/revoke/` | POST | Revoke an API key |

### Data Ingestion (Sensor Authentication)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingest/` | POST | Submit sensor readings |
| `/api/ingest/status/` | GET | Check sensor authentication status |

### Data Query

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data/{sensor_id}/` | GET | Query sensor data |
| `/api/data/{sensor_id}/latest/` | GET | Get latest reading |
| `/api/data/{sensor_id}/aggregate/` | GET | Get aggregated data |
| `/api/data/{sensor_id}/stats/` | GET | Get column statistics |

## Sensor Integration

### Example: Sending Data from a Sensor

```python
import requests

API_KEY = "your-api-key-here"
ENDPOINT = "https://your-server.com/api/ingest/"

data = {
    "readings": [
        {
            "timestamp": "2025-01-01T12:00:00Z",
            "temp_c": 23.5,
            "relative_humidity": 45.2
        }
    ]
}

response = requests.post(
    ENDPOINT,
    json=data,
    headers={"Authorization": f"Api-Key {API_KEY}"}
)

print(response.json())
```

### MicroPython Example

```python
import urequests
import ujson

API_KEY = "your-api-key-here"
ENDPOINT = "https://your-server.com/api/ingest/"

data = {
    "readings": [
        {"temp_c": 23.5, "relative_humidity": 45.2}
    ]
}

response = urequests.post(
    ENDPOINT,
    data=ujson.dumps(data),
    headers={
        "Authorization": "Api-Key " + API_KEY,
        "Content-Type": "application/json"
    }
)
response.close()
```

## Sensor Schemas

Sensors define their schema at creation time via a `column_schema` object mapping column names to PostgreSQL types.

Example payload (create sensor):

```json
{
    "experiment": "<experiment-id>",
    "name": "DHT22",
    "description": "Temp + humidity",
    "column_schema": {
        "temp_c": "REAL",
        "relative_humidity": "REAL"
    }
}
```

Use `/api/column-types/` to discover allowed column types.

## Sensor Configuration Export/Import

Sensors can be exported to JSON configuration files and re-imported later to create identical sensor setups. This is useful for:
- Backing up sensor configurations
- Replicating sensor setups across environments
- Sharing sensor schemas between projects
- Version controlling sensor configurations

### Exporting a Sensor Configuration

```bash
# Using curl
curl -H "Authorization: Bearer <your-jwt-token>" \
     http://localhost:8000/api/sensors/<sensor-id>/export_config/ \
     -o sensor_config.json
```

The exported JSON includes:
- `config_format_version`: Version of the export format (currently "1.0")
- `sensor.name`: Sensor name
- `sensor.sensor_type`: Sensor type label
- `sensor.description`: Sensor description
- `sensor.metadata`: Custom metadata dictionary
- `sensor.column_schema`: Full column schema including computed fields

**What's NOT exported** (for security/portability):
- Sensor ID and table name (generated on import)
- API keys
- Statistics (reading_count, last_reading_at)
- User/timestamp information
- Experiment association

### Importing a Sensor Configuration

```bash
# Using curl
curl -X POST \
     -H "Authorization: Bearer <your-jwt-token>" \
     -H "Content-Type: application/json" \
     -d '{"config": <exported-config-json>, "name_override": "New Sensor Name"}' \
     http://localhost:8000/api/sensors/import/
```

Import options:
- `config` (required): The exported configuration object
- `name_override` (optional): Use a different name than the one in the config
- `experiment` (optional): UUID of an experiment to associate the sensor with

### Example: Export and Import Round-Trip

```python
import requests

BASE_URL = "http://localhost:8000"
TOKEN = "your-jwt-token"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

# Export a sensor's configuration
sensor_id = "your-sensor-uuid"
export_response = requests.get(
    f"{BASE_URL}/api/sensors/{sensor_id}/export_config/",
    headers=HEADERS
)
config = export_response.json()

# Save to file
import json
with open("sensor_config.json", "w") as f:
    json.dump(config, f, indent=2)

# Later: import to create a new sensor
with open("sensor_config.json") as f:
    config = json.load(f)

import_response = requests.post(
    f"{BASE_URL}/api/sensors/import/",
    headers=HEADERS,
    json={
        "config": config,
        "name_override": "Cloned Sensor"  # Optional new name
    }
)
new_sensor = import_response.json()
print(f"Created sensor: {new_sensor['id']}")
```

## Project Structure

```
crest-data-platform/
├── config/                 # Django settings, URLs
├── apps/
│   ├── users/              # User authentication and management
│   ├── experiments/        # Experiment and document models
│   ├── sensors/            # Sensor registry, API keys, dynamic tables
│   ├── ingest/             # Data ingestion endpoint
│   └── data/               # Data query endpoints
├── frontend/               # React (Vite) web UI
├── grafana/                # Grafana provisioning
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── manage.py
```