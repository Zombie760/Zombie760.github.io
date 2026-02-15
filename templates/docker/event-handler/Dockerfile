FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y curl python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

ENV NODE_PATH=/deps/node_modules

WORKDIR /app

EXPOSE 80
CMD ["sh", "-c", "cp -a /deps/node_modules/. /app/node_modules/ && exec node /app/node_modules/.bin/next start -p 80"]
