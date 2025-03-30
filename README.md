# Crime Map Web Application

This repository is a solution for the Machine Learning Codestacker Challenge. It consists of two main parts:

1. **Level 1 & 2**: This part contains data analysis and model training.
2. **WebUI **: This part includes an interactive geospatial map that displays crimes and a small program that extracts police reports and predicts the crime category.

Additionally, I have completed Part A of the bonus task, which involves dockerizing and containerizing the application for easy deployment.

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

## Troubleshooting

- **Docker Not Running**: Ensure Docker is running on your device before executing the build scripts.
- **Database Initialization**: If the application does not load, wait a few more minutes for the database to initialize, then refresh your browser.


## Incomplete Features

Please note that the integration of severity with the category prediction is currently incomplete. This feature is documented in the Jupyter notebook, but due to time constraints, it was not fully implemented or reviewed in the web application.
