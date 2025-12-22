# CREST Data Platform - Frontend

React + TypeScript + Vite frontend for the CREST Data Platform.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool with HMR
- **TailwindCSS** - Utility-first CSS
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **React Router** - Client-side routing
- **React Hook Form** - Form handling
- **Recharts** - Data visualization
- **Lucide React** - Icons
- **Axios** - HTTP client

## Development

### Standalone (without Docker)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at http://localhost:3000

### With Docker Compose

From the project root:

```bash
docker compose up frontend
```

## Project Structure

```
src/
├── components/     # Reusable UI components
│   └── Layout.tsx  # Main layout with sidebar
├── lib/
│   └── api.ts      # Axios client with JWT interceptors
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── ExperimentsPage.tsx
│   ├── SensorsPage.tsx
│   ├── ApiKeysPage.tsx
│   └── DataExplorerPage.tsx
├── stores/
│   └── authStore.ts    # Zustand auth state
├── types/
│   └── api.ts      # TypeScript interfaces
├── App.tsx         # Routes configuration
├── main.tsx        # Entry point
└── index.css       # Tailwind imports
```

## Features

### Authentication
- JWT-based authentication
- Automatic token refresh
- Persistent login state

### Dashboard
- Overview statistics
- Recent experiments
- Quick actions

### Experiments
- Create, view, update, delete experiments
- Metadata JSON support

### Sensors
- Register sensors with typed columns
- View sensor readings count
- Link to data explorer

### API Keys
- Generate API keys for sensors
- Copy key on creation (only shown once)
- Revoke/delete keys

### Data Explorer
- Select sensor to view data
- Time range filtering
- Interactive charts
- CSV export
- Statistics display

## Environment Variables

- `VITE_API_URL` - Backend API URL (default: http://localhost:8000)

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.
