const puppeteer = require('puppeteer');
const YouTube = require('youtube-sr').default;
const fs = require('fs').promises;
const ytext = require("youtube-ext");

// Helper function to extract video ID from URL
function extractVideoId(url) {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

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

async function getVideoDetails(videoUrl) {
    try {
        // Extract video ID from URL
        const videoId = extractVideoId(videoUrl);
        if (!videoId) {
            console.error('Invalid YouTube URL:', videoUrl);
            return null;
        }
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Use the correct youtube-sr method
        const video = await ytext.videoInfo(videoUrl);
        
        // Add validation
        if (!video || !video.id) {
            console.error(`No video data returned for ID ${videoId}`);
            return null;
        }

        console.log('Raw video data:', JSON.stringify(video, null, 2)); // Debug log

        return {
            id: video.id,
            title: video.title || 'Untitled',
            description: video.description || '',
            thumbnails: {
                default: (video.thumbnail?.url || '').replace(/maxresdefault/, 'default'),
                medium: (video.thumbnail?.url || '').replace(/maxresdefault/, 'mqdefault'),
                high: (video.thumbnail?.url || '').replace(/maxresdefault/, 'hqdefault'),
                maxres: video.thumbnail?.url || ''
            },
            channelTitle: video.channel?.name || 'Unknown Channel',
            startTime: video.uploaded || new Date().toISOString(),
            concurrentViewers: (video.views || 0).toString(),
            link: `https://www.youtube.com/watch?v=${videoId}`,
            statistics: {
                viewCount: (video.views || 0).toString(),
                likeCount: (video.likes || 0).toString(),
                commentCount: '0'
            }
        };
    } catch (error) {
        console.error(`Error fetching details for video ${videoUrl}:`, error);
        console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return null;
    }
}

async function deleteLiveJsonFile() {
    try {
        await fs.unlink('liveDetails.json');
        console.log("Existing liveDetails.json file has been deleted.");
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error deleting liveDetails.json:', error);
        }
    }
}

async function main() {
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    });
    
    const page = await browser.newPage();
    try {
        await page.setDefaultNavigationTimeout(30000);
        await page.setDefaultTimeout(30000);

        const maxRetries = 3;
        let retryCount = 0;
        let success = false;

        while (!success && retryCount < maxRetries) {
            try {
                await page.goto('https://www.youtube.com/@Catholic_Hymn6/streams', { 
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });
                await page.waitForSelector('#content', { timeout: 30000 });
                success = true;
            } catch (error) {
                retryCount++;
                console.log(`Attempt ${retryCount} failed. Retrying...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                if (retryCount === maxRetries) throw error;
            }
        }

        let liveStreamLinks = await findLiveBadges(page);
        console.log('Found live streams:', liveStreamLinks);

        if (liveStreamLinks.length > 0) {
            let liveDetails = await Promise.all(liveStreamLinks.map(async link => {
                return await getVideoDetails(link);
            }));
            
            liveDetails = liveDetails.filter(detail => detail !== null);
            
            if (liveDetails.length > 0) {
                await fs.writeFile('liveDetails.json', JSON.stringify(liveDetails[0], null, 2));
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
        throw error;
    } finally {
        await browser.close();
    }
}

// Test a specific video first
async function test() {
    try {
        const result = await getVideoDetails("https://www.youtube.com/watch?v=DHzd-_OjE-Q");
        console.log('Test result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test first, then the main function
(async () => {
    await test();
    await main();
})();
