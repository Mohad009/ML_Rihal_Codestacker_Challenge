FROM node:alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy app source
COPY . .

# Build the app for production
RUN npm run build



# Expose port 3000
EXPOSE 3000

# Start the app
CMD ["npm", "start"] 