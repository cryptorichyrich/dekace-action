const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const ytext = require("youtube-ext");

// Helper function to extract video ID from URL
function extractVideoId(url) {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function findLiveBadges(page) {
  return await page.evaluate(() => {
    const liveBadges = document.querySelectorAll(".badge-shape-wiz--thumbnail-live");
    const liveUrls = Array.from(liveBadges)
      .map((badge) => {
        const thumbnail = badge.closest("ytd-thumbnail");
        const videoLink = thumbnail?.querySelector("a.yt-simple-endpoint");
        return videoLink?.href || null;
      })
      .filter((link) => link !== null);
    return liveUrls;
  });
}

async function getVideoDetails(videoUrl) {
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      console.error("Invalid YouTube URL:", videoUrl);
      return null;
    }

    const video = await ytext.videoInfo(videoUrl);
    if (!video || !video.id) {
      console.error(`No video data returned for ID ${videoId}`);
      return null;
    }

    return {
      id: video.id,
      title: video.title || "Untitled",
      description: video.shortDescription || "",
      thumbnails: {
        default: (video.thumbnail?.url || "").replace(/maxresdefault/, "default"),
        medium: (video.thumbnail?.url || "").replace(/maxresdefault/, "mqdefault"),
        high: (video.thumbnail?.url || "").replace(/maxresdefault/, "hqdefault"),
        maxres: video.thumbnail?.url || "",
      },
      channelTitle: video.channel?.name || "Unknown Channel",
      channelId: video.channel?.id || "Unknown Channel",
      startTime: video.uploaded || new Date().toISOString(),
      concurrentViewers: (video.views || 0).toString(),
      link: `https://www.youtube.com/watch?v=${videoId}`,
      statistics: {
        viewCount: (video.views?.text || "0").toString(),
        likeCount: (video.likes || 0).toString(),
        commentCount: "0",
      },
    };
  } catch (error) {
    console.error(`Error fetching details for video ${videoUrl}:`, error);
    return null;
  }
}

async function deleteLiveJsonFile() {
  try {
    await fs.unlink("live.json");
    console.log("Existing live.json file has been deleted.");
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Error deleting live.json:", error);
    }
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
    ],
  });

  const page = await browser.newPage();
  try {
    await page.setDefaultNavigationTimeout(20000);
    await page.setDefaultTimeout(20000);

    const maxRetries = 3;
    let retryCount = 0;
    let success = false;

    while (!success && retryCount < maxRetries) {
      try {
        await page.goto("https://www.youtube.com/@damaikasihchannel9153/streams", {
          waitUntil: "domcontentloaded",
        });
        await page.waitForSelector("#content", { timeout: 15000 });
        success = true;
      } catch (error) {
        retryCount++;
        console.log(`Attempt ${retryCount} failed. Retrying...`);
        if (retryCount === maxRetries) throw error;
      }
    }

    const liveStreamLinks = await findLiveBadges(page);
    console.log("Found live streams:", liveStreamLinks);

    if (liveStreamLinks.length > 0) {
      const live = (
        await Promise.all(liveStreamLinks.map((link) => getVideoDetails(link)))
      ).filter((detail) => detail !== null);

      if (live.length > 0) {
        await fs.writeFile("live.json", JSON.stringify(live, null, 2));
        console.log("All Live Stream Details written to live.json");
      } else {
        console.log("No valid live stream details to write.");
        await deleteLiveJsonFile();
      }
    } else {
      console.log("No live streams found.");
      await deleteLiveJsonFile();
    }
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

(async () => {
  await main();
})();
