FROM node:20-slim

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create Python venv and install dependencies
COPY requirements.txt .
RUN python3 -m venv /app/.venv && \
    /app/.venv/bin/pip install --no-cache-dir -r requirements.txt

# Install Node.js dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy application code
COPY . .

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 3000

# Set Python path so child_process can find it
ENV PATH="/app/.venv/bin:$PATH"

CMD ["npm", "start"]
