const { TelegramAdapter } = require('./telegram');

let _telegramAdapter = null;

/**
 * Get the Telegram channel adapter (lazy singleton).
 * @param {string} botToken - Telegram bot token
 * @returns {TelegramAdapter}
 */
function getTelegramAdapter(botToken) {
  if (!_telegramAdapter || _telegramAdapter.botToken !== botToken) {
    _telegramAdapter = new TelegramAdapter(botToken);
  }
  return _telegramAdapter;
}

module.exports = { getTelegramAdapter };
