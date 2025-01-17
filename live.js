const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const { google } = require('googleapis');
const JSONStream = require('JSONStream');
const es = require('event-stream');
require('dotenv').config();

// Channel ID for damaikasihchannel9153 - you need to find this from YouTube
const CHANNEL_ID = 'damaikasihchannel9153'; 

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

async function checkLiveStatus() {
  try {
    const response = await youtube.search.list({
      part: 'snippet',
      channelId: CHANNEL_ID,
      eventType: 'live',
      type: 'video',
      maxResults: 1
    });

    if (response.data.items.length > 0) { // If there's a live video found
      const liveVideo = response.data.items[0];
      const liveData = {
        image: liveVideo.snippet.thumbnails.high.url,
        title: liveVideo.snippet.title,
        link: `https://www.youtube.com/watch?v=${liveVideo.id.videoId}`,
        // Add more details as needed
      };

      // Write or update live.json
      fs.writeFileSync(path.join(__dirname, 'live.json'), JSON.stringify(liveData, null, 2));
      console.log('Live status updated: User is live.');
    } else {
      // If no live video found, delete live.json if it exists
      if (fs.existsSync(path.join(__dirname, 'live.json'))) {
        fs.unlinkSync(path.join(__dirname, 'live.json'));
        console.log('Live status updated: User is not live, live.json deleted.');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Check live status at regular intervals, e.g., every 5 minutes
setInterval(checkLiveStatus, 5 * 60 * 1000); // 5 minutes in milliseconds

// Run once immediately
checkLiveStatus();
