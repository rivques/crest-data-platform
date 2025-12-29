import { AlertTriangle, Lock, Server, Shield, Zap } from 'lucide-react'
import { CodeBlock, Step } from '../../components/docs'

export default function DeploymentPage() {
  return (
    <article className="prose prose-primary max-w-none">
      <h1>Production Deployment</h1>
      <p className="lead text-xl text-gray-600">
        Deploy the CREST Data Platform to a VPS with production security, SSL/TLS, and proper secrets management.
      </p>

      <h2>Pre-Deployment Checklist</h2>
      <div className="not-prose bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-amber-800 mb-4">Prerequisites</h3>
        <ul className="space-y-3 text-amber-700">
          <li className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <span><strong>VPS or Server</strong> – Ubuntu 20.04 LTS or later (other distros work similarly)</span>
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <span><strong>Domain Name</strong> – Pointed to your server's IP address</span>
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <span><strong>Docker & Docker Compose</strong> – Installed on the server</span>
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <span><strong>Git</strong> – For cloning the repository</span>
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <span><strong>SSL Certificate</strong> – Obtain via Let's Encrypt (free) or your CA</span>
          </li>
        </ul>
      </div>

      <h2>Step 1: Provision the VPS</h2>
      <p>Set up a basic Ubuntu server with security hardening.</p>

      <div className="not-prose">
        <Step number={1} title="SSH into your VPS">
          <CodeBlock code={`ssh root@your-server-ip
# or if you have a different user
ssh ubuntu@your-server-ip`} />
        </Step>

        <Step number={2} title="Update system packages">
          <CodeBlock code={`apt update && apt upgrade -y`} />
        </Step>

        <Step number={3} title="Install Docker and Docker Compose">
          <CodeBlock code={`# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose (if not included)
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker-compose --version`} />
        </Step>

        <Step number={4} title="Create a non-root user (optional but recommended)">
          <CodeBlock code={`# Create user for running the application
sudo useradd -m -s /bin/bash crest
sudo usermod -aG docker crest
sudo su - crest`} />
        </Step>
      </div>

      <h2>Step 2: Clone and Configure</h2>

      <div className="not-prose">
        <Step number={1} title="Clone the repository">
          <CodeBlock code={`git clone https://github.com/your-org/crest-data-platform.git
cd crest-data-platform`} />
        </Step>

        <Step number={2} title="Create production .env file">
          <p className="text-gray-600 mb-3">
            Copy <code className="bg-gray-100 px-1 rounded">.env.example</code> and update with strong, random values:
          </p>
          <CodeBlock code={`cp .env.example .env
nano .env  # or your favorite editor`} />
          <p className="text-gray-600 mt-4 mb-3">
            Set these to strong random values:
          </p>
          <CodeBlock language="bash" code={`# Generate strong random values
openssl rand -base64 32  # for SECRET_KEY
openssl rand -base64 16  # for DB_PASSWORD, GRAFANA_ADMIN_PASSWORD`} />
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h4 className="font-semibold text-blue-800 mb-3">Production .env example:</h4>
            <CodeBlock language="bash" code={`DEBUG=False
SECRET_KEY=<random-base64-string>

# Database
DB_NAME=crest_prod
DB_USER=crest_user
DB_PASSWORD=<strong-random-password>
DB_HOST=localhost
DB_PORT=5432

# Domain (change to your domain)
ALLOWED_HOSTS=api.example.com,example.com
CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com

# Grafana
GRAFANA_ADMIN_PASSWORD=<strong-random-password>

# Media storage
MEDIA_ROOT=/app/media`} />
          </div>
        </Step>

        <Step number={3} title="Protect the .env file">
          <CodeBlock code={`# Restrict permissions
chmod 600 .env

# Verify it's not world-readable
ls -la .env`} />
        </Step>
      </div>

      <h2>Step 3: Set Up SSL/TLS with Let's Encrypt</h2>
      <p>Use Certbot to obtain and auto-renew free SSL certificates.</p>

      <div className="not-prose">
        <Step number={1} title="Install Certbot">
          <CodeBlock code={`sudo apt install certbot python3-certbot-nginx -y`} />
        </Step>

        <Step number={2} title="Obtain certificate">
          <CodeBlock code={`sudo certbot certonly --standalone -d example.com -d www.example.com`} />
          <p className="text-gray-600 mt-3">
            Certificates are stored in <code className="bg-gray-100 px-1 rounded">/etc/letsencrypt/live/example.com/</code>
          </p>
        </Step>

        <Step number={3} title="Set up auto-renewal">
          <CodeBlock code={`sudo certbot renew --dry-run
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer`} />
        </Step>
      </div>

      <h2>Step 4: Configure Nginx Reverse Proxy</h2>
      <p>Use Nginx to terminate SSL and route traffic to Docker containers.</p>

      <div className="not-prose">
        <Step number={1} title="Install Nginx">
          <CodeBlock code={`sudo apt install nginx -y`} />
        </Step>

        <Step number={2} title="Create Nginx configuration">
          <p className="text-gray-600 mb-3">
            Create <code className="bg-gray-100 px-1 rounded">/etc/nginx/sites-available/crest</code>:
          </p>
          <CodeBlock language="nginx" code={`upstream django {
  server localhost:8000;
}

upstream frontend {
  server localhost:3000;
}

# Redirect HTTP to HTTPS
server {
  listen 80;
  server_name example.com www.example.com;
  return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
  listen 443 ssl http2;
  server_name example.com www.example.com;

  # SSL certificates
  ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

  # Security headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;

  # Logs
  access_log /var/log/nginx/crest_access.log;
  error_log /var/log/nginx/crest_error.log;

  # Frontend (React)
  location / {
    proxy_pass http://frontend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # API
  location /api/ {
    proxy_pass http://django;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
  }

  # Admin panel
  location /admin/ {
    proxy_pass http://django;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Static files (if using whitenoise or similar)
  location /static/ {
    proxy_pass http://django;
    proxy_set_header Host $host;
  }
}`} />
        </Step>

        <Step number={3} title="Enable the site">
          <CodeBlock code={`sudo ln -s /etc/nginx/sites-available/crest /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx`} />
        </Step>
      </div>

      <h2>Step 5: Launch with Docker Compose</h2>

      <div className="not-prose">
        <Step number={1} title="Update docker-compose.yml for production">
          <p className="text-gray-600 mb-3">
            Modify ports to only listen on localhost (Nginx handles external traffic):
          </p>
          <CodeBlock language="yaml" code={`# In docker-compose.yml, change:
web:
  ports:
    - "127.0.0.1:8000:8000"  # Only localhost

frontend:
  ports:
    - "127.0.0.1:3000:3000"  # Only localhost

grafana:
  ports:
    - "127.0.0.1:3001:3000"  # Only localhost`} />
        </Step>

        <Step number={2} title="Start services in production mode">
          <CodeBlock code={`# Start all services (detached)
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f web`} />
        </Step>

        <Step number={3} title="Create initial admin user">
          <CodeBlock code={`docker compose exec web python manage.py createsuperuser

# Or use dev admin with strong password:
docker compose exec web python manage.py createdevadmin --password <your-strong-password>`} />
        </Step>
      </div>

      <h2>Step 6: Set Up Monitoring and Backups</h2>

      <h3>Database Backups</h3>
      <p>Set up automated daily backups of the PostgreSQL database:</p>
      <CodeBlock code={`# Create backup directory
mkdir -p /backups/crest
chmod 700 /backups/crest

# Create backup script (save as /backups/backup-crest.sh)
cat > /backups/backup-crest.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/crest"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/crest_backup_$TIMESTAMP.sql.gz"

docker compose -f /path/to/crest-data-platform/docker-compose.yml exec -T db pg_dump -U crest crest | gzip > "$BACKUP_FILE"

# Keep only 7 days of backups
find "$BACKUP_DIR" -name "crest_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
EOF

chmod +x /backups/backup-crest.sh

# Schedule daily backups (crontab)
(crontab -l 2>/dev/null; echo "0 2 * * * /backups/backup-crest.sh >> /backups/crest/backup.log 2>&1") | crontab -`} />

      <h3>Monitor Service Health</h3>
      <CodeBlock code={`# Check container status
docker compose ps

# View resource usage
docker stats

# Check error logs
docker compose logs web | grep -i error`} />

      <h2>Step 7: Post-Deployment Tasks</h2>

      <h3>Configure Grafana Data Source</h3>
      <ol>
        <li>Access Grafana at <code className="bg-gray-100 px-1 rounded">https://example.com:3001</code> (if exposed) or via localhost forwarding</li>
        <li>Log in with admin credentials from <code className="bg-gray-100 px-1 rounded">.env</code></li>
        <li>Configure PostgreSQL data source (already provisioned, but verify)</li>
        <li>Create dashboards for key metrics</li>
      </ol>

      <h3>Verify HTTPS</h3>
      <p>Test your SSL certificate and security headers:</p>
      <CodeBlock code={`# Test SSL/TLS
curl -I https://example.com

# Check certificate expiry
sudo certbot certificates

# Run security header test
curl -I https://example.com | grep -i "strict-transport"

# Full SSL/TLS test (using ssl-labs-ssltest)
# https://www.ssllabs.com/ssltest/analyze.html?d=example.com`} />

      <h2>Updating the Deployment</h2>

      <p>To update the application after code changes:</p>

      <CodeBlock code={`# Pull latest changes
git pull origin main

# Rebuild and restart services
docker compose up -d --build

# Run migrations
docker compose exec web python manage.py migrate

# Check status
docker compose logs -f web`} />

      <h2>Security Considerations</h2>

      <div className="not-prose space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <Lock size={18} />
            Secrets Management
          </h4>
          <ul className="text-red-700 text-sm space-y-2 ml-4">
            <li>• Store <code className="bg-red-100 px-1 rounded">.env</code> outside version control</li>
            <li>• Use environment variables for all sensitive values (never hardcode)</li>
            <li>• Restrict <code className="bg-red-100 px-1 rounded">.env</code> file permissions to <code className="bg-red-100 px-1 rounded">600</code></li>
            <li>• Use a secrets manager (Vault, AWS Secrets Manager) for larger deployments</li>
          </ul>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <Shield size={18} />
            Firewall and Access Control
          </h4>
          <ul className="text-red-700 text-sm space-y-2 ml-4">
            <li>• Close unnecessary ports (only allow 22/SSH, 80/HTTP, 443/HTTPS)</li>
            <li>• Restrict SSH access (use key-based auth, disable root login)</li>
            <li>• Database should only be accessible from the Django container</li>
            <li>• Consider a WAF (Web Application Firewall) for additional protection</li>
          </ul>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <Zap size={18} />
            Ongoing Maintenance
          </h4>
          <ul className="text-red-700 text-sm space-y-2 ml-4">
            <li>• Keep OS packages updated (<code className="bg-red-100 px-1 rounded">apt upgrade</code>)</li>
            <li>• Rotate API keys periodically</li>
            <li>• Monitor logs for errors and suspicious activity</li>
            <li>• Test backups regularly to ensure recovery works</li>
            <li>• Review Django security checklist: <code className="bg-red-100 px-1 rounded">python manage.py check --deploy</code></li>
          </ul>
        </div>
      </div>

      <h2>Troubleshooting</h2>

      <div className="not-prose space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">Nginx 502 Bad Gateway</h4>
          <p className="text-red-700 text-sm mb-2">
            Django container is not responding. Check:
          </p>
          <CodeBlock code={`docker compose logs web
docker compose ps`} />
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">SSL Certificate Not Renewing</h4>
          <p className="text-red-700 text-sm mb-2">
            Check certbot status and logs:
          </p>
          <CodeBlock code={`sudo systemctl status certbot.timer
sudo journalctl -u certbot -n 20`} />
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">Database Connection Issues</h4>
          <p className="text-red-700 text-sm mb-2">
            Ensure PostgreSQL is running and credentials match:
          </p>
          <CodeBlock code={`docker compose ps db
docker compose logs db`} />
        </div>
      </div>

      <div className="not-prose bg-green-50 border border-green-200 rounded-lg p-6 mt-8">
        <h3 className="font-semibold text-green-800 mb-2">✓ Production Deployment Complete!</h3>
        <p className="text-green-700">
          Your CREST Data Platform is now live. Monitor logs and keep your system updated.
          For questions or issues, consult the Troubleshooting section above.
        </p>
      </div>
    </article>
  )
}
