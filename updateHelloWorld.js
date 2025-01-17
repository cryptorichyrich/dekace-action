const fs = require('fs');

const paragraphs = [
  'The sun sets on the horizon, painting the sky in brilliant hues of orange and purple.',
  'In the depths of the forest, a gentle breeze rustles through the ancient trees.',
  'Waves crash against the rocky shore, their rhythmic sound echoing through the air.',
  'High in the mountains, snow-capped peaks pierce the clouds like ancient sentinels.',
  'The city comes alive at night, its lights twinkling like earthbound stars.'
];

const randomParagraph = paragraphs[Math.floor(Math.random() * paragraphs.length)];
const timestamp = new Date().toISOString();

let existingContent = {};
try {
  existingContent = JSON.parse(fs.readFileSync('/asset/data/youtube.json', 'utf8'));
  console.log("\nCurrent content of youtube.json:");
  console.log(JSON.stringify(existingContent, null, 2));
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log("youtube.json does not exist yet. Initializing...");
    existingContent = {
      "initialContent": "Hello World! Generated at: " + timestamp
    };
  } else {
    console.error("Error reading file:", error);
    process.exit(1);
  }
}

// Add new content to the existing JSON object
existingContent[timestamp] = randomParagraph;

// Write the updated content back to the file
fs.writeFileSync('/asset/data/youtube.json', JSON.stringify(existingContent, null, 2));
console.log("\nUpdated content of youtube.json:");
console.log(fs.readFileSync('/asset/data/youtube.json', 'utf8'));
