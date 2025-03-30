#!/bin/bash

# Define the Docker images
FRONTEND_IMAGE="mohad009/crime-map-frontend:latest"
BACKEND_IMAGE="mohad009/crime-map-backend:latest"
DB_IMAGE="mohad009/crime-map-db:latest"

# Pull the images from Docker Hub
echo "Pulling Docker images..."
echo "Pulling frontend image..."
docker pull $FRONTEND_IMAGE
if [ $? -ne 0 ]; then
    echo "Error pulling frontend image. Exiting."
    exit 1
fi

echo "Pulling backend image..."
docker pull $BACKEND_IMAGE
if [ $? -ne 0 ]; then
    echo "Error pulling backend image. Exiting."
    exit 1
fi

echo "Pulling database image..."
docker pull $DB_IMAGE
if [ $? -ne 0 ]; then
    echo "Error pulling database image. Exiting."
    exit 1
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

# Display running containers
echo "Running containers:"
docker ps