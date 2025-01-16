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

let existingContent = '';
try {
  existingContent = fs.readFileSync('hello-world.txt', 'utf8');
  console.log("\nCurrent content of hello-world.txt:");
  console.log(existingContent);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log("hello-world.txt does not exist yet. Initializing...");
    existingContent = "Hello World! Generated at: " + new Date().toISOString();
    fs.writeFileSync('hello-world.txt', existingContent);
    // No need to log here since it's just been created with initial content
  } else {
    console.error("Error reading file:", error);
    process.exit(1);
  }
}

const newContent = existingContent + '\n\n' + 
  '=== New Update (' + timestamp + ') ===\n' +
  randomParagraph;

fs.writeFileSync('hello-world.txt', newContent);
console.log("\nUpdated content of hello-world.txt:");
console.log(fs.readFileSync('hello-world.txt', 'utf8'));
