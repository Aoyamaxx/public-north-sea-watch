#!/bin/bash

# Script to manually test the ship_data cleanup management command

echo "Testing ship_data cleanup command..."

# Run with --dry-run to see what would be deleted without actually deleting anything
echo "Running in dry-run mode:"
python manage.py cleanup_ship_data --dry-run

# Ask for confirmation before running the actual cleanup
read -p "Do you want to run the actual cleanup? (y/N): " confirm
if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
    echo "Running actual cleanup with a batch size of 5000..."
    python manage.py cleanup_ship_data --batch-size=5000
else
    echo "Cleanup cancelled."
fi 