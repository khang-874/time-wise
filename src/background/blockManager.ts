import { getBlockSettings, setBlockSettings } from "../shared/storage";
import { REMOVAL_DELAY_MS } from "../shared/constants";
import type { BlockedDomain, BlockSettings, ContentFilter, ContentFilterPlatform } from "../shared/types";

function buildDnrRule(domain: BlockedDomain): chrome.declarativeNetRequest.Rule {
  return {
    id: domain.ruleId,
    priority: 1,
    action: {
      type: "redirect" as chrome.declarativeNetRequest.RuleActionType,
      redirect: { extensionPath: "/blocked.html" },
    },
    condition: {
      requestDomains: [domain.hostname],
      resourceTypes: ["main_frame" as chrome.declarativeNetRequest.ResourceType],
    },
  };
}

/**
 * Called once on SW startup. Re-adds DNR rules missing from Chrome (e.g. after extension update)
 * and removes stale rules that have no corresponding entry in storage.
 */
export async function syncDnrRulesOnStartup(): Promise<void> {
  const settings = await getBlockSettings();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = new Set(existing.map((r) => r.id));
  const settingRuleIds = new Set(settings.blockedDomains.map((d) => d.ruleId));

  const staleIds = existing.map((r) => r.id).filter((id) => !settingRuleIds.has(id));
  const toAdd = settings.blockedDomains
    .filter((d) => !existingIds.has(d.ruleId))
    .map(buildDnrRule);

  if (staleIds.length > 0 || toAdd.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: toAdd,
      removeRuleIds: staleIds,
    });
  }
}

/** Adds a domain to the blocklist. No-op if already present. Returns updated settings. */
export async function addBlockedDomain(hostname: string): Promise<BlockSettings> {
  const settings = await getBlockSettings();
  if (settings.blockedDomains.some((d) => d.hostname === hostname)) return settings;

  const ruleId =
    settings.blockedDomains.length > 0
      ? Math.max(...settings.blockedDomains.map((d) => d.ruleId)) + 1
      : 1;

  const domain: BlockedDomain = { hostname, ruleId, addedAt: Date.now(), removalRequestedAt: null };
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [buildDnrRule(domain)],
    removeRuleIds: [],
  });

  const updated: BlockSettings = {
    ...settings,
    blockedDomains: [...settings.blockedDomains, domain],
  };
  await setBlockSettings(updated);
  return updated;
}

/** Marks a domain as pending removal, starting the {@link REMOVAL_DELAY_MS} wait. No-op if not found. */
export async function requestRemoveBlockedDomain(hostname: string): Promise<BlockSettings> {
  const settings = await getBlockSettings();
  const target = settings.blockedDomains.find((d) => d.hostname === hostname);
  if (!target) return settings;

  const updated: BlockSettings = {
    ...settings,
    blockedDomains: settings.blockedDomains.map((d) =>
      d.hostname === hostname ? { ...d, removalRequestedAt: Date.now() } : d
    ),
  };
  await setBlockSettings(updated);
  return updated;
}

/** Clears a pending removal request for a domain. No-op if not found. */
export async function cancelRemoveBlockedDomain(hostname: string): Promise<BlockSettings> {
  const settings = await getBlockSettings();
  const target = settings.blockedDomains.find((d) => d.hostname === hostname);
  if (!target) return settings;

  const updated: BlockSettings = {
    ...settings,
    blockedDomains: settings.blockedDomains.map((d) =>
      d.hostname === hostname ? { ...d, removalRequestedAt: null } : d
    ),
  };
  await setBlockSettings(updated);
  return updated;
}

/**
 * Removes a domain from the blocklist. No-op if not found, or if removal was never requested,
 * or if {@link REMOVAL_DELAY_MS} hasn't elapsed since the removal was requested — this friction
 * is intentional so a domain can't be unblocked on impulse.
 */
export async function removeBlockedDomain(hostname: string): Promise<BlockSettings> {
  const settings = await getBlockSettings();
  const target = settings.blockedDomains.find((d) => d.hostname === hostname);
  if (!target) return settings;
  if (!target.removalRequestedAt || Date.now() - target.removalRequestedAt < REMOVAL_DELAY_MS) {
    return settings;
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [],
    removeRuleIds: [target.ruleId],
  });

  const updated: BlockSettings = {
    ...settings,
    blockedDomains: settings.blockedDomains.filter((d) => d.hostname !== hostname),
  };
  await setBlockSettings(updated);
  return updated;
}

/** Adds a content filter. Returns updated settings. */
export async function addContentFilter(
  platform: ContentFilterPlatform,
  keyword: string
): Promise<BlockSettings> {
  const settings = await getBlockSettings();
  const filter: ContentFilter = {
    id: crypto.randomUUID(),
    platform,
    keyword: keyword.trim(),
    addedAt: Date.now(),
    removalRequestedAt: null,
  };
  const updated: BlockSettings = {
    ...settings,
    contentFilters: [...settings.contentFilters, filter],
  };
  await setBlockSettings(updated);
  return updated;
}

/** Marks a content filter as pending removal, starting the {@link REMOVAL_DELAY_MS} wait. No-op if not found. */
export async function requestRemoveContentFilter(id: string): Promise<BlockSettings> {
  const settings = await getBlockSettings();
  const updated: BlockSettings = {
    ...settings,
    contentFilters: settings.contentFilters.map((f) =>
      f.id === id ? { ...f, removalRequestedAt: Date.now() } : f
    ),
  };
  await setBlockSettings(updated);
  return updated;
}

/** Clears a pending removal request for a content filter. No-op if not found. */
export async function cancelRemoveContentFilter(id: string): Promise<BlockSettings> {
  const settings = await getBlockSettings();
  const updated: BlockSettings = {
    ...settings,
    contentFilters: settings.contentFilters.map((f) =>
      f.id === id ? { ...f, removalRequestedAt: null } : f
    ),
  };
  await setBlockSettings(updated);
  return updated;
}

/**
 * Removes a content filter by id. No-op if not found, or if removal was never requested,
 * or if {@link REMOVAL_DELAY_MS} hasn't elapsed since the removal was requested.
 */
export async function removeContentFilter(id: string): Promise<BlockSettings> {
  const settings = await getBlockSettings();
  const target = settings.contentFilters.find((f) => f.id === id);
  if (!target) return settings;
  if (!target.removalRequestedAt || Date.now() - target.removalRequestedAt < REMOVAL_DELAY_MS) {
    return settings;
  }

  const updated: BlockSettings = {
    ...settings,
    contentFilters: settings.contentFilters.filter((f) => f.id !== id),
  };
  await setBlockSettings(updated);
  return updated;
}

/**
 * Merges an imported block list into the current settings. Duplicates (by hostname, or by
 * platform+keyword for filters) are skipped rather than replacing existing entries, so importing
 * a shared list never wipes out what's already configured.
 */
export async function importBlockSettings(imported: {
  blockedDomains?: { hostname: string }[];
  contentFilters?: { platform: ContentFilterPlatform; keyword: string }[];
}): Promise<BlockSettings> {
  for (const d of imported.blockedDomains ?? []) {
    const hostname = d?.hostname?.trim().toLowerCase();
    if (hostname) await addBlockedDomain(hostname);
  }

  let settings = await getBlockSettings();
  for (const f of imported.contentFilters ?? []) {
    const keyword = f?.keyword?.trim();
    if (!keyword) continue;
    const exists = settings.contentFilters.some(
      (existing) => existing.platform === f.platform && existing.keyword.toLowerCase() === keyword.toLowerCase()
    );
    if (exists) continue;
    settings = await addContentFilter(f.platform, keyword);
  }
  return settings;
}
