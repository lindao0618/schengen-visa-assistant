# Server Deployment Checklist

This checklist assumes:

- Ubuntu 22.04 or 24.04
- Node.js 20.x
- Python 3.11+
- Project path: `/opt/visa-assistant`
- Reverse proxy: Nginx
- Process manager: `systemd`

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
  libx11-xcb1 libxcb1 libxext6 libxfixes3 libxrender1 libxi6 libxtst6 \
  libpango-1.0-0 libcairo2 libatspi2.0-0
```

Install Node.js 20 if the server does not already have it:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. Clone the repo

```bash
sudo mkdir -p /opt/visa-assistant
sudo chown "$USER":"$USER" /opt/visa-assistant
git clone https://github.com/lindao0618/schengen-visa-assistant.git /opt/visa-assistant
cd /opt/visa-assistant
```

Do not copy these from your local machine:

- `venv`
- `.venv-server`
- `.next`
- `temp`
- `services/usvisa-runtime` runtime outputs
- `services/ds160-processor/venv`
- uploaded Excel/photo runtime files

## 3. Install Node dependencies

```bash
npm ci
```

## 4. Install shared Python runtime

Use one shared server venv for all Python services and for the Python scripts spawned by Next.js:

```bash
chmod +x scripts/setup-server-python.sh
./scripts/setup-server-python.sh
```

This script will:

- create `/opt/visa-assistant/.venv-server`
- install all Python requirements used by the app
- install Playwright Chromium
- generate `country_map.xlsx` for DS-160

## 5. Prepare environment variables

Create a production env file:

```bash
cp .env.example .env.production
```

At minimum, fill in:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `CAPTCHA_API_KEY`
- `DEEPSEEK_API_KEY`
- `TENCENTCLOUD_SECRET_ID`
- `TENCENTCLOUD_SECRET_KEY`
- `TRIP_GENERATOR_URL=http://127.0.0.1:8002`
- `EXPLANATION_LETTER_URL=http://127.0.0.1:8003`
- `MATERIAL_REVIEW_URL=http://127.0.0.1:8004`
- `TLS_MONITOR_URL=http://127.0.0.1:8005`
- `DS160_TIMING=0`

Note:

- `TLS_MONITOR_URL` is intentionally moved to `8005` to avoid clashing with material review on `8004`.
- The Next.js service must have the shared venv in `PATH`, otherwise DS-160 and AIS Python commands may fail at runtime.

## 6. Build the app

```bash
npm run build
```

## 7. Create systemd services

### Next.js app

`/etc/systemd/system/visa-next.service`

```ini
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
```

### AI assistant service

`/etc/systemd/system/visa-ai.service`

```ini
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
```

### Trip generator

`/etc/systemd/system/visa-trip.service`

```ini
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
```

### Explanation letter service

`/etc/systemd/system/visa-letter.service`

```ini
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
```

### Material review service

`/etc/systemd/system/visa-material.service`

```ini
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
```

### TLS monitor service

`/etc/systemd/system/visa-tls-monitor.service`

```ini
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
```

### Photo check service

`/etc/systemd/system/visa-photo.service`

```ini
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
```

Enable and start everything:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now \
  visa-ai.service \
  visa-trip.service \
  visa-letter.service \
  visa-material.service \
  visa-tls-monitor.service \
  visa-photo.service \
  visa-next.service
```

## 8. Configure Nginx

`/etc/nginx/sites-available/visa-assistant`

```nginx
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
```

Then enable it:

```bash
sudo ln -sf /etc/nginx/sites-available/visa-assistant /etc/nginx/sites-enabled/visa-assistant
sudo nginx -t
sudo systemctl reload nginx
```

## 9. Health checks

Run these after startup:

```bash
curl http://127.0.0.1:3000
curl http://127.0.0.1:8000/docs
curl http://127.0.0.1:8002/health
curl http://127.0.0.1:8003/docs
curl http://127.0.0.1:8004/docs
curl http://127.0.0.1:8005/docs
curl http://127.0.0.1:5001/
```

## 10. Common pitfalls

- Do not sync local `venv` or runtime cache directories to the server.
- Install LibreOffice, otherwise Word-to-PDF fallback can fail.
- If Playwright fails, re-run `python -m playwright install chromium` inside `.venv-server`.
- If DS-160, AIS, or photo-check tasks fail from the Next app, set `PYTHON_BIN=/opt/visa-assistant/.venv-server/bin/python` or make sure the app resolves `.venv-server/bin/python` first.
