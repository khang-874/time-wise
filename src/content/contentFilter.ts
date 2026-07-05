import type { BlockSettings, ContentFilter } from "../shared/types";
import {
  shouldHideYoutubeItem,
  shouldHideRedditPost,
  shouldHideGenericPage,
} from "../shared/blockUtils";

const OVERLAY_ID = "timewise-filter-overlay";

let currentFilters: ContentFilter[] = [];
let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

type Platform = "youtube" | "reddit" | "other";

function getPlatform(): Platform {
  const h = window.location.hostname;
  if (h === "www.youtube.com" || h === "youtube.com") return "youtube";
  if (h === "www.reddit.com" || h === "reddit.com") return "reddit";
  return "other";
}

function showFilterOverlay(reason: string): void {
  if (document.getElementById(OVERLAY_ID)) return;
  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    background: "rgba(30,27,75,0.97)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui,sans-serif",
    color: "#fff",
  });
  el.innerHTML = `
    <div style="font-size:48px;margin-bottom:16px">🚫</div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 8px">Content blocked</h1>
    <p style="font-size:14px;color:rgba(255,255,255,0.6);margin:0 0 24px;max-width:320px;text-align:center">${reason}</p>
    <button id="timewise-proceed"
      style="padding:8px 20px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);
             background:transparent;color:#fff;cursor:pointer;font-size:13px">
      Proceed anyway
    </button>
  `;
  document.body.appendChild(el);
  document.getElementById("timewise-proceed")?.addEventListener("click", () => el.remove());
}

function filterYoutubeFeeds(root: Element | Document = document): void {
  const selectors = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-reel-item-renderer",
  ].join(",");
  root.querySelectorAll<HTMLElement>(selectors).forEach((item) => {
    const title =
      item.querySelector<HTMLElement>("#video-title, yt-formatted-string#video-title")
        ?.textContent ?? "";
    if (shouldHideYoutubeItem(title, currentFilters)) {
      item.style.display = "none";
    }
  });
}

function checkYoutubeCurrentVideo(): void {
  if (!window.location.pathname.startsWith("/watch")) return;
  const tryBlock = (): boolean => {
    const titleEl = document.querySelector<HTMLElement>(
      "ytd-watch-metadata h1 yt-formatted-string, h1.title"
    );
    const title = titleEl?.textContent ?? "";
    if (!title) return false;
    if (shouldHideYoutubeItem(title, currentFilters)) {
      showFilterOverlay("This video matches your content filter.");
    }
    return true;
  };
  if (!tryBlock()) {
    const poll = setInterval(() => {
      if (tryBlock()) clearInterval(poll);
    }, 500);
    setTimeout(() => clearInterval(poll), 10_000);
  }
}

function filterRedditFeeds(root: Element | Document = document): void {
  const selectors = ["[data-testid='post-container']", ".thing"].join(",");
  root.querySelectorAll<HTMLElement>(selectors).forEach((post) => {
    const title = post.querySelector<HTMLElement>("h3, .title a")?.textContent ?? "";
    const subredditEl = post.querySelector<HTMLElement>(
      "[data-click-id='subreddit'], .subreddit"
    );
    const subreddit = (subredditEl?.textContent ?? "").replace(/^r\//, "");
    if (shouldHideRedditPost(title, subreddit, currentFilters)) {
      post.style.display = "none";
    }
  });
}

function checkRedditCurrentPage(): void {
  const match = window.location.pathname.match(/^\/r\/([^/]+)/);
  const subreddit = match?.[1] ?? "";
  const title = document.title;
  if (shouldHideRedditPost(title, subreddit, currentFilters)) {
    showFilterOverlay("This page matches your content filter.");
  }
}

function runFilters(): void {
  const platform = getPlatform();
  if (platform === "youtube") {
    filterYoutubeFeeds();
    checkYoutubeCurrentVideo();
  } else if (platform === "reddit") {
    filterRedditFeeds();
    checkRedditCurrentPage();
  } else {
    if (shouldHideGenericPage(document.title, currentFilters)) {
      showFilterOverlay("This page matches your content filter.");
    }
  }
}

function setupObserver(): void {
  observer?.disconnect();
  const platform = getPlatform();
  if (platform !== "youtube" && platform !== "reddit") return;
  observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runFilters, 150);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// YouTube fires this on every SPA navigation
document.addEventListener("yt-navigate-finish", () => {
  document.getElementById(OVERLAY_ID)?.remove();
  checkYoutubeCurrentVideo();
});

// Bootstrap
chrome.storage.local.get("blockSettings").then((result) => {
  const settings = result["blockSettings"] as BlockSettings | undefined;
  currentFilters = settings?.contentFilters ?? [];
  runFilters();
  setupObserver();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes["blockSettings"]) return;
  const updated = changes["blockSettings"].newValue as BlockSettings | undefined;
  currentFilters = updated?.contentFilters ?? [];
  runFilters();
});
