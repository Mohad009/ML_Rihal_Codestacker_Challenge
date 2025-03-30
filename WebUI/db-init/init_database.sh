#!/bin/bash
set -e

# PostgreSQL should create the database automatically via POSTGRES_DB env var
# This script is for restoring the dump

echo "Starting database initialization script..."

# Wait for PostgreSQL to be ready with timeout
MAX_RETRIES=30
count=0
echo "Waiting for PostgreSQL to start (timeout: ${MAX_RETRIES}s)..."

# Use localhost and postgres for default connection
until pg_isready -h localhost -U postgres || [ $count -eq $MAX_RETRIES ]; do
  echo "Waiting for PostgreSQL to start... Attempt: $((count+1))/$MAX_RETRIES"
  count=$((count+1))
  sleep 1
done

if [ $count -eq $MAX_RETRIES ]; then
  echo "Timed out waiting for PostgreSQL to start. Proceeding anyway..."
fi

echo "Checking if data needs to be restored..."

# Check if dump file exists
if [ ! -f /docker-entrypoint-initdb.d/crime_data.dump ]; then
    echo "ERROR: Dump file not found at /docker-entrypoint-initdb.d/crime_data.dump"
    echo "Available files in directory:"
    ls -la /docker-entrypoint-initdb.d/
    exit 1
fi

# Try connecting to the database
echo "Attempting to connect to database..."
if ! PGPASSWORD=1234 psql -h localhost -U postgres -d crime_app -c "SELECT 1" > /dev/null 2>&1; then
    echo "WARNING: Cannot connect to database. It may not be ready yet."
    echo "Proceeding with restore attempt anyway..."
fi

# Check if crimes_data table exists, with error handling
table_exists=0
if PGPASSWORD=1234 psql -h localhost -U postgres -d crime_app -c "SELECT 1 FROM information_schema.tables WHERE table_name='crimes_data'" 2>/dev/null | grep -q "1"; then
    table_exists=1
    echo "Table crimes_data already exists."
fi

if [ $table_exists -eq 0 ]; then
    echo "Database needs initialization. Restoring from dump..."
    echo "Using dump file: /docker-entrypoint-initdb.d/crime_data.dump"
    
    # Make sure the dump file has the correct permissions
    chmod 644 /docker-entrypoint-initdb.d/crime_data.dump
    
    # Run pg_restore with verbose output
    PGPASSWORD=1234 pg_restore -v -h localhost -U postgres -d crime_app /docker-entrypoint-initdb.d/crime_data.dump
    
    # Check the result of the restore operation
    restore_status=$?
    if [ $restore_status -eq 0 ]; then
        echo "Restore completed successfully!"
    else
        echo "Restore encountered errors (exit code: $restore_status) but continuing..."
    fi
    
    # Verify if the table was created
    if PGPASSWORD=1234 psql -h localhost -U postgres -d crime_app -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='crimes_data'" 2>/dev/null | grep -q "1"; then
        echo "Table crimes_data was created successfully."
    else
        echo "WARNING: Table crimes_data was not created. Attempting to create it from init.sql..."
        if [ -f /docker-entrypoint-initdb.d/init.sql ]; then
            PGPASSWORD=1234 psql -h localhost -U postgres -d crime_app -f /docker-entrypoint-initdb.d/init.sql
        else
            echo "ERROR: init.sql file not found."
        fi
    fi
else
    echo "Database already contains data, skipping restore."
fi

echo "Database initialization script completed."