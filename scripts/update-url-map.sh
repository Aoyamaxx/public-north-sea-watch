#!/bin/bash

# Script to update the URL map configuration to route all api.northseawatch.org traffic to the backend service
# This script should be run after any changes to the load balancer configuration

# Set variables
URL_MAP_NAME="northseawatch-url-map"
BACKEND_SERVICE="backend-backend-service"
FRONTEND_SERVICE="frontend-backend-service"

# Export the current URL map configuration to a temporary file
echo "Exporting current URL map configuration..."
gcloud compute url-maps export $URL_MAP_NAME --destination=url-map-config.yaml

# Update the configuration to route all api.northseawatch.org traffic to the backend service
echo "Updating URL map configuration..."
cat > url-map-config.yaml << EOF
kind: compute#urlMap
name: $URL_MAP_NAME
defaultService: https://www.googleapis.com/compute/v1/projects/north-sea-watch/global/backendServices/$FRONTEND_SERVICE
hostRules:
- hosts:
  - 'northseawatch.org'
  - 'www.northseawatch.org'
  pathMatcher: frontend-matcher
- hosts:
  - 'api.northseawatch.org'
  pathMatcher: backend-matcher
pathMatchers:
- defaultService: https://www.googleapis.com/compute/v1/projects/north-sea-watch/global/backendServices/$FRONTEND_SERVICE
  name: frontend-matcher
  pathRules: []
- defaultService: https://www.googleapis.com/compute/v1/projects/north-sea-watch/global/backendServices/$BACKEND_SERVICE
  name: backend-matcher
  pathRules: []
EOF

# Import the updated configuration
echo "Importing updated URL map configuration..."
gcloud compute url-maps import $URL_MAP_NAME --source=url-map-config.yaml

# Clean up
echo "Cleaning up temporary files..."
rm url-map-config.yaml

echo "URL map configuration updated successfully!"
echo "Now all traffic to api.northseawatch.org will be routed to the backend service." 