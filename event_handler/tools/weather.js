/**
 * Weather utility - fetches weather from Open-Meteo (free, no API key needed)
 * and optionally sends to Telegram
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sendMessage, escapeHtml } = require('./telegram');

// Config from environment with defaults (New York City)
const WEATHER_LAT = process.env.WEATHER_LAT || '40.7128';
const WEATHER_LON = process.env.WEATHER_LON || '-74.0060';
const WEATHER_LOCATION_NAME = process.env.WEATHER_LOCATION_NAME || 'New York';
const WEATHER_UNITS = process.env.WEATHER_UNITS || 'fahrenheit'; // 'celsius' or 'fahrenheit'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch weather data with retries
 * @returns {Promise<Object>} Weather data
 */
async function fetchWeather(retries = MAX_RETRIES) {
  const tempUnit = WEATHER_UNITS === 'celsius' ? 'celsius' : 'fahrenheit';
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', WEATHER_LAT);
  url.searchParams.set('longitude', WEATHER_LON);
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m');
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code');
  url.searchParams.set('temperature_unit', tempUnit);
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '1');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (err) {
      console.error(`Weather fetch attempt ${attempt}/${retries} failed:`, err.message);
      
      if (attempt < retries) {
        console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      } else {
        throw new Error(`Failed to fetch weather after ${retries} attempts: ${err.message}`);
      }
    }
  }
}

/**
 * Convert WMO weather code to emoji and description
 * https://open-meteo.com/en/docs (WMO Weather interpretation codes)
 */
function weatherCodeToEmoji(code) {
  const codes = {
    0: { emoji: '☀️', desc: 'Clear sky' },
    1: { emoji: '🌤️', desc: 'Mainly clear' },
    2: { emoji: '⛅', desc: 'Partly cloudy' },
    3: { emoji: '☁️', desc: 'Overcast' },
    45: { emoji: '🌫️', desc: 'Foggy' },
    48: { emoji: '🌫️', desc: 'Depositing rime fog' },
    51: { emoji: '🌧️', desc: 'Light drizzle' },
    53: { emoji: '🌧️', desc: 'Moderate drizzle' },
    55: { emoji: '🌧️', desc: 'Dense drizzle' },
    56: { emoji: '🌧️❄️', desc: 'Light freezing drizzle' },
    57: { emoji: '🌧️❄️', desc: 'Dense freezing drizzle' },
    61: { emoji: '🌧️', desc: 'Slight rain' },
    63: { emoji: '🌧️', desc: 'Moderate rain' },
    65: { emoji: '🌧️', desc: 'Heavy rain' },
    66: { emoji: '🌧️❄️', desc: 'Light freezing rain' },
    67: { emoji: '🌧️❄️', desc: 'Heavy freezing rain' },
    71: { emoji: '🌨️', desc: 'Slight snow' },
    73: { emoji: '🌨️', desc: 'Moderate snow' },
    75: { emoji: '❄️', desc: 'Heavy snow' },
    77: { emoji: '🌨️', desc: 'Snow grains' },
    80: { emoji: '🌦️', desc: 'Slight rain showers' },
    81: { emoji: '🌦️', desc: 'Moderate rain showers' },
    82: { emoji: '⛈️', desc: 'Violent rain showers' },
    85: { emoji: '🌨️', desc: 'Slight snow showers' },
    86: { emoji: '🌨️', desc: 'Heavy snow showers' },
    95: { emoji: '⛈️', desc: 'Thunderstorm' },
    96: { emoji: '⛈️', desc: 'Thunderstorm with slight hail' },
    99: { emoji: '⛈️', desc: 'Thunderstorm with heavy hail' },
  };
  return codes[code] || { emoji: '🌡️', desc: 'Unknown' };
}

/**
 * Format weather data into a message
 */
function formatWeatherMessage(data) {
  const current = data.current;
  const daily = data.daily;
  const units = data.current_units;
  
  const currentWeather = weatherCodeToEmoji(current.weather_code);
  const dailyWeather = weatherCodeToEmoji(daily.weather_code[0]);
  
  const tempSymbol = WEATHER_UNITS === 'celsius' ? '°C' : '°F';
  
  const lines = [
    `<b>🌍 Weather for ${escapeHtml(WEATHER_LOCATION_NAME)}</b>`,
    '',
    `<b>Current Conditions</b>`,
    `${currentWeather.emoji} ${currentWeather.desc}`,
    `🌡️ Temperature: ${current.temperature_2m}${tempSymbol}`,
    `🤔 Feels like: ${current.apparent_temperature}${tempSymbol}`,
    `💨 Wind: ${current.wind_speed_10m} mph`,
    `💧 Humidity: ${current.relative_humidity_2m}%`,
    '',
    `<b>Today's Forecast</b>`,
    `${dailyWeather.emoji} ${dailyWeather.desc}`,
    `⬆️ High: ${daily.temperature_2m_max[0]}${tempSymbol}`,
    `⬇️ Low: ${daily.temperature_2m_min[0]}${tempSymbol}`,
    `🌧️ Precipitation: ${daily.precipitation_probability_max[0]}%`,
  ];
  
  return lines.join('\n');
}

/**
 * Get weather and send to Telegram
 */
async function checkAndSendWeather() {
  console.log(`[WEATHER] Checking weather for ${WEATHER_LOCATION_NAME}...`);
  
  try {
    const data = await fetchWeather();
    const message = formatWeatherMessage(data);
    
    console.log('[WEATHER] Weather fetched successfully');
    
    // Send to Telegram if configured
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      await sendMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, message);
      console.log(`[WEATHER] Sent to Telegram chat ${TELEGRAM_CHAT_ID}`);
    } else {
      console.log('[WEATHER] Telegram not configured, printing to console:');
      // Strip HTML for console output
      console.log(message.replace(/<[^>]+>/g, ''));
    }
    
    return { success: true, message };
  } catch (err) {
    const errorMsg = `❌ <b>Weather Check Failed</b>\n\n${escapeHtml(err.message)}`;
    
    // Try to notify via Telegram even on error
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        await sendMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, errorMsg);
      } catch (telegramErr) {
        console.error('[WEATHER] Failed to send error notification:', telegramErr.message);
      }
    }
    
    throw err;
  }
}

// Run if executed directly
if (require.main === module) {
  checkAndSendWeather()
    .then(() => {
      console.log('[WEATHER] Complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[WEATHER] Failed:', err.message);
      process.exit(1);
    });
}

module.exports = {
  fetchWeather,
  formatWeatherMessage,
  checkAndSendWeather,
  weatherCodeToEmoji,
};
