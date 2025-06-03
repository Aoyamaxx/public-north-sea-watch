#!/bin/bash
# chmod +x restore-services.sh

# Set color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== North Sea Watch Service Restore Script ===${NC}"

# Check and start Docker containers
echo -e "${YELLOW}Checking Docker container status...${NC}"
if ! docker ps | grep -q "frontend-rpi"; then
    echo -e "${RED}Frontend container not running, starting...${NC}"
    cd ~/Desktop/repo/north-sea-watch/frontend
    docker-compose -f docker-compose.rpi.yml up -d
fi

if ! docker ps | grep -q "backend-rpi"; then
    echo -e "${RED}Backend container not running, starting...${NC}"
    cd ~/Desktop/repo/north-sea-watch/backend
    docker-compose -f docker-compose.rpi.yml up -d
fi

# Check and start Cloudflared service
echo -e "${YELLOW}Checking Cloudflare Tunnel status...${NC}"
if ! systemctl is-active --quiet cloudflared; then
    echo -e "${RED}Cloudflare Tunnel not running, starting...${NC}"
    sudo systemctl start cloudflared
fi

# Show service status
echo -e "${GREEN}Service status:${NC}"
docker ps
sudo systemctl status cloudflared --no-pager

echo -e "${GREEN}Service restore check completed!${NC}"
