// update-json.js
const fs = require('fs');
const path = require('path');

const paragraphs = [
    'The sun sets on the horizon, painting the sky in brilliant hues of orange and purple.',
    'In the depths of the forest, a gentle breeze rustles through the ancient trees.',
    'Waves crash against the rocky shore, their rhythmic sound echoing through the air.',
    'High in the mountains, snow-capped peaks pierce the clouds like ancient sentinels.',
    'The city comes alive at night, its lights twinkling like earthbound stars.'
];

const randomParagraph = paragraphs[Math.floor(Math.random() * paragraphs.length)];
const timestamp = new Date().toISOString();
const filePath = path.join('assets', 'data', 'youtube.json');

// Ensure the directory exists
const dir = path.dirname(filePath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

try {
    let existingContent = {};
    
    // Try to read existing content
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        existingContent = JSON.parse(fileContent);
        console.log("\nCurrent content of youtube.json:", JSON.stringify(existingContent, null, 2));
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
        console.log("youtube.json does not exist yet. Initializing...");
    }

    // Add new content
    existingContent[timestamp] = randomParagraph;

    // Write updated content
    fs.writeFileSync(filePath, JSON.stringify(existingContent, null, 2));
    console.log("\nUpdated content of youtube.json:", JSON.stringify(existingContent, null, 2));
} catch (error) {
    console.error("Error:", error);
    process.exit(1);
}
