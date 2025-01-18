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

// YouTube related functions
async function getChannelId(handle) {
  try {
    const youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });

    const response = await youtube.search.list({
      part: 'snippet',
      q: handle,
      type: 'channel',
      maxResults: 1
    });

    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0].snippet.channelId;
    }
    throw new Error('Channel not found');
  } catch (error) {
    logError('Error getting channel ID:', error);
    throw error;
  }
}

async function fetchVideoDetails(videoId) {
  const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY
  });

  let videoDetails = {};
  try {
    const [contentDetailsResponse, statisticsResponse] = await Promise.all([
      youtube.videos.list({ part: 'contentDetails', id: videoId }),
      youtube.videos.list({ part: 'statistics', id: videoId })
    ]);

    if (contentDetailsResponse.data.items && contentDetailsResponse.data.items.length > 0) {
      videoDetails.duration = contentDetailsResponse.data.items[0].contentDetails.duration;
    }

    if (statisticsResponse.data.items && statisticsResponse.data.items.length > 0) {
      const stats = statisticsResponse.data.items[0].statistics;
      videoDetails.viewCount = stats.viewCount;
      videoDetails.likeCount = stats.likeCount || 'N/A';
      videoDetails.commentCount = stats.commentCount;
      videoDetails.favoriteCount = stats.favoriteCount || 'N/A';
    }
  } catch (error) {
    logError(`Error fetching video details for ${videoId}:`, error);
  }
  return videoDetails;
}

async function* fetchVideos(youtube, playlistId) {
  let nextPageToken = null;
  do {
    const response = await youtube.playlistItems.list({
      part: 'snippet,contentDetails',
      playlistId: playlistId,
      maxResults: 50,
      pageToken: nextPageToken
    });
    yield* response.data.items;
    nextPageToken = response.data.nextPageToken;
  } while (nextPageToken);
}

// Helper functions for error logging
function logError(message, error) {
  console.error(message, error.message);
  if (error.response) {
    console.error('Response data:', error.response.data);
  }
}

async function* fetchVideos(youtube, playlistId) {
  let nextPageToken = null;
  do {
    try {
      const response = await youtube.playlistItems.list({
        part: 'snippet,contentDetails',
        playlistId: playlistId,
        maxResults: 50,
        pageToken: nextPageToken
      });
      
      if (response.data.items) {
        yield* response.data.items;
      }
      
      nextPageToken = response.data.nextPageToken;
    } catch (error) {
      logError(`Error fetching playlist items for ${playlistId}:`, error);
      break;
    }
  } while (nextPageToken);
}

async function updatePlaylistData(youtube, playlist, existingVideos) {
  let videos = [];
  const existingVideoIds = new Set(existingVideos?.map(v => v.id) || []);
  let hasNewVideos = true;

  console.log(`Fetching videos for playlist: ${playlist.snippet.title}`);
  
  // If we have no existing videos, fetch all videos
  const shouldFetchAll = !existingVideos || existingVideos.length === 0;
  
  try {
    for await (const item of fetchVideos(youtube, playlist.id)) {
      const videoId = item.contentDetails.videoId;
      
      // If we're fetching all videos or if this is a new video
      if (shouldFetchAll || !existingVideoIds.has(videoId)) {
        console.log(`Processing video: ${item.snippet.title}`);
        
        const baseVideo = {
          id: videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail: item.snippet.thumbnails.medium?.url || '',
          publishedAt: item.snippet.publishedAt
        };
        
        const extraDetails = await fetchVideoDetails(videoId);
        
        if (shouldFetchAll) {
          // For complete fetch, add all videos
          videos.push({ ...baseVideo, ...extraDetails });
        } else {
          // For incremental update, add to existing videos
          videos = [...existingVideos, { ...baseVideo, ...extraDetails }];
        }
        
        existingVideoIds.add(videoId);
      } else {
        // If we found an existing video and we're not doing a complete fetch,
        // we can use the existing videos as is
        if (!shouldFetchAll) {
          videos = existingVideos;
          hasNewVideos = false;
          break;
        }
      }
    }

    // Sort videos by published date (newest first)
    videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    return {
      id: playlist.id,
      title: playlist.snippet.title,
      description: playlist.snippet.description,
      thumbnail: playlist.snippet.thumbnails.medium?.url || '',
      videoCount: videos.length,
      videos: videos,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    logError(`Error updating playlist ${playlist.id}:`, error);
    // Return existing data if there's an error
    return {
      id: playlist.id,
      title: playlist.snippet.title,
      description: playlist.snippet.description,
      thumbnail: playlist.snippet.thumbnails.medium?.url || '',
      videoCount: existingVideos?.length || 0,
      videos: existingVideos || [],
      lastUpdated: new Date().toISOString(),
      error: error.message
    };
  }
}

async function fetchPlaylistsData() {
  console.log("Starting playlist data fetch...");
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YOUTUBE_API_KEY environment variable is not set');
    }

    const youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });

    let existingPlaylists = [];
    const outputPath = 'playlists.json';
    const ghPagesPath = 'playlists.json';

    // Get channel ID
    const channelId = process.env.CHANNEL_ID || await getChannelId('damaikasihchannel9153');
    console.log('Using channel ID:', channelId);

    // Load existing playlists if available
    if (fs.existsSync(ghPagesPath)) {
      try {
        const fileContent = fs.readFileSync(ghPagesPath, 'utf8');
        existingPlaylists = JSON.parse(fileContent);
        console.log(`Loaded ${existingPlaylists.length} existing playlists`);
      } catch (err) {
        console.log('Error reading existing playlists, starting fresh:', err.message);
        existingPlaylists = [];
      }
    } else {
      console.log('No existing playlists.json found, starting fresh');
    }

    // Fetch all playlists from the channel
    const playlistResponse = await youtube.playlists.list({
      part: 'snippet,contentDetails',
      channelId: channelId,
      maxResults: 50
    });

    if (!playlistResponse.data.items) {
      throw new Error('No playlists found');
    }

    console.log(`Found ${playlistResponse.data.items.length} playlists on the channel`);

    // Update each playlist
    const playlists = await Promise.all(
      playlistResponse.data.items.map(async (playlist) => {
        const existingPlaylist = existingPlaylists.find(p => p.id === playlist.id);
        console.log(`Processing playlist: ${playlist.snippet.title}`);
        return updatePlaylistData(youtube, playlist, existingPlaylist?.videos);
      })
    );

    // Save updated playlists
    fs.writeFileSync(outputPath, JSON.stringify(playlists, null, 2));
    console.log(`Successfully updated playlists data to ${outputPath}`);
    return playlists;

  } catch (error) {
    logError('Error in fetchPlaylistsData:', error);
    process.exit(1);
  }
}

// Main execution
(async () => {
  // Check if year argument is provided for Catholic calendar data
  console.log("FETCH CATHOLIC CALENDAR");
  await runIfOneDayBeforeNewYear();

  // Always fetch YouTube playlists data
  await fetchPlaylistsData();
})();
