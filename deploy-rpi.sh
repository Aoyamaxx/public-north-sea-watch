#!/bin/bash

# Set color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== North Sea Watch Raspberry Pi Deployment Script ===${NC}"
echo -e "${YELLOW}This script will deploy the North Sea Watch application on a Raspberry Pi${NC}"

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker or Docker Compose is not installed${NC}"
    echo -e "${YELLOW}Please install Docker and Docker Compose first:${NC}"
    echo "curl -sSL https://get.docker.com | sh"
    echo "sudo apt-get install -y docker-compose"
    exit 1
fi

# Check if Cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo -e "${YELLOW}Cloudflared is not installed, installing...${NC}"
    # Install Cloudflared for Raspberry Pi
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
fi

# Create necessary directories
mkdir -p cloudflared

# Check if Cloudflare credentials file exists
if [ ! -f "cloudflared/credentials.json" ]; then
    echo -e "${YELLOW}Cloudflare credentials file does not exist${NC}"
    echo -e "${YELLOW}Please login to Cloudflare and get credentials:${NC}"
    echo "cloudflared tunnel login"
    echo -e "${YELLOW}Then create a new tunnel:${NC}"
    echo "cloudflared tunnel create north-sea-watch-rpi"
    echo -e "${YELLOW}Copy the generated credentials file to cloudflared/credentials.json${NC}"
    echo -e "${YELLOW}And update the tunnel ID in cloudflared/config.yml${NC}"
    exit 1
fi

# Deploy backend
echo -e "${GREEN}Deploying backend...${NC}"
cd backend
docker-compose -f docker-compose.rpi.yml down
docker image prune -a
docker-compose -f docker-compose.rpi.yml build --no-cache
docker-compose -f docker-compose.rpi.yml up -d
cd ..

# Deploy frontend
echo -e "${GREEN}Deploying frontend...${NC}"
cd frontend
docker-compose -f docker-compose.rpi.yml down
docker image prune -a
docker-compose -f docker-compose.rpi.yml build --no-cache
docker-compose -f docker-compose.rpi.yml up -d
cd ..

# Start Cloudflare tunnel
echo -e "${GREEN}Starting Cloudflare tunnel...${NC}"
sudo cloudflared service install
sudo systemctl restart cloudflared

echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}Application is now accessible at the following addresses:${NC}"
echo -e "${YELLOW}Frontend: https://aoyamaxx.com or https://www.aoyamaxx.com${NC}"
echo -e "${YELLOW}Backend API: https://api.aoyamaxx.com${NC}"

# Show container status
echo -e "${GREEN}Container status:${NC}"
docker ps

# Show Cloudflared status
echo -e "${GREEN}Cloudflared status:${NC}"
sudo systemctl status cloudflared --no-pager 