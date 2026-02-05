FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
    git \
    jq \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @mariozechner/pi-coding-agent

# Create Pi config directory and install env-sanitizer extension
RUN mkdir -p /root/.pi/agent/extensions
COPY .pi/extensions/env-sanitizer/ /root/.pi/agent/extensions/env-sanitizer/
RUN cd /root/.pi/agent/extensions/env-sanitizer && npm install --production

# Copy package files and install deps
COPY package*.json ./
RUN npm install
RUN npx playwright install-deps chromium
RUN npx playwright install chromium

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /job

ENTRYPOINT ["/entrypoint.sh"]
