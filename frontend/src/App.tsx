import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ExperimentsPage from './pages/ExperimentsPage'
import SensorsPage from './pages/SensorsPage'
import ApiKeysPage from './pages/ApiKeysPage'
import DataExplorerPage from './pages/DataExplorerPage'
import DocsLayout from './pages/docs/DocsLayout'
import OverviewPage from './pages/docs/OverviewPage'
import SetupPage from './pages/docs/SetupPage'
import SensorsTutorialPage from './pages/docs/SensorsTutorialPage'
import GrafanaPage from './pages/docs/GrafanaPage'
import DeploymentPage from './pages/docs/DeploymentPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="experiments" element={<ExperimentsPage />} />
          <Route path="sensors" element={<SensorsPage />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="data/:sensorId?" element={<DataExplorerPage />} />
        </Route>
        <Route
          path="/docs"
          element={
            <ProtectedRoute>
              <DocsLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="setup" element={<SetupPage />} />
          <Route path="sensors" element={<SensorsTutorialPage />} />
          <Route path="grafana" element={<GrafanaPage />} />
          <Route path="deployment" element={<DeploymentPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
