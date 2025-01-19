const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Previous helper functions remain the same
async function getChannelId(handle) {
  // ... existing getChannelId function ...
}

async function fetchVideoDetails(videoId) {
  // ... existing fetchVideoDetails function ...
}

async function getLatestVideosForPlaylist(youtube, playlistId, afterDate) {
  let videos = [];
  let nextPageToken = null;
  
  try {
    do {
      const videoResponse = await youtube.playlistItems.list({
        part: 'snippet,contentDetails',
        playlistId: playlistId,
        maxResults: 50,
        pageToken: nextPageToken
      });

      // Process each video
      for (const item of videoResponse.data.items) {
        const publishedAt = new Date(item.snippet.publishedAt);
        
        // Stop if we reach a video older than our latest known video
        if (afterDate && publishedAt <= afterDate) {
          nextPageToken = null;
          break;
        }

        const baseVideo = {
          id: item.contentDetails.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail: item.snippet.thumbnails.medium?.url || '',
          publishedAt: item.snippet.publishedAt
        };
        
        const extraDetails = await fetchVideoDetails(item.contentDetails.videoId);
        videos.push({ ...baseVideo, ...extraDetails });
      }

      nextPageToken = videoResponse.data.nextPageToken;
    } while (nextPageToken);
    
    return videos;
  } catch (error) {
    console.error(`Error fetching videos for playlist ${playlistId}:`, error.message);
    return [];
  }
}

async function fetchPlaylistsData() {
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YOUTUBE_API_KEY environment variable is not set');
    }

    const outputPath = 'playlists.json';
    const youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });

    // Check if playlists.json exists
    let existingPlaylists = [];
    let isUpdate = false;

    if (fs.existsSync(outputPath)) {
      console.log('Found existing playlists.json, updating with new videos...');
      existingPlaylists = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      isUpdate = true;
    }

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
        console.log(`Processing playlist: ${playlist.snippet.title}`);
        
        let videos = [];
        const existingPlaylist = existingPlaylists.find(p => p.id === playlist.id);
        
        if (isUpdate && existingPlaylist) {
          // Find the latest video date in the existing playlist
          const latestVideoDate = existingPlaylist.videos.reduce((latest, video) => {
            const videoDate = new Date(video.publishedAt);
            return videoDate > latest ? videoDate : latest;
          }, new Date(0));

          // Fetch only newer videos
          const newVideos = await getLatestVideosForPlaylist(youtube, playlist.id, latestVideoDate);
          
          // Combine new videos with existing ones
          videos = [...newVideos, ...existingPlaylist.videos];
          console.log(`Added ${newVideos.length} new videos to playlist ${playlist.snippet.title}`);
        } else {
          // Fetch all videos for new playlists
          videos = await getLatestVideosForPlaylist(youtube, playlist.id);
          console.log(`Fetched ${videos.length} videos for new playlist ${playlist.snippet.title}`);
        }

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

    fs.writeFileSync(outputPath, JSON.stringify(playlists, null, 2));
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
