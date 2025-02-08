const { GoogleSpreadsheet } = require('google-spreadsheet');
const { EmbedBuilder } = require('discord.js');

class SpreadsheetManager {
    constructor() {
        this.sheetId = process.env.GOOGLE_SHEET_ID;
        this.doc = null;
        this.lastProcessedRow = -1;  // Always start from the beginning
        this.lastRequestTime = 0;
        this.minRequestInterval = 2000; // Minimum 2 seconds between requests
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async waitForQuota() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            await this.sleep(this.minRequestInterval - timeSinceLastRequest);
        }
        this.lastRequestTime = Date.now();
    }

    async retryWithBackoff(operation, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.waitForQuota();
                return await operation();
            } catch (error) {
                if (error.response?.status === 429) {
                    const backoffTime = Math.pow(2, attempt) * 1000;
                    console.log(`⏳ Rate limited, waiting ${backoffTime}ms before retry ${attempt}/${maxRetries}`);
                    await this.sleep(backoffTime);
                    continue;
                }
                throw error;
            }
        }
        throw new Error(`Failed after ${maxRetries} retries`);
    }

    async initialize() {
        try {
            this.doc = new GoogleSpreadsheet(this.sheetId);
            this.lastProcessedRow = -1;

            await this.retryWithBackoff(async () => {
                await this.doc.useServiceAccountAuth({
                    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
                });
            });

            await this.retryWithBackoff(async () => {
                await this.doc.loadInfo();
            });

            return true;
        } catch (error) {
            console.error('❌ Error initializing spreadsheet:', error);
            return false;
        }
    }

    async getNewRows() {
        try {
            const sheet = this.doc.sheetsByIndex[0];
            await this.retryWithBackoff(async () => {
                await sheet.loadCells();
            });
            
            // Find the actual last row with content, starting from row 1 (skip headers)
            let lastRowWithContent = -1;
            for (let row = 1; row < sheet.rowCount; row++) {
                const cell = sheet.getCell(row, 0);
                if (cell.value !== null && cell.value !== undefined && cell.value.toString().trim() !== '') {
                    lastRowWithContent = row;
                }
            }
            
            const newRows = [];
            let currentRow = this.lastProcessedRow + 1;
            
            while (currentRow <= lastRowWithContent) {
                const rowData = [];
                let hasData = false;
                
                // Get all columns for this row
                for (let col = 0; col < 7; col++) {
                    const cell = sheet.getCell(currentRow, col);
                    const value = cell.value || '';
                    rowData.push(value.toString().trim());
                    if (value !== null && value !== undefined && value.toString().trim() !== '') {
                        hasData = true;
                    }
                }
                
                // Validate the end date format
                const endDate = new Date(rowData[5]); // Assuming endDate is in the 6th column
                if (isNaN(endDate.getTime()) || endDate.getFullYear() < 1970) {
                    console.error('❌ Invalid date format for end date:', rowData[5]);
                    hasData = false; // If date is invalid, skip this row
                }
                
                // Only add rows that have actual data and haven't been processed before
                if (hasData && currentRow > this.lastProcessedRow) {
                    newRows.push(rowData);
                }
                
                currentRow++;
            }
            
            if (lastRowWithContent >= 0) {
                this.lastProcessedRow = lastRowWithContent; // Update to last processed row
            }
            
            return newRows;
        } catch (error) {
            console.error('❌ Error getting new rows:', error);
            return [];
        }
    }

    createEmbed(rowData) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📝 New Sheet Entry')
                .setTimestamp();

            // Add fields for each column with data
            rowData.forEach((value, index) => {
                if (value) {
                    if(index === 0) {
                        const date = new Date(value);
                        const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
                        embed.addFields({
                            name: `Column ${index + 1}`,
                            value: formattedDate,
                            inline: true
                        });
                    } else {
                        embed.addFields({
                            name: `Column ${index + 1}`,
                            value: value.toString(),
                            inline: true
                        });
                    }
                }
            });

            return embed;
        } catch (error) {
            console.error('❌ Error creating embed:', error);
            return null;
        }
    }
}

module.exports = { SpreadsheetManager };
