import path from "path";
import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";

const isLocal = !process.env.VERCEL;

export const launchBrowser = async () => {
  let localChromePath = "/usr/bin/google-chrome";
  if (process.platform === "darwin") {
    localChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  } else if (process.platform === "win32") {
    localChromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }

  const executablePath = isLocal
    ? (process.env.CHROME_PATH || localChromePath)
    : await chromium.executablePath();

  if (!isLocal) {
    // Disable graphics mode in serverless environments to prevent crashes
    if (typeof chromium.setGraphicsMode === "function") {
      chromium.setGraphicsMode(false);
    }
    // Load custom fonts to make them available to Chromium
    const fontDir = path.join(process.cwd(), "fonts");
    try {
      if (typeof chromium.font === "function") {
        await chromium.font(path.join(fontDir, "Tinos-Regular.ttf"));
        await chromium.font(path.join(fontDir, "Tinos-Bold.ttf"));
        await chromium.font(path.join(fontDir, "Tinos-Italic.ttf"));
        await chromium.font(path.join(fontDir, "Tinos-BoldItalic.ttf"));
      }
    } catch (e) {
      console.error("Error loading custom fonts:", e);
    }
  }

  return await playwright.launch({
    args: isLocal
      ? [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
        ]
      : chromium.args,
    executablePath,
    headless: isLocal ? true : chromium.headless,
  });
};
