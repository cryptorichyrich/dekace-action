const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const { google } = require('googleapis');
const JSONStream = require('jsonstream');
const es = require('event-stream');
require('dotenv').config();

// Helper functions for error logging
function logError(message, error) {
  console.error(message, error.message);
  if (error.response) {
    console.error('Response data:', error.response.data);
  }
}

// Function for fetching and saving Catholic calendar data
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
            logError(`Error fetching data for month ${month}:`, error);
        }
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

async function updatePlaylistData(youtube, playlist, existingVideos) {
  let videos = existingVideos || [];
  const existingVideoIds = new Set(videos.map(v => v.id));

  console.log(`Fetching new videos for playlist: ${playlist.snippet.title}`);
  
  for await (const item of fetchVideos(youtube, playlist.id)) {
    const videoId = item.contentDetails.videoId;
    if (!existingVideoIds.has(videoId)) {
      const baseVideo = {
        id: videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.medium?.url || '',
        publishedAt: item.snippet.publishedAt
      };
      const extraDetails = await fetchVideoDetails(videoId);
      videos.push({ ...baseVideo, ...extraDetails });
      existingVideoIds.add(videoId);
    } else {
      break; // Stop if we've encountered all new videos
    }
  }

  return {
    id: playlist.id,
    title: playlist.snippet.title,
    description: playlist.snippet.description,
    thumbnail: playlist.snippet.thumbnails.medium?.url || '',
    videoCount: videos.length,
    videos: videos
  };
}

async function fetchPlaylistsData() {
  console.log("YOUTUBE_API_KEY:", process.env.YOUTUBE_API_KEY);
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YOUTUBE_API_KEY environment variable is not set');
    }

    const youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });

    const channelId = process.env.CHANNEL_ID || await getChannelId('damaikasihchannel9153');
    console.log('Found channel ID:', channelId);

    const playlistResponse = await youtube.playlists.list({
      part: 'snippet,contentDetails',
      channelId: channelId,
      maxResults: 50
    });

    if (!playlistResponse.data.items) {
      throw new Error('No playlists found');
    }

    console.log(`Found ${playlistResponse.data.items.length} playlists`);

    // Save directly to root directory
    const rootPath = __dirname;
    const outputPath = path.join(rootPath, 'playlists.json');
    let existingPlaylists = [];

    // Check if the file exists and read it using streams
    if (fs.existsSync(outputPath)) {
      await new Promise(resolve => {
        fs.createReadStream(outputPath)
          .pipe(JSONStream.parse('*'))
          .pipe(es.mapSync(playlist => existingPlaylists.push(playlist)))
          .on('end', resolve);
      });
    }

    const playlists = await Promise.all(
      playlistResponse.data.items.map(async (playlist) => {
        const existingPlaylist = existingPlaylists.find(p => p.id === playlist.id);
        return updatePlaylistData(youtube, playlist, existingPlaylist ? existingPlaylist.videos : []);
      })
    );

    fs.writeFileSync(outputPath, JSON.stringify(playlists, null, 2));
    console.log(`Successfully updated playlists data to ${outputPath}`);
    return playlists;
  } catch (error) {
    logError('Error fetching playlists:', error);
    process.exit(1);
  }
}

// Main execution
(async () => {
  // Check if year argument is provided for Catholic calendar data
  const year = process.argv[2];
  if (year && !isNaN(year)) {
    await fetchAndSaveCatholicCalendarData(parseInt(year, 10));
  } else if (year) {
    console.error('Please provide a valid year as an argument for Catholic calendar data.');
    process.exit(1);
  }

  // Always fetch YouTube playlists data
  await fetchPlaylistsData();
})();
