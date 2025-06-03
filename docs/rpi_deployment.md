# North Sea Watch Raspberry Pi Deployment Guide

This document provides detailed instructions for deploying the North Sea Watch application on a Raspberry Pi.

## System Requirements

- Raspberry Pi 4 (at least 4GB RAM recommended)
- Raspberry Pi OS (64-bit recommended)
- Docker and Docker Compose
- Internet connection
- Cloudflare account and registered domain

## Preparation

### 1. Install Docker and Docker Compose

```bash
# Install Docker
curl -sSL https://get.docker.com | sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install -y docker-compose

# Add current user to docker group
sudo usermod -aG docker $USER
```

Log out and log back in for the group changes to take effect.

### 2. Install Cloudflared

```bash
# Download Cloudflared for ARM64
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb

# Install
sudo dpkg -i cloudflared.deb

# Clean up
rm cloudflared.deb
```

### 3. Set up Cloudflare Tunnel

1. Log in to your Cloudflare account:

```bash
cloudflared tunnel login
```

2. Create a new tunnel:

```bash
cloudflared tunnel create north-sea-watch-rpi
```

3. Copy the generated credentials file to the project directory:

```bash
mkdir -p cloudflared
cp ~/.cloudflared/*.json cloudflared/credentials.json
```

4. Edit the `cloudflared/config.yml` file and update the `tunnel` value with your newly created tunnel ID.

```bash
sudo mkdir -p /etc/cloudflared
sudo cp ~/Desktop/repo/north-sea-watch/cloudflared/config.yml /etc/cloudflared/
sudo cp ~/Desktop/repo/north-sea-watch/cloudflared/credentials.json /etc/cloudflared/
sudo chmod 644 /etc/cloudflared/config.yml
sudo chmod 600 /etc/cloudflared/credentials.json
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
sudo systemctl status cloudflared
```

5. In the Cloudflare DNS dashboard, add the following CNAME records for your domain:

   - `aoyamaxx.com` -> `<tunnel-id>.cfargotunnel.com`
   - `www.aoyamaxx.com` -> `<tunnel-id>.cfargotunnel.com`
   - `api.aoyamaxx.com` -> `<tunnel-id>.cfargotunnel.com`

## Deploying the Application

### Using the One-Click Deployment Script

We provide a one-click deployment script that automatically completes all deployment steps:

```bash
chmod +x deploy-rpi.sh
./deploy-rpi.sh
```

### Manual Deployment

If you prefer to deploy manually, follow these steps:

1. Deploy the backend:

```bash
cd backend
docker-compose -f docker-compose.rpi.yml down
docker-compose -f docker-compose.rpi.yml build
docker-compose -f docker-compose.rpi.yml up -d
cd ..
```

2. Deploy the frontend:

```bash
cd frontend
docker-compose -f docker-compose.rpi.yml down
docker-compose -f docker-compose.rpi.yml build
docker-compose -f docker-compose.rpi.yml up -d
cd ..
```

3. Start the Cloudflare tunnel:

```bash
sudo cloudflared service install
sudo systemctl restart cloudflared
```

## Verifying the Deployment

After deployment, you can verify it by:

1. Checking Docker container status:

```bash
docker ps
```

2. Checking Cloudflared service status:

```bash
sudo systemctl status cloudflared
```

3. Accessing your domain in a browser:
   - Frontend: `https://aoyamaxx.com` or `https://www.aoyamaxx.com`
   - Backend API: `https://api.aoyamaxx.com`

## Troubleshooting

### Containers Won't Start

Check Docker logs:

```bash
docker logs backend-rpi
docker logs frontend-rpi
```

### Cloudflare Tunnel Issues

Check Cloudflared logs:

```bash
sudo journalctl -u cloudflared
```

### Database Connection Issues

Ensure the database container is running:

```bash
docker ps | grep postgres-rpi
```

## Maintenance

### Updating the Application

To update the application, pull the latest code and rerun the deployment script:
To update, pull new repo first:

```bash
git pull
./deploy-rpi.sh
```