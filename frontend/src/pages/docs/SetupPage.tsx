import { CheckCircle2, Terminal } from 'lucide-react'
import { CodeBlock, Step } from '../../components/docs'

export default function SetupPage() {
  return (
    <article className="prose prose-primary max-w-none">
      <h1>Development Setup</h1>
      <p className="lead text-xl text-gray-600">
        Get the CREST stack running locally for development. For production deployment, see the Production Deployment guide.
      </p>

      <h2>Prerequisites</h2>
      <div className="not-prose bg-amber-50 border border-amber-200 rounded-lg p-4 my-6">
        <h4 className="font-semibold text-amber-800 mb-2">Prerequisites</h4>
        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-amber-700">
            <CheckCircle2 size={18} className="text-amber-600" />
            <span><strong>Docker Desktop</strong></span>
          </li>
          <li className="flex items-center gap-2 text-amber-700">
            <CheckCircle2 size={18} className="text-amber-600" />
            <span><strong>Git</strong></span>
          </li>
        </ul>
      </div>

      <h2>Quick Start with Docker Compose</h2>
      <p>Use Docker Compose to run all services together.</p>

      <div className="not-prose">
        <Step number={1} title="Clone the repository">
          <p className="text-gray-600 mb-3">
            Clone the CREST Data Platform repository and navigate to the project directory:
          </p>
          <CodeBlock code={`git clone <repository-url>
cd crest-data-platform`} />
        </Step>

        <Step number={2} title="Configure environment (optional)">
          <p className="text-gray-600 mb-3">
            Defaults work for local dev. For overrides, create a <code className="bg-gray-100 px-1 rounded">.env</code> file:
          </p>
          <CodeBlock code={`# Copy the example file
cp .env.example .env

# Edit with your settings (Windows: use copy instead of cp)
# copy .env.example .env`} />
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h4 className="font-semibold text-blue-800 mb-2">Key environment variables</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li><code className="bg-blue-100 px-1 rounded">SECRET_KEY</code> – Django secret key</li>
              <li><code className="bg-blue-100 px-1 rounded">DB_PASSWORD</code> – PostgreSQL password</li>
              <li><code className="bg-blue-100 px-1 rounded">GRAFANA_ADMIN_PASSWORD</code> – Grafana admin password</li>
            </ul>
          </div>
        </Step>

        <Step number={3} title="Start the services">
          <p className="text-gray-600 mb-3">Launch all services with Docker Compose:</p>
          <CodeBlock code={`docker compose up -d`} />
          <p className="text-gray-600 mt-3">
            This starts four containers:
          </p>
          <ul className="text-gray-600 text-sm space-y-1 mt-2">
            <li>• <strong>crest-postgres</strong> – PostgreSQL database</li>
            <li>• <strong>crest-web</strong> – Django API backend</li>
            <li>• <strong>crest-frontend</strong> – React web interface</li>
            <li>• <strong>crest-grafana</strong> – Grafana visualization</li>
          </ul>
        </Step>

        <Step number={4} title="Create an admin user">
          <p className="text-gray-600 mb-3">Create a development admin account:</p>
          <CodeBlock code={`docker compose exec web python manage.py createdevadmin`} />
          <p className="text-gray-600 mt-3 text-sm">
            This creates a user with username <code className="bg-gray-100 px-1 rounded">admin</code> and password <code className="bg-gray-100 px-1 rounded">admin</code>.
          </p>
        </Step>

        <Step number={5} title="Access the services">
          <p className="text-gray-600 mb-3">Open your browser and navigate to:</p>
          <div className="bg-gray-50 rounded-lg divide-y">
            <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 hover:bg-gray-100 transition-colors">
              <div>
                <span className="font-medium text-gray-900">Frontend</span>
                <span className="text-gray-500 text-sm ml-2">– Main web interface</span>
              </div>
              <code className="text-primary-600 text-sm">localhost:3000</code>
            </a>
            <a href="http://localhost:8000" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 hover:bg-gray-100 transition-colors">
              <div>
                <span className="font-medium text-gray-900">API</span>
                <span className="text-gray-500 text-sm ml-2">– REST API endpoints</span>
              </div>
              <code className="text-primary-600 text-sm">localhost:8000</code>
            </a>
            <a href="http://localhost:8000/admin" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 hover:bg-gray-100 transition-colors">
              <div>
                <span className="font-medium text-gray-900">Django Admin</span>
                <span className="text-gray-500 text-sm ml-2">– Database admin panel</span>
              </div>
              <code className="text-primary-600 text-sm">localhost:8000/admin</code>
            </a>
            <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 hover:bg-gray-100 transition-colors">
              <div>
                <span className="font-medium text-gray-900">Grafana</span>
                <span className="text-gray-500 text-sm ml-2">– Data visualization</span>
              </div>
              <code className="text-primary-600 text-sm">localhost:3001</code>
            </a>
          </div>
        </Step>
      </div>

      <h2>Useful Commands</h2>
      <div className="not-prose space-y-4">
        <div>
          <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            <Terminal size={18} />
            View logs
          </h4>
          <CodeBlock code={`# All services
docker compose logs -f

# Specific service
docker compose logs -f web`} />
        </div>

        <div>
          <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            <Terminal size={18} />
            Stop services
          </h4>
          <CodeBlock code={`docker compose down

# Stop and remove volumes (resets database!)
docker compose down -v`} />
        </div>

        <div>
          <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            <Terminal size={18} />
            Rebuild after code changes
          </h4>
          <CodeBlock code={`docker compose up -d --build`} />
        </div>

        <div>
          <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            <Terminal size={18} />
            Run tests
          </h4>
          <CodeBlock code={`docker compose exec web pytest
docker compose exec frontend npm run test:run`} />
        </div>
      </div>

      <h2>Local Development (Without Docker, not recommended)</h2>
      <p>If you really want to, you can run services locally instead of Docker:</p>

      <div className="not-prose">
        <Step number={1} title="Set up Python environment">
          <CodeBlock code={`# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\\Scripts\\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt`} />
        </Step>

        <Step number={2} title="Start PostgreSQL">
          <p className="text-gray-600 mb-3">
            You can still use Docker for just the database:
          </p>
          <CodeBlock code={`docker compose up -d db`} />
        </Step>

        <Step number={3} title="Configure and run Django">
          <CodeBlock code={`# Copy environment file
copy .env.example .env

# Run migrations
python manage.py migrate

# Create admin user
python manage.py createdevadmin

# Start development server
python manage.py runserver`} />
        </Step>

        <Step number={4} title="Start the frontend (optional)">
          <CodeBlock code={`cd frontend
npm install
npm run dev`} />
        </Step>
      </div>

      <h2>Troubleshooting</h2>
      <div className="not-prose space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">Port already in use</h4>
          <p className="text-red-700 text-sm mb-2">
            If you see "port is already allocated" errors, check for conflicting services:
          </p>
          <CodeBlock code={`# Find process using port (Windows)
netstat -ano | findstr :8000

# Find process using port (Linux/Mac)
lsof -i :8000`} />
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">Database connection refused</h4>
          <p className="text-red-700 text-sm">
            Ensure PostgreSQL is running and healthy. Check with <code className="bg-red-100 px-1 rounded">docker compose ps</code>.
            The web service waits for db to be healthy before starting.
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">Frontend can't connect to API</h4>
          <p className="text-red-700 text-sm">
            Check that <code className="bg-red-100 px-1 rounded">VITE_API_URL</code> is set correctly. 
            For Docker, it should be <code className="bg-red-100 px-1 rounded">http://localhost:8000</code>.
          </p>
        </div>
      </div>

      <div className="not-prose bg-green-50 border border-green-200 rounded-lg p-6 mt-8">
        <h3 className="font-semibold text-green-800 mb-2">✓ Setup Complete!</h3>
        <p className="text-green-700">
          Your CREST Data Platform is now running. Continue to the next section to learn how to create experiments and configure sensors.
        </p>
      </div>
    </article>
  )
}
