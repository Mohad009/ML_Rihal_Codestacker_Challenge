# Crime Map Web Application

This repository is a solution for the Machine Learning Codestacker Challenge. It consists of two main parts:

1. **Level 1 & 2**: This part contains data analysis and model training.
2. **WebUI**: This part includes an interactive geospatial map that displays crimes and a small program that extracts police reports and predicts the crime category.

Additionally, I have completed Part A of the bonus task, which involves dockerizing and containerizing the application for easy deployment. The `Dockerfile` and `docker-compose.yml` are located in the `WebUI` directory for both the backend and frontend.

## Technology Stack

- **Frontend**: Built with React
- **Backend**: Developed using Flask
- **Database**: Utilizes PostgreSQL with the PostGIS spatial extension

Here is how to run the application:

## Prerequisites

Before you begin, ensure you have the following installed on your device:

- **Docker**: You can download and install Docker from [docker.com](https://www.docker.com/).

## Getting Started

Follow these steps to set up and run the application:

### 1. Clone the Repository

First, clone the repository to your local machine using the following command:

```bash
git clone https://github.com/Mohad009/ML_Rihal_Codestacker_Challenge.git
```

### 2. Navigate to the Initialization Directory

Open a terminal and navigate to the `init_app` directory within the cloned repository:

```bash
cd ML_Rihal_Codestacker_Challenge/init_app
```

### 3. Run the Build Script

Depending on your operating system, run the appropriate script to build and start the Docker containers:

- **Windows**: Run the batch script
  ```cmd
  build.bat
  ```

- **Linux/MacOS**: Run the shell script
  ```bash
  bash build.sh
  ```

### 4. Wait for the Containers to Initialize

The download and build process may take some time, depending on your internet speed. Once the containers are built, wait a few minutes to allow the database to initialize properly.

### 5. Access the Application

After the initialization is complete, open your web browser and navigate to:

```
http://localhost:3000
```

You should now see the Crime Map web application interface.

Here's how you can update the troubleshooting section to include instructions for running the application locally if Docker does not work:

## Troubleshooting

- **Docker Not Running**: Ensure Docker is running on your device before executing the build scripts.
- **Database Initialization**: If the application does not load, wait a few more minutes for the database to initialize, then refresh your browser.
- **Running Locally Without Docker**: If Docker is not working, you can run the application locally by following these steps:

### Running Locally Without Docker

If you encounter issues with Docker, you can set up and run the application locally. Follow these steps:

1. **Install PostgreSQL**: 
   - Download and install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/).
   - Ensure you add PostgreSQL to your system's environment variables during installation.

2. **Set Up the Backend and Frontend**:
   - Open a terminal and navigate to the `WebUI` directory:
     ```bash
     cd ML_Rihal_Codestacker_Challenge/WebUI
     ```
   - Install the required Python packages:
     ```bash
     pip install -r requirements.txt
     ```

3. **Set Up the Frontend**:
   - Open another terminal and navigate to the `crime_app` directory:
     ```bash
     cd ML_Rihal_Codestacker_Challenge/WebUI/crime_app
     ```
   - Install the necessary Node.js packages:
     ```bash
     npm install
     ```

4. **Restore the Database**:
   - Open a third terminal and navigate to the `db-init` directory:
     ```bash
     cd ML_Rihal_Codestacker_Challenge/WebUI/db-init
     ```
   - Restore the database dump file:
     ```bash
     pg_restore -U postgres -d crime_app crime_data.dump
     ```
   - Ensure that PostgreSQL is running and that you have the correct database credentials.

5. **Run the Application**:
   - Start the backend server from the `WebUI` directory:
     ```bash
     python backend.py
     ```
   - Start the frontend server from the `crime_app` directory:
     ```bash
     npm start
     ```

6. **Access the Application**:
   - Open your web browser and navigate to:
     ```
     http://localhost:3000
     ```

## Incomplete Features

Please note that the integration of severity with the category prediction is currently incomplete. This feature is documented in the Jupyter notebook, but due to time constraints, it was not fully implemented or reviewed in the web application.

## Demo
This is a video showing how is the web app in case it did not work [demo](https://youtu.be/B6Ev5anNH10)
