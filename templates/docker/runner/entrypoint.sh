#!/bin/bash
set -e

# Required environment variables
: "${REPO_URL:?REPO_URL is required}"
: "${ACCESS_TOKEN:?ACCESS_TOKEN is required}"

RUNNER_NAME="${RUNNER_NAME:-thepopebot-runner}"
LABELS="${LABELS:-self-hosted,thepopebot}"

# Generate a registration token from the PAT
REG_TOKEN=$(curl -s -X POST \
  -H "Authorization: token ${ACCESS_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  "${REPO_URL/github.com/api.github.com/repos}/actions/runners/registration-token" \
  | jq -r '.token')

if [ "$REG_TOKEN" = "null" ] || [ -z "$REG_TOKEN" ]; then
  echo "Failed to get registration token. Check ACCESS_TOKEN permissions."
  exit 1
fi

# Configure the runner
./config.sh \
  --url "$REPO_URL" \
  --token "$REG_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$LABELS" \
  --unattended \
  --replace

# Deregister on shutdown
cleanup() {
  echo "Removing runner..."
  ./config.sh remove --token "$REG_TOKEN" 2>/dev/null || true
}
trap cleanup SIGTERM SIGINT

# Start the runner (blocks until stopped)
./run.sh &
wait $!
