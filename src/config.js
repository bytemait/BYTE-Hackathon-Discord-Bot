require('dotenv').config();

module.exports = {
    discord: {
        token: process.env.DISCORD_TOKEN,
        channelId: process.env.DISCORD_CHANNEL_ID
    },
    sheets: {
        sheetId: process.env.GOOGLE_SHEET_ID,
        serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        privateKey: process.env.GOOGLE_PRIVATE_KEY
    },
    updateInterval: parseInt(process.env.UPDATE_INTERVAL) || 30000,
    UPDATE_INTERVAL: 10 * 1000, // 10 seconds
    MAX_RETRIES: 3,
    MIN_REQUEST_INTERVAL: 2000,
    INITIAL_BACKOFF: 1000,
    MAX_BACKOFF: 30000
};
