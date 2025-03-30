#!/bin/bash

# Define the Docker images
FRONTEND_IMAGE="mohad009/crime-map-frontend:latest"
BACKEND_IMAGE="mohad009/crime-map-backend:latest"
DB_IMAGE="mohad009/crime-map-db:latest"

# Function to check if an image exists locally
function image_exists {
    docker images -q "$1" > /dev/null 2>&1
}

# Pull the images from Docker Hub if they do not exist
echo "Checking Docker images..."
if ! image_exists $FRONTEND_IMAGE; then
    echo "Frontend image not found. Pulling from Docker Hub..."
    docker pull $FRONTEND_IMAGE
    if [ $? -ne 0 ]; then
        echo "Error pulling frontend image. Exiting."
        exit 1
    fi
else
    echo "Frontend image already exists."
fi

if ! image_exists $BACKEND_IMAGE; then
    echo "Backend image not found. Pulling from Docker Hub..."
    docker pull $BACKEND_IMAGE
    if [ $? -ne 0 ]; then
        echo "Error pulling backend image. Exiting."
        exit 1
    fi
else
    echo "Backend image already exists."
fi

if ! image_exists $DB_IMAGE; then
    echo "Database image not found. Pulling from Docker Hub..."
    docker pull $DB_IMAGE
    if [ $? -ne 0 ]; then
        echo "Error pulling database image. Exiting."
        exit 1
    fi
else
    echo "Database image already exists."
fi

# Build the Docker containers
echo "Building Docker containers..."
docker-compose up --build -d

# Check if the build was successful
if [ $? -eq 0 ]; then
    echo "Docker containers built and started successfully."
else
    echo "Error building Docker containers. Exiting."
    exit 1
fi

# Optional: Display running containers
echo "Running containers:"
docker ps