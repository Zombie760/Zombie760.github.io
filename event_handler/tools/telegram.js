const TELEGRAM_API = 'https://api.telegram.org';

/**
 * Set webhook for a Telegram bot
 * @param {string} botToken - Bot token from @BotFather
 * @param {string} webhookUrl - HTTPS URL to receive updates
 * @param {string} [secretToken] - Optional secret token for verification
 * @returns {Promise<object>} - Telegram API response
 */
async function setWebhook(botToken, webhookUrl, secretToken) {
  const body = { url: webhookUrl };
  if (secretToken) {
    body.secret_token = secretToken;
  }

  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }
  return data;
}

/**
 * Send a message to a Telegram chat
 * @param {string} botToken - Bot token from @BotFather
 * @param {number|string} chatId - Chat ID to send message to
 * @param {string} text - Message text
 * @returns {Promise<object>} - Telegram API response
 */
async function sendMessage(botToken, chatId, text) {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }
  return data;
}

module.exports = { setWebhook, sendMessage };
