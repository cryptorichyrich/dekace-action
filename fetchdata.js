const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();
const JSONStream = require('JSONStream');
const es = require('event-stream');

// Check for all required environment variables
if (!process.env.YOUTUBE_API_KEY) {
  throw new Error('YOUTUBE_API_KEY environment variable is not set');
}

// Error logging helper function
function logError(message, error) {
  console.error(message, error.message);
  if (error.response) {
    console.error('Response data:', error.response.data);
  }
}

// Convert @ handle to channel ID using YouTube Data API
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

    const OUTPUT_DIR = 'assets/data';
    const outputPath = path.join(OUTPUT_DIR, 'playlists.json');
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

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(playlists, null, 2));
    console.log(`Successfully updated playlists data to ${outputPath}`);
    return playlists;
  } catch (error) {
    logError('Error fetching playlists:', error);
    process.exit(1);
  }
}

fetchPlaylistsData();
