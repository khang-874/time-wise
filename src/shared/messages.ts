import type { PopupRequest, PopupResponse } from "./types";

export function sendMessage(request: PopupRequest): Promise<PopupResponse> {
  return chrome.runtime.sendMessage(request);
}
