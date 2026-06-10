import path from "path";
import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";

const isLocal = process.env.NODE_ENV !== "production";

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
    // Set library path to ensure system libraries resolve correctly
    process.env.LD_LIBRARY_PATH = path.dirname(executablePath);
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
