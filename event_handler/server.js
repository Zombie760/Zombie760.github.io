const express = require('express');
const helmet = require('helmet');
require('dotenv').config();

const { createJob } = require('./tools/create-job');
const { loadCrons } = require('./cron');
const { setWebhook, sendMessage } = require('./tools/telegram');

const app = express();

app.use(helmet());
app.use(express.json());

const { API_KEY, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_BOT_TOKEN } = process.env;

// Bot token from env, can be overridden by /telegram/register
let telegramBotToken = TELEGRAM_BOT_TOKEN || null;

// x-api-key auth middleware
const authMiddleware = (req, res, next) => {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// POST /webhook - create a new job
app.post('/webhook', authMiddleware, async (req, res) => {
  const { job } = req.body;
  if (!job) return res.status(400).json({ error: 'Missing job field' });

  try {
    const result = await createJob(job);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// POST /telegram/register - register a Telegram webhook
app.post('/telegram/register', authMiddleware, async (req, res) => {
  const { bot_token, webhook_url } = req.body;
  if (!bot_token || !webhook_url) {
    return res.status(400).json({ error: 'Missing bot_token or webhook_url' });
  }

  try {
    const result = await setWebhook(bot_token, webhook_url, TELEGRAM_WEBHOOK_SECRET);
    telegramBotToken = bot_token;
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register webhook' });
  }
});

// POST /telegram/webhook - receive Telegram updates
app.post('/telegram/webhook', async (req, res) => {
  // Validate secret token if configured
  if (TELEGRAM_WEBHOOK_SECRET) {
    const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (headerSecret !== TELEGRAM_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const update = req.body;
  const message = update.message || update.edited_message;

  if (message && message.chat && telegramBotToken) {
    try {
      await sendMessage(telegramBotToken, message.chat.id, 'got it!');
    } catch (err) {
      console.error('Failed to send Telegram message:', err);
    }
  }

  // Always return 200 to acknowledge receipt
  res.status(200).json({ ok: true });
});

// Error handler - don't leak stack traces
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
  loadCrons();
});
