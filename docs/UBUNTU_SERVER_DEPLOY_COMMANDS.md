# Ubuntu Server Deploy Commands

This is a command-first version of the deployment process for Ubuntu 22.04/24.04.

Assumptions:

- server path: `/opt/visa-assistant`
- domain: `your-domain.com`
- app user: current SSH user
- system services run as `www-data`

## 1. Install system packages

```bash
sudo apt update
sudo apt install -y \
  git curl unzip build-essential nginx \
  python3 python3-venv python3-pip \
  libreoffice poppler-utils \
  libmagic1 libglib2.0-0 libnss3 libnspr4 libdbus-1-3 \
  libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
  libx11-xcb1 libxcb1 libxext6 libxrender1 libxi6 libxtst6 \
  libpango-1.0-0 libcairo2 libatspi2.0-0
```

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
python3 --version
```

## 2. Clone or update the project

First deployment:

```bash
sudo mkdir -p /opt/visa-assistant
sudo chown "$USER":"$USER" /opt/visa-assistant
git clone https://github.com/lindao0618/schengen-visa-assistant.git /opt/visa-assistant
cd /opt/visa-assistant
```

If the repo already exists:

```bash
cd /opt/visa-assistant
git pull origin main
```

## 3. Install Node dependencies

```bash
cd /opt/visa-assistant
npm ci
```

## 4. Create production env file

```bash
cd /opt/visa-assistant
cp .env.example .env.production
nano .env.production
```

Fill in at least:

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://your-domain.com
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
CAPTCHA_API_KEY=
DEEPSEEK_API_KEY=
TENCENTCLOUD_SECRET_ID=
TENCENTCLOUD_SECRET_KEY=
TRIP_GENERATOR_URL=http://127.0.0.1:8002
EXPLANATION_LETTER_URL=http://127.0.0.1:8003
MATERIAL_REVIEW_URL=http://127.0.0.1:8004
TLS_MONITOR_URL=http://127.0.0.1:8005
DS160_TIMING=0
```

## 5. Install shared Python runtime and Playwright

```bash
cd /opt/visa-assistant
chmod +x scripts/setup-server-python.sh
./scripts/setup-server-python.sh
```

## 6. Build Next.js

```bash
cd /opt/visa-assistant
npm run build
```

## 7. Fix permissions for runtime directories

```bash
cd /opt/visa-assistant
sudo mkdir -p temp output/uploads/photos
sudo chown -R www-data:www-data temp output
sudo chown -R www-data:www-data /opt/visa-assistant
```

If you prefer not to hand ownership of the whole repo to `www-data`, use this narrower version instead:

```bash
cd /opt/visa-assistant
sudo chown -R www-data:www-data temp output .next
```

## 8. Create systemd services

### Next.js

```bash
sudo tee /etc/systemd/system/visa-next.service > /dev/null <<'EOF'
[Unit]
Description=Visa Assistant Next.js
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/visa-assistant
EnvironmentFile=/opt/visa-assistant/.env.production
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=PATH=/opt/visa-assistant/.venv-server/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/bin
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF
```

### AI assistant

```bash
sudo tee /etc/systemd/system/visa-ai.service > /dev/null <<'EOF'
[Unit]
Description=Visa Assistant AI API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/visa-assistant/VISA-ASK-SYSTEM
EnvironmentFile=/opt/visa-assistant/.env.production
ExecStart=/opt/visa-assistant/.venv-server/bin/python main_api.py
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF
```

### Trip generator

```bash
sudo tee /etc/systemd/system/visa-trip.service > /dev/null <<'EOF'
[Unit]
Description=Visa Assistant Trip Generator
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/visa-assistant/app/trip_generator
EnvironmentFile=/opt/visa-assistant/.env.production
ExecStart=/opt/visa-assistant/.venv-server/bin/python main.py
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF
```

### Explanation letter

```bash
sudo tee /etc/systemd/system/visa-letter.service > /dev/null <<'EOF'
[Unit]
Description=Visa Assistant Explanation Letter API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/visa-assistant/explanation_letter_generator
EnvironmentFile=/opt/visa-assistant/.env.production
ExecStart=/opt/visa-assistant/.venv-server/bin/python main.py
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF
```

### Material review

```bash
sudo tee /etc/systemd/system/visa-material.service > /dev/null <<'EOF'
[Unit]
Description=Visa Assistant Material Review API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/visa-assistant/app/material_review
EnvironmentFile=/opt/visa-assistant/.env.production
Environment=MATERIAL_REVIEW_PORT=8004
ExecStart=/opt/visa-assistant/.venv-server/bin/python tencent_ocr_main.py
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF
```

### TLS monitor

```bash
sudo tee /etc/systemd/system/visa-tls-monitor.service > /dev/null <<'EOF'
[Unit]
Description=Visa Assistant TLS Monitor API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/visa-assistant/app/monitor/tls-monitor
EnvironmentFile=/opt/visa-assistant/.env.production
ExecStart=/opt/visa-assistant/.venv-server/bin/uvicorn api:app --host 0.0.0.0 --port 8005
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF
```

### Photo checker

```bash
sudo tee /etc/systemd/system/visa-photo.service > /dev/null <<'EOF'
[Unit]
Description=Visa Assistant Photo Check API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/visa-assistant/services/usvisa-runtime
EnvironmentFile=/opt/visa-assistant/.env.production
ExecStart=/opt/visa-assistant/.venv-server/bin/gunicorn -w 2 -b 0.0.0.0:5001 photo_check_api:app
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF
```

## 9. Start all services

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now visa-ai.service
sudo systemctl enable --now visa-trip.service
sudo systemctl enable --now visa-letter.service
sudo systemctl enable --now visa-material.service
sudo systemctl enable --now visa-tls-monitor.service
sudo systemctl enable --now visa-photo.service
sudo systemctl enable --now visa-next.service
```

## 10. Check service status

```bash
sudo systemctl status visa-next.service --no-pager
sudo systemctl status visa-ai.service --no-pager
sudo systemctl status visa-trip.service --no-pager
sudo systemctl status visa-letter.service --no-pager
sudo systemctl status visa-material.service --no-pager
sudo systemctl status visa-tls-monitor.service --no-pager
sudo systemctl status visa-photo.service --no-pager
```

If any service fails:

```bash
journalctl -u visa-next.service -n 100 --no-pager
journalctl -u visa-ai.service -n 100 --no-pager
journalctl -u visa-trip.service -n 100 --no-pager
journalctl -u visa-letter.service -n 100 --no-pager
journalctl -u visa-material.service -n 100 --no-pager
journalctl -u visa-tls-monitor.service -n 100 --no-pager
journalctl -u visa-photo.service -n 100 --no-pager
```

## 11. Configure Nginx

```bash
sudo tee /etc/nginx/sites-available/visa-assistant > /dev/null <<'EOF'
server {
  listen 80;
  server_name your-domain.com;

  client_max_body_size 50m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
EOF
```

```bash
sudo ln -sf /etc/nginx/sites-available/visa-assistant /etc/nginx/sites-enabled/visa-assistant
sudo nginx -t
sudo systemctl reload nginx
```

## 12. Verify ports and health

```bash
curl http://127.0.0.1:3000
curl http://127.0.0.1:8000/docs
curl http://127.0.0.1:8002/health
curl http://127.0.0.1:8003/docs
curl http://127.0.0.1:8004/docs
curl http://127.0.0.1:8005/docs
curl http://127.0.0.1:5001/
```

## 13. Common restart commands

```bash
sudo systemctl restart visa-next.service
sudo systemctl restart visa-ai.service
sudo systemctl restart visa-trip.service
sudo systemctl restart visa-letter.service
sudo systemctl restart visa-material.service
sudo systemctl restart visa-tls-monitor.service
sudo systemctl restart visa-photo.service
```

## 14. Common update flow

```bash
cd /opt/visa-assistant
git pull origin main
npm ci
./scripts/setup-server-python.sh
npm run build
sudo systemctl restart visa-ai.service
sudo systemctl restart visa-trip.service
sudo systemctl restart visa-letter.service
sudo systemctl restart visa-material.service
sudo systemctl restart visa-tls-monitor.service
sudo systemctl restart visa-photo.service
sudo systemctl restart visa-next.service
```
