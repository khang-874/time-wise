import type { ContentFilter } from "./types";

/** Case-insensitive substring match. Returns false for blank keywords. */
export function matchesKeyword(text: string, keyword: string): boolean {
  if (!keyword.trim()) return false;
  return text.toLowerCase().includes(keyword.toLowerCase());
}

/** Returns true if any YouTube filter matches the video title. */
export function shouldHideYoutubeItem(titleText: string, filters: ContentFilter[]): boolean {
  return filters
    .filter((f) => f.platform === "youtube")
    .some((f) => matchesKeyword(titleText, f.keyword));
}

/**
 * Returns true if any Reddit filter matches the post title or subreddit name.
 * @param subreddit - bare name without "r/" prefix, e.g. "gaming"
 */
export function shouldHideRedditPost(
  titleText: string,
  subreddit: string,
  filters: ContentFilter[]
): boolean {
  return filters
    .filter((f) => f.platform === "reddit")
    .some(
      (f) => matchesKeyword(titleText, f.keyword) || matchesKeyword(subreddit, f.keyword)
    );
}

/** Returns true if any generic filter matches the page title. */
export function shouldHideGenericPage(pageTitle: string, filters: ContentFilter[]): boolean {
  return filters
    .filter((f) => f.platform === "generic")
    .some((f) => matchesKeyword(pageTitle, f.keyword));
}
