const puppeteer = require("puppeteer");
const fs = require("fs");
const ytext = require("youtube-ext");

// Helper function to extract video ID from URL
function extractVideoId(url) {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function findLiveBadges(page, callback) {
  page.evaluate(() => {
    const liveBadges = document.querySelectorAll(".badge-shape-wiz--thumbnail-live");    
    const liveUrls = Array.from(liveBadges)
      .map((badge) => {
        const thumbnail = badge.closest("ytd-thumbnail");
        const videoLink = thumbnail?.querySelector("a.yt-simple-endpoint");
        return videoLink?.href || null;
      })
      .filter((link) => link !== null);
    return liveUrls;
  }).then(callback);
}

function getVideoDetails(videoUrl, callback) {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    console.error("Invalid YouTube URL:", videoUrl);
    return callback(null);
  }

  ytext.videoInfo(videoUrl).then(video => {
    if (!video || !video.id) {
      console.error(`No video data returned for ID ${videoId}`);
      return callback(null);
    }

    const details = {
      id: video.id,
      title: video.title || "Untitled",
      description: video.shortDescription || "",
      thumbnails: {
        default: "https://img.youtube.com/vi/" + video.id + "/maxresdefault.jpg",
        medium: "https://img.youtube.com/vi/" + video.id + "/mqdefault",
        high: "https://img.youtube.com/vi/" + video.id + "/hqdefault",
        maxres: "https://img.youtube.com/vi/" + video.id + "/maxresdefault.jpg",
      },
      channelTitle: video.channel?.name || "Unknown Channel",
      channelId: video.channel?.id || "Unknown Channel",
      startTime: video.uploaded || new Date().toISOString(),
      concurrentViewers: (video.views || 0).toString(),
      link: `https://www.youtube.com/watch?v=${video.id}`,
      statistics: {
        viewCount: (video.views?.text || "0").toString(),
        likeCount: (video.likes || 0).toString(),
        commentCount: "0",
      },
    };
    callback(details);
  }).catch(error => {
    console.error(`Error fetching details for video ${videoUrl}:`, error);
    callback(null);
  });
}

function deleteLiveJsonFile(callback) {
  fs.unlink("live.json", (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Error deleting live.json:", err);
    } else {
      console.log("Existing live.json file has been deleted.");
      callback();
    }
  });
}

function main() {
  puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
    ],
  }).then(browser => {
    const page = browser.newPage();
    page.then(page => {
      page.setDefaultNavigationTimeout(20000);
      page.setDefaultTimeout(20000);

      function retryGoto(maxRetries, retryCount, callback) {
        if (retryCount >= maxRetries) {
          callback(new Error("Max retries reached"));
          return;
        }

        page.goto("https://www.youtube.com/@damaikasihchannel9153/streams", { waitUntil: "load" })
          .then(() => page.waitForSelector("#content", { timeout: 15000 }))
          .then(() => callback(null, page))
          .catch(error => {
            console.log(`Attempt ${retryCount + 1} failed. Retrying...`);
            retryGoto(maxRetries, retryCount + 1, callback);
          });
      }

      retryGoto(3, 0, (err, page) => {
        if (err) {
          console.error("An error occurred:", err);
          browser.close().then(() => process.exit(1));
          return;
        }

        findLiveBadges(page, liveStreamLinks => {
          console.log("Found live streams:", liveStreamLinks);

          if (liveStreamLinks.length > 0) {
            const live = [];
            let count = 0;

            liveStreamLinks.forEach(link => {
              getVideoDetails(link, details => {
                if (details) {
                  live.push(details);
                }
                count++;
                if (count === liveStreamLinks.length) {
                  if (live.length > 0) {
                    fs.writeFile("live.json", JSON.stringify(live, null, 2), (err) => {
                      if (err) throw err;
                      console.log("All Live Stream Details written to live.json");
                      browser.close().then(() => process.exit(0));
                    });
                  } else {
                    console.log("No valid live stream details to write.");
                    deleteLiveJsonFile(() => {
                      browser.close().then(() => process.exit(0));
                    });
                  }
                }
              });
            });
          } else {
            console.log("No live streams found.");
            deleteLiveJsonFile(() => {
              browser.close().then(() => process.exit(0));
            });
          }
        });
      });
    }).catch(error => console.error("Error creating new page:", error));
  }).catch(error => console.error("Error launching browser:", error));
}

main();
