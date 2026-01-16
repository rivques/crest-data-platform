import { NavLink, Outlet } from 'react-router-dom'
import { BookOpen, Server, Rocket, Cpu, LineChart, ArrowLeft, Cloud, Code2 } from 'lucide-react'
import { Link } from 'react-router-dom'

const docSections = [
  { path: '/docs', label: 'Overview', icon: BookOpen, end: true },
  { path: '/docs/sensors', label: 'Sensors & Experiments Setup', icon: Cpu, end: false },
  { path: '/docs/grafana', label: 'Grafana Visualization', icon: LineChart, end: false },
  { path: '/docs/setup', label: 'Development Setup', icon: Server, end: false },
  { path: '/docs/deployment', label: 'Production Deployment', icon: Cloud, end: false },
  { path: '/docs/api', label: 'API Guide', icon: Code2, end: false },
]

export default function DocsLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="hidden sm:inline">Back to App</span>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-xl font-bold text-primary-600 flex items-center gap-2">
                <Rocket size={24} />
                CREST Documentation
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 flex-shrink-0">
            <nav className="bg-white rounded-lg shadow-sm p-4 sticky top-24">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Documentation
              </h2>
              <ul className="space-y-1">
                {docSections.map(({ path, label, icon: Icon, end }) => (
                  <li key={path}>
                    <NavLink
                      to={path}
                      end={end}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-primary-50 text-primary-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`
                      }
                    >
                      <Icon size={18} />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="bg-white rounded-lg shadow-sm p-6 lg:p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
