FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y curl python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && \
    npm install --no-save thepopebot@$(node -p "require('./package.json').version")

EXPOSE 80
CMD ["node_modules/.bin/next", "start", "-p", "80"]
