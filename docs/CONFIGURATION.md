# Configuration

## Environment Variables

All environment variables for the Event Handler (set in `.env` in your project root):

| Variable | Description | Required |
|----------|-------------|----------|
| `APP_URL` | Public URL for webhooks, Telegram, and Traefik hostname | Yes |
| `API_KEY` | Authentication key for `/api/create-job` and other protected endpoints | Yes |
| `GH_TOKEN` | GitHub PAT for creating branches/files | Yes |
| `GH_OWNER` | GitHub repository owner | Yes |
| `GH_REPO` | GitHub repository name | Yes |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather | For Telegram |
| `TELEGRAM_CHAT_ID` | Restricts bot to this chat only | For security |
| `TELEGRAM_WEBHOOK_SECRET` | Secret for webhook validation | No |
| `TELEGRAM_VERIFICATION` | Verification code for getting your chat ID | For Telegram setup |
| `GH_WEBHOOK_SECRET` | Secret for GitHub Actions webhook auth | For notifications |
| `LLM_PROVIDER` | LLM provider: `anthropic`, `openai`, or `google` (default: `anthropic`) | No |
| `LLM_MODEL` | LLM model name override (provider-specific default if unset) | No |
| `ANTHROPIC_API_KEY` | API key for Anthropic provider | For anthropic provider |
| `OPENAI_API_KEY` | API key for OpenAI provider / Whisper voice transcription | For openai provider or voice |
| `GOOGLE_API_KEY` | API key for Google provider | For google provider |
| `LETSENCRYPT_EMAIL` | Email for Let's Encrypt SSL (docker-compose only) | No |
| `EVENT_HANDLER_IMAGE_URL` | Custom event handler Docker image | No |
| `JOB_IMAGE_URL` | Custom job agent Docker image | No |

---

## GitHub Secrets

Set automatically by the setup wizard:

| Secret | Description | Required |
|--------|-------------|----------|
| `SECRETS` | Base64-encoded JSON with protected credentials | Yes |
| `LLM_SECRETS` | Base64-encoded JSON with LLM-accessible credentials | No |
| `GH_WEBHOOK_SECRET` | Random secret for webhook authentication | Yes |

---

## GitHub Repository Variables

Configure in **Settings → Secrets and variables → Actions → Variables**:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `APP_URL` | Public URL for the event handler (e.g., `https://mybot.example.com`) | Yes | — |
| `AUTO_MERGE` | Set to `false` to disable auto-merge of job PRs | No | Enabled |
| `ALLOWED_PATHS` | Comma-separated path prefixes for auto-merge | No | `/logs` |
| `JOB_IMAGE_URL` | Docker image path for job agent (e.g., `ghcr.io/myorg/mybot`) | No | `stephengpope/thepopebot:latest` |
| `EVENT_HANDLER_IMAGE_URL` | Docker image path for event handler | No | `stephengpope/thepopebot-event-handler:latest` |
| `RUNS_ON` | GitHub Actions runner label (e.g., `self-hosted`) | No | `ubuntu-latest` |
| `LLM_PROVIDER` | LLM provider (`anthropic`, `openai`, `google`) | No | `anthropic` |
| `LLM_MODEL` | LLM model name for the Pi agent | No | Provider default |

---

## Docker Compose Deployment

For self-hosted deployment on a VPS, use docker-compose:

```bash
docker compose up -d
```

This starts three services:
- **Traefik** — Reverse proxy with automatic SSL (Let's Encrypt if `LETSENCRYPT_EMAIL` is set)
- **Event Handler** — Next.js server with your config volume-mounted
- **Runner** — Self-hosted GitHub Actions runner

Set `RUNS_ON=self-hosted` as a GitHub repository variable to route workflows to your runner.

See the [Architecture docs](ARCHITECTURE.md) for more details.

---

## APP_URL Changes

If your public URL changes (e.g., after restarting ngrok), run:

```bash
npm run setup-telegram
```

This will update the APP_URL, re-register the Telegram webhook, and update the GitHub repository variable.

---

## Manual Telegram Setup (Production)

If you're deploying to a platform where you can't run the setup script (Vercel, Railway, etc.), configure Telegram manually:

1. **Set environment variables** in your platform's dashboard (see `.env.example` for reference):
   - `TELEGRAM_BOT_TOKEN` - Your bot token from @BotFather
   - `TELEGRAM_WEBHOOK_SECRET` - Generate with `openssl rand -hex 32`
   - `TELEGRAM_VERIFICATION` - A verification code like `verify-abc12345`

2. **Deploy and register the webhook:**
   ```bash
   curl -X POST https://your-app.vercel.app/api/telegram/register \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -d '{"bot_token": "YOUR_BOT_TOKEN", "webhook_url": "https://your-app.vercel.app/api/telegram/webhook"}'
   ```
   This registers your webhook with the secret from your env.

3. **Get your chat ID:**
   - Message your bot with your `TELEGRAM_VERIFICATION` code (e.g., `verify-abc12345`)
   - The bot will reply with your chat ID

4. **Set `TELEGRAM_CHAT_ID`:**
   - Add the chat ID to your environment variables
   - Redeploy

Now your bot only responds to your authorized chat.
