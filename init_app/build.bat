@echo off
SET FRONTEND_IMAGE=mohad009/crime-map-frontend:latest
SET BACKEND_IMAGE=mohad009/crime-map-backend:latest
SET DB_IMAGE=mohad009/crime-map-db:latest

REM Function to check if an image exists locally
:check_image_exists
docker images -q %1 >nul 2>&1
EXIT /B %ERRORLEVEL%

echo Checking Docker images...

REM Check and pull frontend image
call :check_image_exists %FRONTEND_IMAGE%
IF ERRORLEVEL 1 (
    echo Frontend image not found. Pulling from Docker Hub...
    docker pull %FRONTEND_IMAGE%
    IF ERRORLEVEL 1 (
        echo Error pulling frontend image. Exiting.
        exit /b 1
    )
) ELSE (
    echo Frontend image already exists.
)

REM Check and pull backend image
call :check_image_exists %BACKEND_IMAGE%
IF ERRORLEVEL 1 (
    echo Backend image not found. Pulling from Docker Hub...
    docker pull %BACKEND_IMAGE%
    IF ERRORLEVEL 1 (
        echo Error pulling backend image. Exiting.
        exit /b 1
    )
) ELSE (
    echo Backend image already exists.
)

REM Check and pull database image
call :check_image_exists %DB_IMAGE%
IF ERRORLEVEL 1 (
    echo Database image not found. Pulling from Docker Hub...
    docker pull %DB_IMAGE%
    IF ERRORLEVEL 1 (
        echo Error pulling database image. Exiting.
        exit /b 1
    )
) ELSE (
    echo Database image already exists.
)

echo Building Docker containers...
docker-compose up --build -d
IF ERRORLEVEL 1 (
    echo Error building Docker containers. Exiting.
    exit /b 1
)

echo Docker containers built and started successfully.

echo Running containers:
docker ps