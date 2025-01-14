// fetch-playlists.js
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

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
    console.error('Error getting channel ID:', error);
    throw error;
  }
}

async function fetchPlaylistsData() {
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YOUTUBE_API_KEY environment variable is not set');
    }

    const youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });

    // Get channel ID from handle
    const channelId = await getChannelId('damaikasihchannel9153');
    console.log('Found channel ID:', channelId);

    // Get all playlists for the channel
    console.log('Fetching playlists...');
    const playlistResponse = await youtube.playlists.list({
      part: 'snippet,contentDetails',
      channelId: channelId,
      maxResults: 50
    });

    if (!playlistResponse.data.items) {
      throw new Error('No playlists found');
    }

    console.log(`Found ${playlistResponse.data.items.length} playlists`);

    const playlists = await Promise.all(
      playlistResponse.data.items.map(async (playlist) => {
        console.log(`Fetching videos for playlist: ${playlist.snippet.title}`);
        
        // Get all videos for each playlist, handling pagination
        let videos = [];
        let nextPageToken = null;
        do {
          const videoResponse = await youtube.playlistItems.list({
            part: 'snippet,contentDetails',
            playlistId: playlist.id,
            maxResults: 50, // Max results per call
            pageToken: nextPageToken
          });

          videos = videos.concat(videoResponse.data.items.map(item => ({
            id: item.contentDetails.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.medium?.url || '',
            publishedAt: item.snippet.publishedAt
          })));

          nextPageToken = videoResponse.data.nextPageToken;
        } while (nextPageToken);

        return {
          id: playlist.id,
          title: playlist.snippet.title,
          description: playlist.snippet.description,
          thumbnail: playlist.snippet.thumbnails.medium?.url || '',
          videoCount: playlist.contentDetails.itemCount,
          videos: videos
        };
      })
    );

    // Ensure output directory exists
    const OUTPUT_DIR = 'assets/data';
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write to JSON file
    const outputPath = path.join(OUTPUT_DIR, 'playlists.json');
    fs.writeFileSync(
      outputPath,
      JSON.stringify(playlists, null, 2)
    );

    console.log(`Successfully saved playlists data to ${outputPath}`);
    return playlists;
  } catch (error) {
    console.error('Error fetching playlists:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

fetchPlaylistsData();
