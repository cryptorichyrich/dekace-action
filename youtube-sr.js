const puppeteer = require('puppeteer');
const fs = require('fs').promises; // Use promises for easier async handling
const YouTube = require('youtube-sr').default;

async function main() {
    const browser = await puppeteer.launch({ headless: "new" ,
    args: ["--no-sandbox"]});
    const page = await browser.newPage();

    try {
        await page.goto('https://www.youtube.com/@damaikasihchannel9153/playlists', { waitUntil: 'networkidle2' });
        await page.waitForSelector('ytd-two-column-browse-results-renderer', { timeout: 10000 });

        let playlists = await page.evaluate(() => {
            let playlistElements = Array.from(document.querySelectorAll('yt-lockup-view-model'));
            return playlistElements.map(pl => ({
                title: pl.querySelector('h3')?.textContent.trim() || '',
                url: pl.querySelector('a')?.href || ''
            }));
        });

        let allPlaylistsData = [];

        for (const playlist of playlists) {
            try {
                // Extract playlist ID from URL
                const playlistId = new URL(playlist.url).searchParams.get('list');
                console.log("playlistId",playlistId);
                if (playlistId) {
                    const playlistData = await YouTube.getPlaylist(playlistId);
                    // Here we assume that 'videos' array contains video objects
                    const videoPromises = playlistData.videos.map(async video => {
                        try {
                            console.log(`Fetching video: ${video.id}`);
                            const videoInfo = await YouTube.getVideo(`https://www.youtube.com/watch?v=${video.id}`);
                            console.log(`Successfully fetched video: ${video.id}`);
                            return videoInfo;
                        } catch (error) {
                            console.error(`Error fetching video ${video.id}:`, error);
                            return null;
                        }
                    });
                    
                    const detailedVideos = await Promise.all(videoPromises);

                    allPlaylistsData.push({
                        title: playlist.title,
                        url: playlist.url,
                        videos: detailedVideos.filter(v => v !== null) // Filter out any null entries
                    });
                }
            } catch (error) {
                console.error(`Error processing playlist ${playlist.title}:`, error);
            }
        }

        // Write the data to a JSON file
        await fs.writeFile('dkcPlaylists.json', JSON.stringify(allPlaylistsData, null, 2));

    } catch (error) {
        console.error('An error occurred while scraping:', error);
    } finally {
        await browser.close();
    }
}

main();
