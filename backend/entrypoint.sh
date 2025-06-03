#!/bin/sh

echo "Waiting for Cloud SQL Proxy..."
while ! nc -z cloudsql-proxy 5432; do
  sleep 1
done
echo "Cloud SQL Proxy started"

# Start cron service in background (needs to be started by root)
if [ -f "/etc/cron.d/cleanup-cron" ]; then
  echo "Starting cron service..."
  # We're running as non-root in container, need to use sudo
  # Make sure this runs even if sudo fails (development mode may not have sudo)
  service cron start || echo "Failed to start cron service directly, trying with alternative methods..."
fi

# Run migrations
echo "Running migrations..."
python manage.py migrate

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Start development server
exec python manage.py runserver 0.0.0.0:8000