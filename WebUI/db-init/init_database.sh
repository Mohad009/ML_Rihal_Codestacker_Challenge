#!/bin/bash
set -e

# PostgreSQL should create the database automatically via POSTGRES_DB env var
# This script is for restoring the dump

# Give PostgreSQL time to start accepting connections
echo "Waiting for PostgreSQL to start..."
until pg_isready -U postgres -h localhost; do
  echo "Waiting..."
  sleep 1
done

echo "Checking if data needs to be restored..."

# Check if crimes_data table exists
if ! psql -U postgres -d crime_app -c "SELECT 1 FROM information_schema.tables WHERE table_name='crimes_data'" | grep -q "1"; then
    echo "Database needs initialization. Restoring from dump..."
    pg_restore -U postgres -d crime_app /docker-entrypoint-initdb.d/crime_data.dump
    echo "Restore completed!"
else
    echo "Database already contains data, skipping restore."
fi