const { Client, GatewayIntentBits } = require("discord.js");

// Initialize Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Error handling for the client
client.on("error", (error) => {
  console.error("❌ Discord client error:", error);
});

client.on("warn", (warning) => {
  console.warn("⚠️ Discord client warning:", warning);
});

// Log when bot is ready
client.once("ready", () => {
  console.log(`Bot is ready and logged in as ${client.user.tag}`);
});

module.exports = { client };
