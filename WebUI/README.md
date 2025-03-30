# Crime Analytics App Docker Setup

This README provides instructions for setting up the Crime Analytics application using Docker containers.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Project Structure

```
WebUI/
├── crime_app/            # React frontend
├── backend.py            # Flask backend
├── model_service.py      # ML model service
├── requirements.txt      # Python dependencies
├── .env                  # Environment variables
├── docker-compose.yml    # Docker Compose configuration
├── Dockerfile.backend    # Backend Dockerfile
└── db-init/              # Database initialization scripts
```

## Setup Instructions

### 1. Database Backup for Initialization

To initialize the PostgreSQL database with existing data:

1. Create a `db-init` directory:
   ```
   mkdir -p WebUI/db-init
   ```

2. Add your SQL dump file to this directory. The file should have a `.sql` extension:
   ```
   cp your_backup_file.sql WebUI/db-init/01-init.sql
   ```

   Note: The files in this directory will be executed in alphabetical order.

### 2. ML Model File

Ensure your pre-trained model file is placed in the root directory:

```
cp crime_category_prediction_model.pkl WebUI/
```

### 3. Environment Configuration

Review the `.env` file to ensure all configurations are correct. Note that the Docker Compose file overrides some settings to use the containerized database.

### 4. Building and Running the Containers

From the `WebUI` directory, run:

```
docker-compose up -d
```

This will start all three services:
- Frontend (React) on port 80
- Backend (Flask) linked internally
- Database (PostgreSQL/PostGIS) on port 5432

### 5. Monitoring

Check if all containers are running properly:

```
docker-compose ps
```

View logs for any container:

```
docker-compose logs frontend
docker-compose logs backend
docker-compose logs db
```

### 6. Stopping the Application

To stop all containers:

```
docker-compose down
```

To stop and remove all data volumes:

```
docker-compose down -v
```

## Customization Options

### Custom Database Port

To change the exposed database port, modify the `ports` entry in the `docker-compose.yml` file:

```yaml
db:
  ports:
    - "YOUR_CUSTOM_PORT:5432"
```

### Custom Web Port

To change the web application port, modify the frontend's port mapping:

```yaml
frontend:
  ports:
    - "YOUR_CUSTOM_PORT:80"
```

### Database Credentials

For production, update database credentials in the docker-compose.yml file:

```yaml
db:
  environment:
    - POSTGRES_PASSWORD=your_secure_password
    - POSTGRES_USER=your_username
    
backend:
  environment:
    - DB_PASSWORD=your_secure_password
    - DB_USER=your_username
``` 