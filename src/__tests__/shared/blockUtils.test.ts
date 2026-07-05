import { describe, it, expect } from "vitest";
import { matchesKeyword, shouldHideYoutubeItem, shouldHideGenericPage } from "../../shared/blockUtils";
import type { ContentFilter } from "../../shared/types";

const ytFilter: ContentFilter = { id: "1", platform: "youtube", keyword: "crypto", addedAt: 0, removalRequestedAt: null };
const gnFilter: ContentFilter = { id: "3", platform: "generic", keyword: "casino", addedAt: 0, removalRequestedAt: null };

describe("matchesKeyword", () => {
  it("matches case-insensitively", () => expect(matchesKeyword("CRYPTO News", "crypto")).toBe(true));
  it("matches substring", () => expect(matchesKeyword("top crypto picks", "crypto")).toBe(true));
  it("returns false for no match", () => expect(matchesKeyword("cooking pasta", "crypto")).toBe(false));
  it("returns false for blank keyword", () => expect(matchesKeyword("anything", "")).toBe(false));
  it("returns false for whitespace-only keyword", () => expect(matchesKeyword("anything", "   ")).toBe(false));
});

describe("shouldHideYoutubeItem", () => {
  it("hides when title matches youtube filter", () =>
    expect(shouldHideYoutubeItem("Top 10 Crypto Coins", [ytFilter])).toBe(true));
  it("does not hide non-matching title", () =>
    expect(shouldHideYoutubeItem("Cooking pasta", [ytFilter])).toBe(false));
  it("does not apply generic filters", () =>
    expect(shouldHideYoutubeItem("casino night", [gnFilter])).toBe(false));
  it("returns false with no filters", () =>
    expect(shouldHideYoutubeItem("crypto", [])).toBe(false));
});

describe("shouldHideGenericPage", () => {
  it("hides when page title matches", () =>
    expect(shouldHideGenericPage("Best Casino Bonuses 2024", [gnFilter])).toBe(true));
  it("does not hide non-matching page", () =>
    expect(shouldHideGenericPage("My personal blog", [gnFilter])).toBe(false));
  it("does not apply youtube filters", () =>
    expect(shouldHideGenericPage("crypto page", [ytFilter])).toBe(false));
});
