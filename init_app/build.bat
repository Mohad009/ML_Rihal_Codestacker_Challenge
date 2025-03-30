@echo off
SET FRONTEND_IMAGE=mohad009/crime-map-frontend:latest
SET BACKEND_IMAGE=mohad009/crime-map-backend:latest
SET DB_IMAGE=mohad009/crime-map-db:latest

echo Pulling Docker images...

echo Pulling frontend image...
docker pull %FRONTEND_IMAGE%
IF %ERRORLEVEL% NEQ 0 (
    echo Error pulling frontend image. Exiting.
    exit /b 1
)

echo Pulling backend image...
docker pull %BACKEND_IMAGE%
IF %ERRORLEVEL% NEQ 0 (
    echo Error pulling backend image. Exiting.
    exit /b 1
)

echo Pulling database image...
docker pull %DB_IMAGE%
IF %ERRORLEVEL% NEQ 0 (
    echo Error pulling database image. Exiting.
    exit /b 1
)

echo Building Docker containers...
docker-compose up --build -d
IF %ERRORLEVEL% NEQ 0 (
    echo Error building Docker containers. Exiting.
    exit /b 1
)

echo Docker containers built and started successfully.

echo Running containers:
docker ps

goto :eof

REM Function to check if an image exists locally
:check_image_exists
docker images -q %1 >nul 2>&1
EXIT /B %ERRORLEVEL%