import type { BlockSettings, ContentFilter } from "../shared/types";
import { shouldHideYoutubeItem, shouldHideGenericPage } from "../shared/blockUtils";

let currentFilters: ContentFilter[] = [];
let blockShorts = false;
let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

type Platform = "youtube" | "other";

function getPlatform(): Platform {
  const h = window.location.hostname;
  if (h === "www.youtube.com" || h === "youtube.com") return "youtube";
  return "other";
}

function redirectToBlockedPage(reason: string): void {
  const url = new URL(chrome.runtime.getURL("blocked.html"));
  url.searchParams.set("title", "Content blocked");
  url.searchParams.set("reason", reason);
  window.location.replace(url.toString());
}

function isShortsPath(pathname: string): boolean {
  return pathname.startsWith("/shorts/");
}

/**
 * Collects all matchable text from a YouTube feed/search card.
 * - Title: always present
 * - Channel name: present in both home feed and search results
 * - Description snippet: only shown in search results (e.g. "League of Legends gameplay…")
 * - Hashtag chips: occasionally shown in feed cards
 *
 * NOTE: YouTube home feed cards do NOT expose the game category in the DOM —
 * there is no way to detect "this is a LoL video" from the card alone when the
 * title and channel name don't contain the keyword. The game tag only appears
 * on the watch page (handled by getYoutubeWatchPageText).
 */
function getYoutubeFeedItemText(item: HTMLElement): string {
  const parts: string[] = [];
  // Video title (videos and shorts)
  parts.push(item.querySelector<HTMLElement>("#video-title, yt-formatted-string#video-title")?.textContent ?? "");
  // Channel name in video cards
  parts.push(
    item.querySelector<HTMLElement>(
      "ytd-channel-name yt-formatted-string, ytd-channel-name #text, #owner-text yt-formatted-string"
    )?.textContent ?? ""
  );
  // Channel card name (ytd-channel-renderer uses a heading, not #video-title)
  parts.push(item.querySelector<HTMLElement>("#channel-title yt-formatted-string, #channel-title")?.textContent ?? "");
  // Channel card description (shown in channel search results)
  parts.push(item.querySelector<HTMLElement>("#description-text, yt-formatted-string#description")?.textContent ?? "");
  // Hashtag chips
  item.querySelectorAll<HTMLElement>("yt-chip-cloud-chip-renderer, a[href*='hashtag']").forEach((el) => {
    parts.push(el.textContent ?? "");
  });
  return parts.join(" ");
}

/**
 * Collects all matchable text from the current YouTube watch page:
 * title + hashtags shown below the title + game/category label.
 * This is why a filter for "lol" catches "#lolclips" and "league of legends"
 * catches the game tag even when neither appears in the video title itself.
 */
function getYoutubeWatchPageText(): string {
  const parts: string[] = [];
  // Main title
  parts.push(
    document.querySelector<HTMLElement>(
      "ytd-watch-metadata h1 yt-formatted-string, h1.title"
    )?.textContent ?? ""
  );
  // Channel name on watch page
  parts.push(
    document.querySelector<HTMLElement>(
      "#channel-name yt-formatted-string, ytd-channel-name yt-formatted-string"
    )?.textContent ?? ""
  );
  // Hashtags shown in the description header (e.g. #lolclips #caedrel)
  parts.push(
    document.querySelector<HTMLElement>("ytd-video-description-header-renderer")?.textContent ?? ""
  );
  // Game / category label (e.g. "League of Legends")
  parts.push(
    document.querySelector<HTMLElement>("ytd-game-details-renderer, .ytp-game-title")?.textContent ?? ""
  );
  return parts.join(" ");
}

const SHORTS_CARD_SELECTOR = "ytd-reel-item-renderer, ytd-shorts-lockup-view-model";

function filterYoutubeFeeds(root: Element | Document = document): void {
  // Individual video/short/channel cards
  const cardSelectors = [
    "ytd-rich-item-renderer",       // home feed videos
    "ytd-video-renderer",           // search result videos
    "ytd-compact-video-renderer",   // sidebar videos
    SHORTS_CARD_SELECTOR,           // shorts in shelf (both card formats)
    "ytd-channel-renderer",         // channel cards in search results
  ].join(",");

  root.querySelectorAll<HTMLElement>(cardSelectors).forEach((item) => {
    if (shouldHideYoutubeItem(getYoutubeFeedItemText(item), currentFilters)) {
      item.style.display = "none";
    }
  });

  // Shorts are blocked outright (not gated on a keyword match) once the toggle is on
  if (blockShorts) {
    root.querySelectorAll<HTMLElement>(SHORTS_CARD_SELECTOR).forEach((item) => {
      item.style.display = "none";
    });
  }

  // After hiding individual shorts, collapse the entire shelf if every item inside is hidden
  root.querySelectorAll<HTMLElement>("ytd-reel-shelf-renderer, ytd-shorts-shelf-renderer").forEach((shelf) => {
    const items = shelf.querySelectorAll<HTMLElement>(SHORTS_CARD_SELECTOR);
    if (items.length > 0 && Array.from(items).every((el) => el.style.display === "none")) {
      (shelf.closest("ytd-rich-section-renderer") as HTMLElement | null ?? shelf).style.display = "none";
    }
  });
}

function checkYoutubeCurrentVideo(): void {
  if (!window.location.pathname.startsWith("/watch")) return;
  const tryBlock = (): boolean => {
    const text = getYoutubeWatchPageText();
    if (!text.trim()) return false;
    if (shouldHideYoutubeItem(text, currentFilters)) {
      redirectToBlockedPage("This video matches your content filter.");
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

function checkYoutubeCurrentPage(): void {
  if (blockShorts && isShortsPath(window.location.pathname)) {
    redirectToBlockedPage("YouTube Shorts are blocked.");
    return;
  }
  checkYoutubeCurrentVideo();
}

function runFilters(): void {
  const platform = getPlatform();
  if (platform === "youtube") {
    filterYoutubeFeeds();
    checkYoutubeCurrentPage();
  } else if (shouldHideGenericPage(document.title, currentFilters)) {
    redirectToBlockedPage("This page matches your content filter.");
  }
}

function setupObserver(): void {
  observer?.disconnect();
  if (getPlatform() !== "youtube") return;
  observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runFilters, 150);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// YouTube fires this on every SPA navigation
document.addEventListener("yt-navigate-finish", checkYoutubeCurrentPage);

// Bootstrap
chrome.storage.local.get("blockSettings").then((result) => {
  const settings = result["blockSettings"] as BlockSettings | undefined;
  currentFilters = settings?.contentFilters ?? [];
  blockShorts = settings?.blockYoutubeShorts ?? false;
  runFilters();
  setupObserver();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes["blockSettings"]) return;
  const updated = changes["blockSettings"].newValue as BlockSettings | undefined;
  currentFilters = updated?.contentFilters ?? [];
  blockShorts = updated?.blockYoutubeShorts ?? false;
  runFilters();
});
