const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const { google } = require('googleapis');
const JSONStream = require('JSONStream');
const es = require('event-stream');
require('dotenv').config();


// Helper functions for error logging
function logError(message, error) {
  console.error(message, error.message);
  if (error.response) {
    console.error('Response data:', error.response.data);
  }
}

async function fetchAndSaveCatholicCalendarData(year) {
    for (let month = 1; month <= 12; month++) {
        const url = `https://www.imankatolik.or.id/kalender.php?b=${month}&t=${year}`;
        try {
            const response = await axios.get(url);
            const dom = new JSDOM(response.data);
            const content = dom.window.document.querySelector('.k_tbl').outerHTML;

            // Save the extracted HTML directly in the root directory
            const fileName = `${month}-${year}.html`;
            const filePath = path.join(__dirname, fileName);
            fs.writeFileSync(filePath, content);
            console.log(`Saved: ${fileName}`);
        } catch (error) {
            console.error(`Error fetching data for month ${month}:`, error);
        }
    }
}

// Function to run the data fetching one day before New Year, with file existence check
async function runIfOneDayBeforeNewYear() {
    const today = new Date();
    const month = today.getMonth() + 1; // getMonth() returns 0-11, so we add 1
    const day = today.getDate();

    if (month === 12 && day === 31) { // December 31st
        const nextYear = today.getFullYear() + 1;
        
        // Check if any of the next year's files already exist
        const filesExist = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].some(month => {
            const filePath = path.join(__dirname, `${month}-${nextYear}.html`);
            return fs.existsSync(filePath);
        });

        if (!filesExist) {
            console.log(`Fetching calendar data for year ${nextYear} as it's one day before New Year and files do not exist.`);
            await fetchAndSaveCatholicCalendarData(nextYear);
        } else {
            console.log(`Files for year ${nextYear} already exist, skipping fetch.`);
        }
    } else {
        console.log("It's not one day before New Year, skipping calendar data fetch.");
    }
}

// Main execution
(async () => {
  // Check if year argument is provided for Catholic calendar data
  console.log("FETCH CATHOLIC CALENDAR");
  await runIfOneDayBeforeNewYear();

  // Always fetch YouTube playlists data
  // await fetchPlaylistsData();
})();
