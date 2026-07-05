import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addBlockedDomain,
  removeBlockedDomain,
  requestRemoveBlockedDomain,
  cancelRemoveBlockedDomain,
  addContentFilter,
  removeContentFilter,
  requestRemoveContentFilter,
  cancelRemoveContentFilter,
  importBlockSettings,
  setBlockYoutubeShorts,
  syncDnrRulesOnStartup,
} from "../../background/blockManager";
import { DEFAULT_BLOCK_SETTINGS, REMOVAL_DELAY_MS } from "../../shared/constants";

const mockGet = chrome.storage.local.get as ReturnType<typeof vi.fn>;
const mockSet = chrome.storage.local.set as ReturnType<typeof vi.fn>;
const mockUpdateDnr = chrome.declarativeNetRequest.updateDynamicRules as ReturnType<typeof vi.fn>;
const mockGetDnr = chrome.declarativeNetRequest.getDynamicRules as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockGet.mockResolvedValue({});
  mockSet.mockResolvedValue(undefined);
  mockUpdateDnr.mockResolvedValue(undefined);
  mockGetDnr.mockResolvedValue([]);
});

describe("addBlockedDomain", () => {
  it("assigns ruleId 1 to the first domain", async () => {
    const updated = await addBlockedDomain("facebook.com");
    expect(updated.blockedDomains).toHaveLength(1);
    expect(updated.blockedDomains[0].ruleId).toBe(1);
    expect(updated.blockedDomains[0].hostname).toBe("facebook.com");
  });

  it("calls updateDynamicRules with correct rule", async () => {
    await addBlockedDomain("facebook.com");
    expect(mockUpdateDnr).toHaveBeenCalledWith({
      addRules: [
        expect.objectContaining({
          id: 1,
          condition: expect.objectContaining({ requestDomains: ["facebook.com"] }),
        }),
      ],
      removeRuleIds: [],
    });
  });

  it("assigns incrementing ruleIds for subsequent domains", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0 }],
      },
    });
    const updated = await addBlockedDomain("twitter.com");
    expect(updated.blockedDomains.find((d) => d.hostname === "twitter.com")?.ruleId).toBe(2);
  });

  it("is idempotent: does not add duplicate domain", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0 }],
      },
    });
    const updated = await addBlockedDomain("facebook.com");
    expect(updated.blockedDomains).toHaveLength(1);
    expect(mockUpdateDnr).not.toHaveBeenCalled();
  });

  it("persists updated settings to storage", async () => {
    await addBlockedDomain("example.com");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        blockSettings: expect.objectContaining({
          blockedDomains: [expect.objectContaining({ hostname: "example.com" })],
        }),
      })
    );
  });
});

describe("requestRemoveBlockedDomain / cancelRemoveBlockedDomain", () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0, removalRequestedAt: null }],
      },
    });
  });

  it("stamps removalRequestedAt on request", async () => {
    const updated = await requestRemoveBlockedDomain("facebook.com");
    expect(updated.blockedDomains[0].removalRequestedAt).toEqual(expect.any(Number));
  });

  it("is no-op when domain not found", async () => {
    const updated = await requestRemoveBlockedDomain("notblocked.com");
    expect(updated.blockedDomains[0].removalRequestedAt).toBeNull();
  });

  it("clears removalRequestedAt on cancel", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0, removalRequestedAt: Date.now() }],
      },
    });
    const updated = await cancelRemoveBlockedDomain("facebook.com");
    expect(updated.blockedDomains[0].removalRequestedAt).toBeNull();
  });
});

describe("removeBlockedDomain", () => {
  it("is no-op when removal was never requested", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0, removalRequestedAt: null }],
      },
    });
    const updated = await removeBlockedDomain("facebook.com");
    expect(updated.blockedDomains).toHaveLength(1);
    expect(mockUpdateDnr).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("is no-op when the delay hasn't elapsed yet", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0, removalRequestedAt: Date.now() }],
      },
    });
    const updated = await removeBlockedDomain("facebook.com");
    expect(updated.blockedDomains).toHaveLength(1);
    expect(mockUpdateDnr).not.toHaveBeenCalled();
  });

  it("removes domain from settings once the delay has elapsed", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        blockedDomains: [
          { hostname: "facebook.com", ruleId: 1, addedAt: 0, removalRequestedAt: Date.now() - REMOVAL_DELAY_MS - 1000 },
        ],
      },
    });
    const updated = await removeBlockedDomain("facebook.com");
    expect(updated.blockedDomains).toHaveLength(0);
  });

  it("calls updateDynamicRules with correct removeRuleIds once the delay has elapsed", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        blockedDomains: [
          { hostname: "facebook.com", ruleId: 1, addedAt: 0, removalRequestedAt: Date.now() - REMOVAL_DELAY_MS - 1000 },
        ],
      },
    });
    await removeBlockedDomain("facebook.com");
    expect(mockUpdateDnr).toHaveBeenCalledWith({ addRules: [], removeRuleIds: [1] });
  });

  it("is no-op when domain not found", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0, removalRequestedAt: null }],
      },
    });
    const updated = await removeBlockedDomain("notblocked.com");
    expect(updated.blockedDomains).toHaveLength(1);
    expect(mockUpdateDnr).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe("addContentFilter", () => {
  it("adds a filter with correct platform and keyword", async () => {
    const updated = await addContentFilter("youtube", "crypto");
    expect(updated.contentFilters).toHaveLength(1);
    expect(updated.contentFilters[0]).toMatchObject({ platform: "youtube", keyword: "crypto" });
  });

  it("assigns a non-empty id", async () => {
    const updated = await addContentFilter("generic", "test");
    expect(updated.contentFilters[0].id).toBeTruthy();
  });

  it("trims whitespace from keyword", async () => {
    const updated = await addContentFilter("youtube", "  league of legends  ");
    expect(updated.contentFilters[0].keyword).toBe("league of legends");
  });

  it("does not call updateDynamicRules", async () => {
    await addContentFilter("generic", "casino");
    expect(mockUpdateDnr).not.toHaveBeenCalled();
  });
});

describe("requestRemoveContentFilter / cancelRemoveContentFilter", () => {
  const FILTER_ID = "test-uuid-1234";

  beforeEach(() => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        contentFilters: [{ id: FILTER_ID, platform: "youtube", keyword: "test", addedAt: 0, removalRequestedAt: null }],
      },
    });
  });

  it("stamps removalRequestedAt on request", async () => {
    const updated = await requestRemoveContentFilter(FILTER_ID);
    expect(updated.contentFilters[0].removalRequestedAt).toEqual(expect.any(Number));
  });

  it("clears removalRequestedAt on cancel", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        contentFilters: [{ id: FILTER_ID, platform: "youtube", keyword: "test", addedAt: 0, removalRequestedAt: Date.now() }],
      },
    });
    const updated = await cancelRemoveContentFilter(FILTER_ID);
    expect(updated.contentFilters[0].removalRequestedAt).toBeNull();
  });
});

describe("removeContentFilter", () => {
  const FILTER_ID = "test-uuid-1234";

  it("is no-op when removal was never requested", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        contentFilters: [{ id: FILTER_ID, platform: "youtube", keyword: "test", addedAt: 0, removalRequestedAt: null }],
      },
    });
    const updated = await removeContentFilter(FILTER_ID);
    expect(updated.contentFilters).toHaveLength(1);
  });

  it("is no-op when the delay hasn't elapsed yet", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        contentFilters: [{ id: FILTER_ID, platform: "youtube", keyword: "test", addedAt: 0, removalRequestedAt: Date.now() }],
      },
    });
    const updated = await removeContentFilter(FILTER_ID);
    expect(updated.contentFilters).toHaveLength(1);
  });

  it("removes filter by id once the delay has elapsed", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        contentFilters: [
          { id: FILTER_ID, platform: "youtube", keyword: "test", addedAt: 0, removalRequestedAt: Date.now() - REMOVAL_DELAY_MS - 1000 },
        ],
      },
    });
    const updated = await removeContentFilter(FILTER_ID);
    expect(updated.contentFilters).toHaveLength(0);
  });

  it("is no-op for unknown id", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        contentFilters: [{ id: FILTER_ID, platform: "youtube", keyword: "test", addedAt: 0, removalRequestedAt: null }],
      },
    });
    const updated = await removeContentFilter("unknown-id");
    expect(updated.contentFilters).toHaveLength(1);
  });
});

describe("importBlockSettings", () => {
  /**
   * importBlockSettings does several sequential get→set round trips internally, so it needs a
   * mock that actually persists between calls (unlike the static mockResolvedValue used elsewhere).
   */
  function useStatefulStorage(initial: Partial<typeof DEFAULT_BLOCK_SETTINGS> = {}) {
    let stored = { ...DEFAULT_BLOCK_SETTINGS, ...initial };
    mockGet.mockImplementation(async () => ({ blockSettings: stored }));
    mockSet.mockImplementation(async (obj: Record<string, unknown>) => {
      stored = obj["blockSettings"] as typeof stored;
    });
  }

  it("adds new domains and filters", async () => {
    useStatefulStorage();
    const updated = await importBlockSettings({
      blockedDomains: [{ hostname: "facebook.com" }],
      contentFilters: [{ platform: "youtube", keyword: "crypto" }],
    });
    expect(updated.blockedDomains.map((d) => d.hostname)).toEqual(["facebook.com"]);
    expect(updated.contentFilters).toMatchObject([{ platform: "youtube", keyword: "crypto" }]);
  });

  it("skips domains already present", async () => {
    useStatefulStorage({
      blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0, removalRequestedAt: null }],
    });
    const updated = await importBlockSettings({ blockedDomains: [{ hostname: "facebook.com" }] });
    expect(updated.blockedDomains).toHaveLength(1);
  });

  it("skips filters that already exist for the same platform+keyword", async () => {
    useStatefulStorage({
      contentFilters: [{ id: "1", platform: "youtube", keyword: "crypto", addedAt: 0, removalRequestedAt: null }],
    });
    const updated = await importBlockSettings({ contentFilters: [{ platform: "youtube", keyword: "Crypto" }] });
    expect(updated.contentFilters).toHaveLength(1);
  });

  it("skips malformed entries", async () => {
    useStatefulStorage();
    const updated = await importBlockSettings({
      // @ts-expect-error deliberately malformed input
      blockedDomains: [{ hostname: "" }, {}],
      contentFilters: [{ platform: "youtube", keyword: "" }],
    });
    expect(updated.blockedDomains).toHaveLength(0);
    expect(updated.contentFilters).toHaveLength(0);
  });
});

describe("syncDnrRulesOnStartup", () => {
  it("re-adds missing rules", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0 }],
      },
    });
    mockGetDnr.mockResolvedValue([]);
    await syncDnrRulesOnStartup();
    expect(mockUpdateDnr).toHaveBeenCalledWith(
      expect.objectContaining({
        addRules: [expect.objectContaining({ id: 1 })],
      })
    );
  });

  it("skips rules already in DNR", async () => {
    mockGet.mockResolvedValue({
      blockSettings: {
        ...DEFAULT_BLOCK_SETTINGS,
        blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0 }],
      },
    });
    mockGetDnr.mockResolvedValue([{ id: 1 }]);
    await syncDnrRulesOnStartup();
    expect(mockUpdateDnr).not.toHaveBeenCalled();
  });

  it("removes stale DNR rules not in storage", async () => {
    mockGet.mockResolvedValue({ blockSettings: DEFAULT_BLOCK_SETTINGS });
    mockGetDnr.mockResolvedValue([{ id: 99 }]);
    await syncDnrRulesOnStartup();
    expect(mockUpdateDnr).toHaveBeenCalledWith(
      expect.objectContaining({ removeRuleIds: [99] })
    );
  });

  it("does nothing when storage and DNR are in sync", async () => {
    mockGet.mockResolvedValue({ blockSettings: DEFAULT_BLOCK_SETTINGS });
    mockGetDnr.mockResolvedValue([]);
    await syncDnrRulesOnStartup();
    expect(mockUpdateDnr).not.toHaveBeenCalled();
  });
});

describe("setBlockYoutubeShorts", () => {
  it("enables the toggle", async () => {
    mockGet.mockResolvedValue({ blockSettings: { ...DEFAULT_BLOCK_SETTINGS, blockYoutubeShorts: false } });
    const updated = await setBlockYoutubeShorts(true);
    expect(updated.blockYoutubeShorts).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ blockSettings: expect.objectContaining({ blockYoutubeShorts: true }) })
    );
  });

  it("disables the toggle", async () => {
    mockGet.mockResolvedValue({ blockSettings: { ...DEFAULT_BLOCK_SETTINGS, blockYoutubeShorts: true } });
    const updated = await setBlockYoutubeShorts(false);
    expect(updated.blockYoutubeShorts).toBe(false);
  });
});
