Set up a routine that runs every day at 5 AM to check the weather. This should include:

1. Create a scheduled job/cron that triggers at 5:00 AM daily
2. Implement weather checking functionality (likely using a weather API)
3. Configure where/how the weather information should be delivered (could be logged, sent to Telegram, etc.)
4. Handle error cases and retries if the weather service is unavailable
5. Make it configurable for location if needed

The user wants an automated daily weather check at 5 AM, so this needs to be a persistent scheduled task that runs autonomously.