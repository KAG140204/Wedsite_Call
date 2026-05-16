FROM node:20-alpine

WORKDIR /app

# Install Wrangler globally
RUN npm install -g wrangler@3.114.17

# Copy package.json if it exists (for dependencies)
COPY package*.json ./
RUN npm install || true

# Copy all files
COPY . .

# Expose the default Wrangler port
EXPOSE 8787

# Command to run wrangler dev inside the container
# --ip 0.0.0.0 is necessary for Docker port mapping to work
CMD ["wrangler", "dev", "src/index.js", "--ip", "0.0.0.0", "--port", "8787"]
