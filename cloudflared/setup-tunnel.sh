#!/bin/bash

# Set color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Cloudflare Tunnel Setting Script ===${NC}"
echo -e "${YELLOW}This script will help you set up Cloudflare Tunnel${NC}"

# Check if Cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}Error: Cloudflared is not installed${NC}"
    echo -e "${YELLOW}Please install Cloudflared first:${NC}"
    echo "curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb"
    echo "sudo dpkg -i cloudflared.deb"
    exit 1
fi

# Create necessary directories
mkdir -p cloudflared

# Login to Cloudflare
echo -e "${GREEN}Logging in to Cloudflare...${NC}"
echo -e "${YELLOW}Please complete the authorization process in your browser${NC}"
cloudflared tunnel login

# Create new tunnel
echo -e "${GREEN}Creating new tunnel...${NC}"
read -p "Please enter the tunnel name (default: north-sea-watch-rpi): " TUNNEL_NAME
TUNNEL_NAME=${TUNNEL_NAME:-north-sea-watch-rpi}

TUNNEL_ID=$(cloudflared tunnel create $TUNNEL_NAME | grep -oP 'Created tunnel \K[a-z0-9-]+')

if [ -z "$TUNNEL_ID" ]; then
    echo -e "${RED}Error: Failed to create tunnel${NC}"
    exit 1
fi

echo -e "${GREEN}Tunnel ID: $TUNNEL_ID${NC}"

# Copy credentials file
echo -e "${GREEN}Copying credentials file...${NC}"
cp ~/.cloudflared/${TUNNEL_ID}.json cloudflared/credentials.json

# Update config file
echo -e "${GREEN}Updating config file...${NC}"
sed -i "s/your-tunnel-id/$TUNNEL_ID/g" cloudflared/config.yml

# Install as system service
echo -e "${GREEN}Installing Cloudflared service...${NC}"
sudo cp cloudflared/config.yml /etc/cloudflared/config.yml
sudo cp cloudflared/credentials.json /etc/cloudflared/credentials.json
sudo cloudflared service install

# Display DNS configuration instructions
echo -e "${GREEN}Please add the following CNAME records in the Cloudflare DNS dashboard:${NC}"
echo -e "${YELLOW}aoyamaxx.com -> $TUNNEL_ID.cfargotunnel.com${NC}"
echo -e "${YELLOW}www.aoyamaxx.com -> $TUNNEL_ID.cfargotunnel.com${NC}"
echo -e "${YELLOW}api.aoyamaxx.com -> $TUNNEL_ID.cfargotunnel.com${NC}"

# Configure tunnel route
echo -e "${GREEN}Configuring tunnel route...${NC}"
cloudflared tunnel route dns $TUNNEL_ID aoyamaxx.com
cloudflared tunnel route dns $TUNNEL_ID www.aoyamaxx.com
cloudflared tunnel route dns $TUNNEL_ID api.aoyamaxx.com

echo -e "${GREEN}Cloudflare Tunnel setup complete!${NC}"
echo -e "${GREEN}You can use the following command to start the tunnel:${NC}"
echo -e "${YELLOW}sudo systemctl start cloudflared${NC}" 