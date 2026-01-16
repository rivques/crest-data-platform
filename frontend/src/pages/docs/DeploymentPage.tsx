import { AlertTriangle, Lock, Shield, Zap } from 'lucide-react'
import { CodeBlock, Step } from '../../components/docs'

export default function DeploymentPage() {
  return (
    <article className="prose prose-primary max-w-none">
      <h1>Production Deployment</h1>
      <p className="lead text-xl text-gray-600">
        Deploy the CREST Data Platform to a VPS using a single production Docker Compose file, with SSL/TLS, a reverse
        proxy, and secrets provided via environment variables.
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
            <span><strong>Domain Name</strong> – Pointed to your server's IP address (A/AAAA records)</span>
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <span><strong>Docker & Docker Compose</strong> – Installed on the server</span>
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <span><strong>Git</strong> – For cloning the repository</span>
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

        <Step number={2} title="Set production environment variables (no .env file)">
          <p className="text-gray-600 mb-3">
            Production uses <code className="bg-gray-100 px-1 rounded">docker-compose-prod.yml</code> and reads secrets
            from environment variables. Export them in your shell (or manage them via systemd/your secrets manager).
          </p>
          <p className="text-gray-600 mt-4 mb-3">Generate strong random values:</p>
          <CodeBlock language="bash" code={`openssl rand -base64 32  # SECRET_KEY
openssl rand -base64 24  # DB_PASSWORD
openssl rand -base64 24  # GRAFANA_ADMIN_PASSWORD`} />
          <p className="text-gray-600 mt-4 mb-3">Example (replace values and domain):</p>
          <CodeBlock language="bash" code={`export DOMAIN="example.com"
export DOMAINS="example.com www.example.com"
export CERTBOT_EMAIL="you@example.com"

export SECRET_KEY="<random-base64-string>"

export DB_NAME="crest_prod"
export DB_USER="crest_user"
export DB_PASSWORD="<strong-random-password>"

export ALLOWED_HOSTS="example.com,www.example.com"
export CORS_ALLOWED_ORIGINS="https://example.com,https://www.example.com"

export GRAFANA_ADMIN_PASSWORD="<strong-random-password>"`} />
        </Step>
      </div>

      <h2>Step 3: Launch the Production Stack (Nginx + Certbot in Docker)</h2>
      <p>
        The production stack runs a reverse proxy and TLS automation inside Docker. The only public ports you should
        expose are <code className="bg-gray-100 px-1 rounded">80</code> and{' '}
        <code className="bg-gray-100 px-1 rounded">443</code>.
      </p>

      <div className="not-prose">
        <Step number={1} title="Start the containers (first boot)">
          <p className="text-gray-600 mb-3">
            Start the core services with a short-lived “dummy” certificate so Nginx can come up immediately.
          </p>
          <CodeBlock code={`docker compose -f docker-compose-prod.yml up -d --build db web frontend certbot-init nginx

# Check status
docker compose -f docker-compose-prod.yml ps

# View logs
docker compose -f docker-compose-prod.yml logs -f nginx`} />
        </Step>

        <Step number={2} title="Issue the real Let's Encrypt certificate">
          <p className="text-gray-600 mb-3">
            Use the webroot method (the reverse proxy serves the ACME challenge path). This command is typically run once
            per domain change.
          </p>
          <CodeBlock code={`docker compose -f docker-compose-prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d example.com -d www.example.com \
  --email you@example.com --agree-tos --no-eff-email

# Reload Nginx to pick up the new certificate
docker compose -f docker-compose-prod.yml exec nginx nginx -s reload`} />
        </Step>

        <Step number={3} title="Start auto-renewal">
          <p className="text-gray-600 mb-3">
            This runs <code className="bg-gray-100 px-1 rounded">certbot renew</code> on a schedule inside a container.
          </p>
          <CodeBlock code={`docker compose -f docker-compose-prod.yml up -d certbot

# Optional: verify it can renew (should succeed when close to expiry)
docker compose -f docker-compose-prod.yml logs -f certbot`} />
        </Step>

        <Step number={4} title="Create initial admin user">
          <CodeBlock code={`docker compose -f docker-compose-prod.yml exec web python manage.py createsuperuser

# Or use dev admin (still choose a strong password):
docker compose -f docker-compose-prod.yml exec web python manage.py createdevadmin --password <your-strong-password>`} />
        </Step>
      </div>

      <h2>Step 4: Set Up Monitoring and Backups</h2>

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

# Production compose file (update crest_user/crest_prod to match DB_USER/DB_NAME)
docker compose -f /path/to/crest-data-platform/docker-compose-prod.yml exec -T db \
  pg_dump -U crest_user crest_prod | gzip > "$BACKUP_FILE"

# Keep only 7 days of backups
find "$BACKUP_DIR" -name "crest_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
EOF

chmod +x /backups/backup-crest.sh

# Schedule daily backups (crontab)
(crontab -l 2>/dev/null; echo "0 2 * * * /backups/backup-crest.sh >> /backups/crest/backup.log 2>&1") | crontab -`} />

      <h3>Monitor Service Health</h3>
      <CodeBlock code={`# Check container status
docker compose -f docker-compose-prod.yml ps

# View resource usage
docker stats

# Check error logs
docker compose -f docker-compose-prod.yml logs web | grep -i error`} />

      <h2>Step 5: Post-Deployment Tasks</h2>

      <h3>Configure Grafana Data Source</h3>
      <ol>
        <li>Access Grafana at <code className="bg-gray-100 px-1 rounded">https://example.com/grafana/</code></li>
        <li>
          Dashboards are viewable <strong>read-only without signing in</strong>. Use the Sign in option to log in as an
          admin for editing.
        </li>
        <li>Log in with the admin password you configured for <code className="bg-gray-100 px-1 rounded">GRAFANA_ADMIN_PASSWORD</code></li>
        <li>Configure PostgreSQL data source (Connections-&gt;Data sources)</li>
        <li>Create dashboards for key metrics</li>
        <li>Set up a default dashboard in Administration-&gt;General-&gt;Default preferences</li>
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
docker compose -f docker-compose-prod.yml up -d --build

# Run migrations (if you don't rely on container startup doing it)
docker compose -f docker-compose-prod.yml exec web python manage.py migrate

# Check status
docker compose -f docker-compose-prod.yml logs -f web`} />

      <h2>Security Considerations</h2>

      <div className="not-prose space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <Lock size={18} />
            Secrets Management
          </h4>
          <ul className="text-red-700 text-sm space-y-2 ml-4">
            <li>• Use environment variables for all sensitive values (never hardcode)</li>
            <li>• Use a secrets manager (Vault, AWS Secrets Manager) for larger deployments</li>
            <li>• If using systemd, store secrets in a root-owned EnvironmentFile and restrict permissions</li>
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
          <CodeBlock code={`docker compose -f docker-compose-prod.yml ps
docker compose -f docker-compose-prod.yml logs nginx
docker compose -f docker-compose-prod.yml logs web`} />
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">SSL Certificate Not Renewing</h4>
          <p className="text-red-700 text-sm mb-2">
            Check certbot status and logs:
          </p>
          <CodeBlock code={`docker compose -f docker-compose-prod.yml ps certbot
docker compose -f docker-compose-prod.yml logs --tail=200 certbot`} />
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 mb-2">Database Connection Issues</h4>
          <p className="text-red-700 text-sm mb-2">
            Ensure PostgreSQL is running and credentials match:
          </p>
          <CodeBlock code={`docker compose -f docker-compose-prod.yml ps db
docker compose -f docker-compose-prod.yml logs db`} />
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
