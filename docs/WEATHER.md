# Daily Weather Check

A scheduled task that fetches weather data and sends it to Telegram at 5:00 AM daily.

## How It Works

1. **Schedule**: Runs every day at 5:00 AM (cron: `0 5 * * *`)
2. **Data Source**: Uses [Open-Meteo API](https://open-meteo.com/) - free, no API key required
3. **Delivery**: Sends formatted weather report to Telegram (if configured)
4. **Retry Logic**: Automatically retries up to 3 times if the weather service is unavailable

## Configuration

Add these to your `event_handler/.env` file:

### Required for Telegram Delivery

```bash
# Telegram bot token (from @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token

# Chat ID to send weather updates to
# Get this by messaging your bot and checking logs, or use @userinfobot
TELEGRAM_CHAT_ID=your_chat_id
```

### Location Settings (Optional)

```bash
# Coordinates - use https://www.latlong.net/ to find your location
WEATHER_LAT=40.7128      # Default: New York
WEATHER_LON=-74.0060

# Display name for the location
WEATHER_LOCATION_NAME=New York

# Temperature units: 'celsius' or 'fahrenheit'
WEATHER_UNITS=fahrenheit
```

## Example Output

```
🌍 Weather for New York

Current Conditions
🌤️ Mainly clear
🌡️ Temperature: 45°F
🤔 Feels like: 42°F
💨 Wind: 8.5 mph
💧 Humidity: 55%

Today's Forecast
☁️ Overcast
⬆️ High: 52°F
⬇️ Low: 38°F
🌧️ Precipitation: 20%
```

## Manual Testing

Run the weather check manually:

```bash
cd /path/to/project
node event_handler/tools/weather.js
```

If Telegram is not configured, it will print the weather to the console.

## Cron Entry

The job is defined in `operating_system/CRONS.json`:

```json
{
  "name": "daily-weather",
  "schedule": "0 5 * * *",
  "type": "command",
  "command": "node event_handler/tools/weather.js",
  "enabled": true
}
```

### Customizing the Schedule

The schedule uses standard cron syntax:

| Schedule | Meaning |
|----------|---------|
| `0 5 * * *` | Every day at 5:00 AM |
| `0 7 * * *` | Every day at 7:00 AM |
| `0 6,18 * * *` | Twice daily at 6 AM and 6 PM |
| `0 8 * * 1-5` | Weekdays at 8:00 AM |

## Disabling

Set `enabled: false` in CRONS.json to disable:

```json
{
  "name": "daily-weather",
  "schedule": "0 5 * * *",
  "type": "command",
  "command": "node event_handler/tools/weather.js",
  "enabled": false
}
```

## Error Handling

- Weather API failures trigger up to 3 retry attempts with 5-second delays
- If all retries fail, an error notification is sent to Telegram (if configured)
- Errors are also logged to the console for debugging

## Weather Codes

The script interprets WMO weather codes into emoji and descriptions:

| Code | Emoji | Description |
|------|-------|-------------|
| 0 | ☀️ | Clear sky |
| 1-3 | 🌤️⛅☁️ | Partly cloudy to overcast |
| 45-48 | 🌫️ | Fog |
| 51-57 | 🌧️ | Drizzle |
| 61-67 | 🌧️ | Rain |
| 71-77 | 🌨️❄️ | Snow |
| 80-82 | 🌦️⛈️ | Rain showers |
| 95-99 | ⛈️ | Thunderstorm |
