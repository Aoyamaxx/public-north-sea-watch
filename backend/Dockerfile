# Common build stage
FROM python:3.11-slim AS build

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app:/app/apps

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    netcat-openbsd \
    dos2unix \
    cron \
    sudo \
    # Dependencies for Pillow
    libjpeg-dev \
    zlib1g-dev \
    libfreetype6-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user with proper home directory
RUN addgroup --system appgroup && \
    adduser --system --home /home/appuser --ingroup appgroup appuser && \
    mkdir -p /app && \
    chown -R appuser:appgroup /app && \
    # Add appuser to sudoers
    echo "appuser ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/appuser && \
    chmod 0440 /etc/sudoers.d/appuser

# Development stage
FROM build AS development
WORKDIR /app
# Temporarily switch to root for cron setup
USER root

# Copy requirements and install dependencies
COPY --chown=appuser:appgroup apps/north_sea_watch/requirements/ /app/requirements/

# Install dependencies as root to avoid permission issues
RUN pip install --no-cache-dir -r requirements/development.txt && \
    pip install --no-cache-dir django-ckeditor==6.7.1 && \
    pip install --no-cache-dir pillow==10.2.0 && \
    pip install --no-cache-dir python-dateutil==2.8.2 && \
    pip install --no-cache-dir watchdog[watchmedo] && \
    # Create symlink to make watchmedo available in PATH
    ln -sf /usr/local/bin/watchmedo /usr/bin/watchmedo

# Create static file directories
RUN mkdir -p /app/static /app/staticfiles && \
    mkdir -p /app/apps/static && \
    chown -R appuser:appgroup /app/static /app/staticfiles /app/apps/static

# Setup cron job
COPY crontab /etc/cron.d/cleanup-cron
RUN chmod 0644 /etc/cron.d/cleanup-cron && \
    # Create the log file to be able to run tail
    touch /var/log/cron.log && \
    # Apply cron job
    crontab /etc/cron.d/cleanup-cron && \
    # Give permissions to appuser
    chown appuser:appgroup /var/log/cron.log

# Copy entrypoint
COPY --chown=appuser:appgroup entrypoint.sh /app/
RUN chmod +x /app/entrypoint.sh

# Switch back to appuser
USER appuser
ENV PATH="/home/appuser/.local/bin:/usr/local/bin:$PATH"
ENV HOME="/home/appuser"

CMD ["/bin/sh", "/app/entrypoint.sh"]

# Production stage
FROM build AS production
WORKDIR /app
# Temporarily switch to root for cron setup
USER root

# Copy requirements and install dependencies
COPY --chown=appuser:appgroup apps/north_sea_watch/requirements/ /app/requirements/

# Install dependencies as root to avoid permission issues
RUN pip install --no-cache-dir -r requirements/production.txt && \
    pip install --no-cache-dir django-ckeditor==6.7.1 && \
    pip install --no-cache-dir pillow==10.2.0 && \
    pip install --no-cache-dir python-dateutil==2.8.2

# Copy application
COPY --chown=appuser:appgroup apps/ /app/apps/
COPY --chown=appuser:appgroup manage.py /app/

# Setup cron job
COPY crontab /etc/cron.d/cleanup-cron
RUN chmod 0644 /etc/cron.d/cleanup-cron && \
    # Create the log file to be able to run tail
    touch /var/log/cron.log && \
    # Apply cron job
    crontab /etc/cron.d/cleanup-cron && \
    # Give permissions to appuser
    chown appuser:appgroup /var/log/cron.log

# Copy and set entrypoint
COPY --chown=appuser:appgroup entrypoint.prod.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Convert all text files to Unix line endings
RUN find /app -type f -name "*.py" -o -name "*.sh" | xargs dos2unix

# Create static file directories
RUN mkdir -p /app/static /app/staticfiles && \
    mkdir -p /app/apps/static && \
    chown -R appuser:appgroup /app/static /app/staticfiles /app/apps/static

# Print debug information
RUN echo "Directory structure:" && ls -la /app && echo "Apps directory:" && ls -la /app/apps

# Switch back to appuser
USER appuser
ENV PATH="/home/appuser/.local/bin:/usr/local/bin:$PATH"
ENV HOME="/home/appuser"

CMD ["/bin/sh", "/app/entrypoint.sh"]
