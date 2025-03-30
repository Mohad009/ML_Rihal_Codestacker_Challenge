#!/bin/bash
set -e

# PostgreSQL should create the database automatically via POSTGRES_DB env var
# This script is for restoring the dump

# Give PostgreSQL time to initialize
sleep 10

echo "Checking if data needs to be restored..."

# Check if crimes_data table exists and has data
if psql -U postgres -d crime_app -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='crimes_data'" | grep -q "0"; then
    echo "Database needs initialization. Restoring from dump..."
    pg_restore -U postgres -d crime_app /docker-entrypoint-initdb.d/crime_data.dump
    echo "Restore completed!"
else
    echo "Database already contains data, skipping restore."
fi