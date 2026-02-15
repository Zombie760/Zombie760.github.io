FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts

ENV NODE_PATH=/deps/node_modules

WORKDIR /app

EXPOSE 80
CMD ["npx", "next", "start", "-p", "80"]
