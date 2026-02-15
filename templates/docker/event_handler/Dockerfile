FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --omit=dev

COPY . .

RUN npm run build

EXPOSE 80

CMD ["npx", "next", "start", "-p", "80"]
