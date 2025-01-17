const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

// Configuration
// damaikasihchannel9153
const CONFIG = {
  channelUsername: 'damaikasihchannel9153',
  outputFile: 'live.json'
};

// Initialize YouTube API
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

/**
 * Get channel ID from username
 * @param {string} username - YouTube channel username
 * @returns {Promise<string>} Channel ID
 */
async function getChannelId(username) {
  const response = await youtube.search.list({
    part: ['snippet'],
    q: username,
    type: 'channel',
    maxResults: 1
  });

  if (response.data.items.length === 0) {
    throw new Error('Channel not found');
  }

  return response.data.items[0].snippet.channelId;
}

/**
 * Get detailed live stream information
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} Detailed video information
 */
async function getLiveStreamDetails(videoId) {
  const response = await youtube.videos.list({
    part: ['snippet', 'statistics', 'liveStreamingDetails'],
    id: [videoId]
  });

  if (response.data.items.length === 0) {
    throw new Error('Video details not found');
  }

  const video = response.data.items[0];
  return {
    id: videoId,
    title: video.snippet.title,
    description: video.snippet.description,
    thumbnails: {
      default: video.snippet.thumbnails.default?.url,
      medium: video.snippet.thumbnails.medium?.url,
      high: video.snippet.thumbnails.high?.url,
      maxres: video.snippet.thumbnails.maxres?.url
    },
    channelTitle: video.snippet.channelTitle,
    startTime: video.liveStreamingDetails?.actualStartTime,
    concurrentViewers: video.liveStreamingDetails?.concurrentViewers,
    link: `https://www.youtube.com/watch?v=${videoId}`,
    statistics: {
      viewCount: video.statistics?.viewCount,
      likeCount: video.statistics?.likeCount,
      commentCount: video.statistics?.commentCount
    }
  };
}

/**
 * Check if channel is live and update status file
 * @param {string} channelId - YouTube channel ID
 */
async function checkLiveStatus(channelId) {
  try {
    // Search for live streams
    const searchResponse = await youtube.search.list({
      part: ['snippet'],
      channelId: channelId,
      eventType: 'live',
      type: 'video',
      maxResults: 1
    });

    const outputPath = path.join(__dirname, CONFIG.outputFile);

    if (searchResponse.data.items.length > 0) {
      const liveVideo = searchResponse.data.items[0];
      
      // Get detailed information about the live stream
      const liveData = await getLiveStreamDetails(liveVideo.id.videoId);
      
      // Write data to file
      await fs.writeFile(outputPath, JSON.stringify(liveData, null, 2));
      console.log(`Live status updated: Channel is live - ${liveData.title}`);
      return true;
    } else {
      // Remove live.json if it exists
      try {
        await fs.unlink(outputPath);
        console.log('Live status updated: Channel is not live, live.json removed');
      } catch (err) {
        if (err.code !== 'ENOENT') { // Ignore error if file doesn't exist
          throw err;
        }
      }
      return false;
    }
  } catch (error) {
    console.error('Error checking live status:', error.message);
    if (error.response) {
      console.error('API Response Error:', error.response.data);
    }
    console.log('NO LIVE AT THE MOMENT');
    return false;
  }
}

/**
 * Initialize and run the check
 */
async function main() {
  try {
    // Validate configuration
    if (!process.env.YOUTUBE_API_KEY) {
      console.error('Error: YOUTUBE_API_KEY not found in environment variables');
      process.exit(1);
    }

    console.log('Finding channel ID...');
    const channelId = await getChannelId(CONFIG.channelUsername);
    console.log(`Channel ID found: ${channelId}`);

    // Run the check once
    await checkLiveStatus(channelId);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  console.error('Application failed to run:', error);
  process.exit(1);
});
