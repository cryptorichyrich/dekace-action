const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const axios = require('axios');

async function fetchAndSaveData(year) {
    const basePath = path.join(__dirname, 'assets', 'data');

    // Ensure the directory exists
    if (!fs.existsSync(basePath)) {
        fs.mkdirSync(basePath, { recursive: true });
    }

    for (let month = 1; month <= 12; month++) {
        const url = `https://www.imankatolik.or.id/kalender.php?b=${month}&t=${year}`;
        try {
            const response = await axios.get(url);
            const dom = new JSDOM(response.data);
            const content = dom.window.document.querySelector('.k_tbl').outerHTML;

            // Save the extracted HTML
            const fileName = `${month}-${year}.html`;
            const filePath = path.join(basePath, fileName);
            fs.writeFileSync(filePath, content);
            console.log(`Saved: ${fileName}`);
        } catch (error) {
            console.error(`Error fetching data for month ${month}:`, error.message);
        }
    }
}

// Call the function with the year passed as an argument
const year = process.argv[2];  // Assuming the year is passed as a command-line argument

if (!year || isNaN(year)) {
    console.error('Please provide a valid year as an argument.');
    process.exit(1);
}

fetchAndSaveData(parseInt(year, 10));
