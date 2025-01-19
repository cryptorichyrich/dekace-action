const puppeteer = require('puppeteer');
const fs = require('fs');
const YouTube = require('youtube-sr').default;

function main() {
    puppeteer.launch({ headless: "new", args: ["--no-sandbox"] }).then(browser => {
        browser.newPage().then(page => {
            page.goto('https://www.youtube.com/@damaikasihchannel9153/playlists', { waitUntil: 'networkidle2' })
                .then(() => page.waitForSelector('ytd-two-column-browse-results-renderer', { timeout: 10000 }))
                .then(() => {
                    return page.evaluate(() => {
                        let playlistElements = Array.from(document.querySelectorAll('yt-lockup-view-model'));
                        return playlistElements.map(pl => ({
                            title: pl.querySelector('h3')?.textContent.trim() || '',
                            url: pl.querySelector('a')?.href || ''
                        }));
                    });
                })
                .then(playlists => {
                    let allPlaylistsData = [];

                    function processNextPlaylist() {
                        if (playlists.length === 0) {
                            fs.writeFile('dkcPlaylists.json', JSON.stringify(allPlaylistsData, null, 2), err => {
                                if (err) {
                                    console.error('Error writing file:', err);
                                }
                                browser.close();
                            });
                            return;
                        }

                        const playlist = playlists.shift();
                        const playlistId = new URL(playlist.url).searchParams.get('list');
                        console.log("playlistId", playlistId);

                        if (playlistId) {
                            YouTube.getPlaylist(playlistId).then(playlistData => {
                                const videoPromises = playlistData.videos.map(video => 
                                    YouTube.getVideo(`https://www.youtube.com/watch?v=${video.id}`)
                                        .then(videoInfo => ({
                                            success: true,
                                            video: videoInfo
                                        }))
                                        .catch(error => {
                                            console.error(`Error fetching video ${video.id}:`, error);
                                            return { success: false, error: error };
                                        })
                                );

                                Promise.all(videoPromises).then(detailedVideos => {
                                    allPlaylistsData.push({
                                        title: playlist.title,
                                        url: playlist.url,
                                        videos: detailedVideos.filter(v => v.success).map(v => v.video)
                                    });
                                    processNextPlaylist();
                                });
                            }).catch(error => {
                                console.error(`Error processing playlist ${playlist.title}:`, error);
                                processNextPlaylist(); // Continue to next playlist even if one fails
                            });
                        } else {
                            processNextPlaylist(); // If no playlist ID, continue to next playlist
                        }
                    }

                    processNextPlaylist();
                })
                .catch(error => {
                    console.error('An error occurred while scraping:', error);
                    browser.close();
                });
        });
    });
}

main();
