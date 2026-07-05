import { getBlockSettings, setBlockSettings } from "../shared/storage";
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

  const domain: BlockedDomain = { hostname, ruleId, addedAt: Date.now() };
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

/** Removes a domain from the blocklist. No-op if not found. Returns updated settings. */
export async function removeBlockedDomain(hostname: string): Promise<BlockSettings> {
  const settings = await getBlockSettings();
  const target = settings.blockedDomains.find((d) => d.hostname === hostname);
  if (!target) return settings;

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
  };
  const updated: BlockSettings = {
    ...settings,
    contentFilters: [...settings.contentFilters, filter],
  };
  await setBlockSettings(updated);
  return updated;
}

/** Removes a content filter by id. Returns updated settings. */
export async function removeContentFilter(id: string): Promise<BlockSettings> {
  const settings = await getBlockSettings();
  const updated: BlockSettings = {
    ...settings,
    contentFilters: settings.contentFilters.filter((f) => f.id !== id),
  };
  await setBlockSettings(updated);
  return updated;
}
