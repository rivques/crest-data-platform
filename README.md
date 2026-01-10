# CREST Data Platform

A data management platform for the CREST Lab that stores, ingests, manages, and visualizes scientific experiment data.

## Features

- **Store**: PostgreSQL database for relational data with per-sensor typed tables (user-defined schemas)
- **Ingest**: HTTPS REST API for secure sensor data ingestion with API key authentication
- **Manage**: Django admin + REST API for managing experiments, sensors, and API keys
- **Visualize**: Grafana integration for real-time dashboards

## AI Usage
As an experiment, this project was almost entirely created with VS Code Agent. 

# Docs
For documentation, check the hosted documentation on the website or read the [raw docs files](frontend/src/pages/docs/).

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
