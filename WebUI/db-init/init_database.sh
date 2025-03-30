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

# Check if dump file exists
if [ ! -f /docker-entrypoint-initdb.d/crime_data.dump ]; then
    echo "ERROR: Dump file not found at /docker-entrypoint-initdb.d/crime_data.dump"
    echo "Available files in directory:"
    ls -la /docker-entrypoint-initdb.d/
    exit 1
fi

# Check if crimes_data table exists
if ! psql -U postgres -d crime_app -c "SELECT 1 FROM information_schema.tables WHERE table_name='crimes_data'" | grep -q "1"; then
    echo "Database needs initialization. Restoring from dump..."
    echo "Using dump file: /docker-entrypoint-initdb.d/crime_data.dump"
    
    # Make sure the dump file has the correct permissions
    chmod 644 /docker-entrypoint-initdb.d/crime_data.dump
    
    # Run pg_restore with verbose output
    pg_restore -v -U postgres -d crime_app /docker-entrypoint-initdb.d/crime_data.dump
    
    # Check the result of the restore operation
    if [ $? -eq 0 ]; then
        echo "Restore completed successfully!"
    else
        echo "Restore encountered errors but continued."
    fi
    
    # Verify if the table was created
    if psql -U postgres -d crime_app -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='crimes_data'" | grep -q "1"; then
        echo "Table crimes_data was created successfully."
    else
        echo "WARNING: Table crimes_data was not created. Attempting to create it from init.sql..."
        psql -U postgres -d crime_app -f /docker-entrypoint-initdb.d/init.sql
    fi
else
    echo "Database already contains data, skipping restore."
fi