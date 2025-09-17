# Use the official Node.js Long-Term Support (LTS) slim runtime.
# This version is based on Debian but is smaller than the default 'lts' tag.
FROM node:lts-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

# Install FFmpeg using Debian's package manager (apt-get).
# Update the package list first, then install ffmpeg, and finally clean up.
RUN apt-get update && \
    apt-get install -y ffmpeg --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json to leverage Docker's layer caching.
COPY package*.json ./

# Install only the production dependencies to keep the image small.
RUN npm install --production

# Install PM2 globally to manage the application process.
RUN npm install pm2 -g

# Copy the rest of your application's source code into the container.
COPY . .

# Expose port 3000 to allow communication with the app from outside the container.
EXPOSE 3000

# Define the command that will be executed when the container starts.
CMD [ "pm2-runtime", "start", "index.js", "-i", "max", "--name", "jinglemax-app" ]