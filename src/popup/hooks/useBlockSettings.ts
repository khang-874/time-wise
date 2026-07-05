import { useState, useEffect } from "react";
import type { BlockSettings, ContentFilterPlatform } from "../../shared/types";
import { DEFAULT_BLOCK_SETTINGS } from "../../shared/constants";
import { sendMessage } from "../../shared/messages";

export function useBlockSettings() {
  const [blockSettings, setBlockSettings] = useState<BlockSettings>(DEFAULT_BLOCK_SETTINGS);

  useEffect(() => {
    sendMessage({ type: "GET_BLOCK_SETTINGS" }).then((resp) => {
      if (resp.type === "BLOCK_SETTINGS") setBlockSettings(resp.payload);
    });
  }, []);

  const addDomain = async (hostname: string) => {
    const resp = await sendMessage({ type: "ADD_BLOCKED_DOMAIN", payload: { hostname } });
    if (resp.type === "BLOCK_SETTINGS") setBlockSettings(resp.payload);
  };

  const removeDomain = async (hostname: string) => {
    const resp = await sendMessage({ type: "REMOVE_BLOCKED_DOMAIN", payload: { hostname } });
    if (resp.type === "BLOCK_SETTINGS") setBlockSettings(resp.payload);
  };

  const requestRemoveDomain = async (hostname: string) => {
    const resp = await sendMessage({ type: "REQUEST_REMOVE_BLOCKED_DOMAIN", payload: { hostname } });
    if (resp.type === "BLOCK_SETTINGS") setBlockSettings(resp.payload);
  };

  const cancelRemoveDomain = async (hostname: string) => {
    const resp = await sendMessage({ type: "CANCEL_REMOVE_BLOCKED_DOMAIN", payload: { hostname } });
    if (resp.type === "BLOCK_SETTINGS") setBlockSettings(resp.payload);
  };

  const addFilter = async (platform: ContentFilterPlatform, keyword: string) => {
    const resp = await sendMessage({
      type: "ADD_CONTENT_FILTER",
      payload: { platform, keyword },
    });
    if (resp.type === "BLOCK_SETTINGS") setBlockSettings(resp.payload);
  };

  const removeFilter = async (id: string) => {
    const resp = await sendMessage({ type: "REMOVE_CONTENT_FILTER", payload: { id } });
    if (resp.type === "BLOCK_SETTINGS") setBlockSettings(resp.payload);
  };

  const requestRemoveFilter = async (id: string) => {
    const resp = await sendMessage({ type: "REQUEST_REMOVE_CONTENT_FILTER", payload: { id } });
    if (resp.type === "BLOCK_SETTINGS") setBlockSettings(resp.payload);
  };

  const cancelRemoveFilter = async (id: string) => {
    const resp = await sendMessage({ type: "CANCEL_REMOVE_CONTENT_FILTER", payload: { id } });
    if (resp.type === "BLOCK_SETTINGS") setBlockSettings(resp.payload);
  };

  const importSettings = async (payload: {
    blockedDomains?: { hostname: string }[];
    contentFilters?: { platform: ContentFilterPlatform; keyword: string }[];
  }) => {
    const resp = await sendMessage({ type: "IMPORT_BLOCK_SETTINGS", payload });
    if (resp.type === "BLOCK_SETTINGS") setBlockSettings(resp.payload);
  };

  return {
    blockSettings,
    addDomain,
    removeDomain,
    requestRemoveDomain,
    cancelRemoveDomain,
    addFilter,
    removeFilter,
    requestRemoveFilter,
    cancelRemoveFilter,
    importSettings,
  };
}
