# Common build stage
FROM node:20-alpine AS build

# Work directory
WORKDIR /app

# Add user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Copy package files
COPY --chown=appuser:appgroup package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the rest of the application
COPY --chown=appuser:appgroup . .

# Build the application for production
RUN yarn build

# Development stage
FROM node:20-alpine AS development
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser
COPY --chown=appuser:appgroup --from=build /app ./
CMD ["yarn", "start"]

# Production stage with Nginx
FROM nginx:alpine AS production
# Add nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
# Set up for Rendertron sidecar - this container will only handle the Nginx part
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Rendertron container - using proven configuration
FROM node:20-slim AS rendertron

# Install latest Chrome dev package and fonts
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils

# Download and install Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Setup Rendertron
WORKDIR /app

# Copy rendertron config
COPY rendertron-config.json /app/config.json

# Install Rendertron
RUN npm install -g rendertron@3.1.0

# Create a health check file for startup probe
RUN mkdir -p /usr/local/lib/node_modules/rendertron/src/ && \
    echo "Rendertron Health Check" > /usr/local/lib/node_modules/rendertron/src/index.html

# Set environment variable for Rendertron port
ENV PORT=3000

# Port exposed by the service
EXPOSE 3000

# Start Rendertron with debug logging
CMD ["rendertron", "--config", "/app/config.json"]
