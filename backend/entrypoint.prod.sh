#!/bin/sh

# Print environment information for debugging
echo "Starting backend service in Cloud Run environment"
echo "DATABASE_URL: $DATABASE_URL"
echo "CLOUD_SQL_CONNECTION_NAME: $CLOUD_SQL_CONNECTION_NAME"
echo "DJANGO_SETTINGS_MODULE: $DJANGO_SETTINGS_MODULE"
echo "DB_HOST: $DB_HOST"
echo "DB_PORT: $DB_PORT"
echo "ALLOWED_HOSTS: $ALLOWED_HOSTS"
echo "PYTHONPATH: $PYTHONPATH"
echo "Current directory: $(pwd)"

# Start cron service in background (needs to be started by root)
if [ -f "/etc/cron.d/cleanup-cron" ]; then
  echo "Starting cron service..."
  # Try to start cron service
  service cron start || echo "Failed to start cron service directly, may need to run container with --privileged flag"
fi

# List directories to debug Python path issues
echo "Current directory structure:"
ls -la
echo "Apps directory structure:"
ls -la apps/

# Check database connection
echo "Checking database connection..."
python -c "
import psycopg2
import os
import time
import sys

print(f'Python path: {sys.path}')

# Try to connect to the database
max_attempts = 5
attempt = 0

while attempt < max_attempts:
    attempt += 1
    try:
        cloud_sql_connection_name = os.environ.get('CLOUD_SQL_CONNECTION_NAME')
        db_user = os.environ.get('DB_USER', 'aoyamaxx')
        db_password = os.environ.get('DB_PASSWORD', 'aoyamaxx')
        db_name = 'backend'
        
        if os.path.exists('/cloudsql'):
            conn_string = f'postgresql://{db_user}:{db_password}@localhost/{db_name}?host=/cloudsql/{cloud_sql_connection_name}'
            print(f'Connecting using Cloud SQL Unix socket: {conn_string}')
        else:
            conn_string = f'postgresql://{db_user}:{db_password}@cloudsql-proxy:5432/{db_name}'
            print(f'Connecting using TCP: {conn_string}')
            
        conn = psycopg2.connect(conn_string)
        print(f'Successfully connected to database on attempt {attempt}')
        conn.close()
        break
    except Exception as e:
        print(f'Database connection attempt {attempt} failed: {e}')
        if attempt < max_attempts:
            print('Retrying in 5 seconds...')
            time.sleep(5)
        else:
            print('Max attempts reached. Continuing anyway...')
"

# Run migrations
echo "Running database migrations..."
python manage.py migrate || echo "Migrations failed, but continuing..."

# Collect static files with more verbosity
echo "Collecting static files..."
python manage.py collectstatic --noinput --verbosity 2 || { echo "Static files collection failed"; exit 1; }

# List static files for debugging
echo "Static files directory content:"
ls -la /app/staticfiles/
echo "Admin static files:"
ls -la /app/staticfiles/admin/ || echo "Admin static files not found"

# Check if admin static files exist
if [ ! -d "/app/staticfiles/admin" ]; then
    echo "Admin static files not found. Trying to copy from Django package..."
    # Find Django admin static files
    DJANGO_PATH=$(python -c "import django; print(django.__path__[0])")
    echo "Django path: $DJANGO_PATH"
    
    # Create admin directory if it doesn't exist
    mkdir -p /app/staticfiles/admin
    
    # Copy admin static files
    if [ -d "$DJANGO_PATH/contrib/admin/static/admin" ]; then
        echo "Copying admin static files from Django package..."
        cp -r $DJANGO_PATH/contrib/admin/static/admin/* /app/staticfiles/admin/
        echo "Admin static files copied successfully."
    else
        echo "Could not find Django admin static files."
    fi
fi

# Start production server
PORT="${PORT:-8000}"
echo "Starting server on port $PORT"

# Try different server options
echo "Starting with gunicorn..."
exec gunicorn apps.config.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 --log-level debug
# Below is the original command without multiprocessing
# exec gunicorn apps.config.wsgi:application --bind 0.0.0.0:$PORT --log-level debug