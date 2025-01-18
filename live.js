const puppeteer = require('puppeteer');
const YouTube = require('youtube-sr').default;
const fs = require('fs').promises;

async function findLiveBadges(page) {
    return await page.evaluate(() => {
        let contentElement = document.getElementById('content');
        
        if (!contentElement) return [];

        let liveBadges = contentElement.querySelectorAll('.badge-shape-wiz--thumbnail-live');
        let liveUrls = [];

        if (liveBadges.length > 0) {
            liveBadges.forEach((badge) => {
                let parentThumbnail = badge.closest('ytd-thumbnail');
                if (parentThumbnail) {
                    let videoLink = parentThumbnail.querySelector('a.yt-simple-endpoint');
                    if (videoLink) {
                        liveUrls.push(videoLink.href);
                    }
                }
            });
        }
        return liveUrls;
    });
}

async function getVideoDetails(videoId) {
    try {
        const video = await YouTube.getVideo(videoId);
        return {
            id: video.id,
            title: video.title,
            description: video.description,
            thumbnails: {
                default: video.thumbnail.url.replace(/maxresdefault/, 'default'),
                medium: video.thumbnail.url.replace(/maxresdefault/, 'mqdefault'),
                high: video.thumbnail.url.replace(/maxresdefault/, 'hqdefault'),
                maxres: video.thumbnail.url
            },
            channelTitle: video.channel.name,
            startTime: video.uploadedAt,
            concurrentViewers: video.views.toString(),
            link: `https://www.youtube.com/watch?v=${video.id}`,
            statistics: {
                viewCount: video.views.toString(),
                likeCount: video.likes.toString(),
                commentCount: '0'
            }
        };
    } catch (error) {
        console.error(`Error fetching details for video ${videoId}:`, error.message);
        return null;
    }
}

async function deleteLiveJsonFile() {
    try {
        await fs.unlink('liveDetails.json');
        console.log("Existing liveDetails.json file has been deleted.");
    } catch (error) {
        // If the file doesn't exist, that's fine, we just won't do anything
        if (error.code !== 'ENOENT') {
            console.error('Error deleting liveDetails.json:', error);
        }
    }
}

async function main() {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    try {
        await page.goto('https://www.youtube.com/@Catholic_Hymn6/streams', { waitUntil: 'networkidle2' });
        await page.waitForSelector('#content', { timeout: 10000 });

        let liveStreamLinks = await findLiveBadges(page);

        if (liveStreamLinks.length > 0) {
            let liveDetails = await Promise.all(liveStreamLinks.map(async link => {
                return await getVideoDetails(link);
            }));

            liveDetails = liveDetails.filter(detail => detail !== null); // Filter out any null entries

            if (liveDetails.length > 0) {
                await fs.writeFile('liveDetails.json', JSON.stringify(liveDetails[0], null, 2)); // Writing only the first valid live stream
                console.log("Live Stream Details written to liveDetails.json");
            } else {
                console.log("No valid live stream details to write.");
                await deleteLiveJsonFile();
            }
        } else {
            console.log("No live streams found.");
            await deleteLiveJsonFile();
        }
    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        await browser.close();
    }
}

// Run the main function
main();
