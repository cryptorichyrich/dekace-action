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

const existingContent = fs.readFileSync('assets/data/hello-world.txt', 'utf8');
const newContent = existingContent + '\n\n' + 
  '=== New Update (' + timestamp + ') ===\n' +
  randomParagraph;

fs.writeFileSync('assets/data/hello-world.txt', newContent);
