require("dotenv").config();
const { client } = require("./src/discord/client");
const { SpreadsheetManager } = require("./src/sheets/spreadsheet");
const { UPDATE_INTERVAL } = require("./src/config");
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000; // Use the PORT environment variable or default to 3000

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

let checkingForUpdates = false;

// Create an instance of SpreadsheetManager
const sheetManager = new SpreadsheetManager();

// Format hackathon data
function formatHackathonData(row) {
    const [timestamp, email, name, link, type, endDate, otherInfo] = row;

    let formattedEndDate;

    if (!isNaN(endDate)) {
        // Convert Google Sheets serial number to JS Date
        formattedEndDate = new Date((endDate - 25569) * 86400000);
        formattedEndDate.setUTCHours(0, 0, 0, 0); // Ensure correct timezone handling
    } else {
        // Manually parse DD/MM/YYYY format if already in string form
        const dateParts = endDate.split('/');
        if (dateParts.length !== 3) {
            console.error('❌ Invalid date format for end date:', endDate);
            return `🎉 NEW HACKATHON ALERT! 🎉\n\n🏆 ${name}\n🌐 Register: ${link}\n🎯 Type: ${type}\n📅 Ends: Invalid Date`;
        }

        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-based
        const year = parseInt(dateParts[2], 10);

        formattedEndDate = new Date(year, month, day);
    }

    if (isNaN(formattedEndDate.getTime())) {
        console.error('❌ Invalid date after conversion:', endDate);
        return `🎉 NEW HACKATHON ALERT! 🎉\n\n🏆 ${name}\n🌐 Register: ${link}\n🎯 Type: ${type}\n📅 Ends: Invalid Date`;
    }

    // Format to DD/MM/YYYY
    const day = String(formattedEndDate.getDate()).padStart(2, '0');
    const month = String(formattedEndDate.getMonth() + 1).padStart(2, '0');
    const year = formattedEndDate.getFullYear();
    const endDateString = `${day}/${month}/${year}`;

    let message = `🎉 NEW HACKATHON ALERT! 🎉\n\n🏆 ${name}\n🌐 Register: ${link}\n🎯 Type: ${type}\n📅 Ends: ${endDateString}`;

    if (otherInfo && otherInfo.trim()) {
        message += `\n\n📌 Additional Information:\n${otherInfo}`;
    }

    return message; // Don't log here, just return the message
}



// Initialize bot and spreadsheet
async function initialize() {
    try {
        // Initialize Google Sheets with retries
        const success = await sheetManager.initialize();
        
        if (!success) {
            console.error('❌ Failed to initialize Google Sheets');
            return;
        }

        // Get the channel to send messages to
        const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
        if (!channel) {
            console.error('❌ Could not find Discord channel');
            return;
        }

        // Start checking for new rows periodically
        setInterval(async () => {
            try {
                if (checkingForUpdates) return;
                checkingForUpdates = true;
                
                const newRows = await sheetManager.getNewRows();
                if (newRows && newRows.length > 0) {
                    for (const row of newRows) {
                        const message = formatHackathonData(row);
                        // Send the message to Discord
                        await channel.send(message);
                    }
                }
                
                checkingForUpdates = false;
            } catch (error) {
                console.error('❌ Error checking for updates:', error);
                checkingForUpdates = false;
            }
        }, UPDATE_INTERVAL);
    } catch (error) {
        console.error('❌ Error during initialization:', error);
    }
}

// Login to Discord
client
  .login(process.env.DISCORD_TOKEN)
  .then(() => {
    initialize();
  })
  .catch((error) => {
    console.error("❌ Failed to login to Discord:", error);
  });

// Handle process errors
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception:", error);
});
