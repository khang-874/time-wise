/**
 * @file Registers and dispatches all messages from the popup to the service worker.
 *
 * @remarks
 * The listener returns `true` to keep the message channel open for async responses,
 * as required by the Chrome Extensions API when `sendResponse` is called asynchronously.
 */

import type { PopupRequest, PopupResponse } from "../shared/types";
import { getUsage, setSettings } from "../shared/storage";
import {
  startTimer,
  pauseTimer,
  resetTimer,
  skipPhase,
  getCurrentState,
  updateSettings,
} from "./pomodoroTimer";
import { handleFlushAlarm } from "./timeTracker";

/**
 * Registers the single `chrome.runtime.onMessage` listener that routes all
 * {@link PopupRequest} messages to the appropriate handler function.
 *
 * Call once during service worker initialisation (`src/background/index.ts`).
 */
export function registerMessageHandler(): void {
  chrome.runtime.onMessage.addListener(
    (
      request: PopupRequest,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: PopupResponse) => void
    ) => {
      handleMessage(request).then(sendResponse).catch((err) => {
        sendResponse({ type: "ERROR", message: String(err) });
      });
      return true; // keeps the message channel open for async response
    }
  );
}

/**
 * Dispatches a typed {@link PopupRequest} to the correct handler and returns a typed {@link PopupResponse}.
 */
async function handleMessage(request: PopupRequest): Promise<PopupResponse> {
  switch (request.type) {
    case "GET_POMODORO_STATE": {
      const state = await getCurrentState();
      return { type: "POMODORO_STATE", payload: state };
    }
    case "POMODORO_START": {
      const state = await startTimer();
      return { type: "POMODORO_STATE", payload: state };
    }
    case "POMODORO_PAUSE": {
      const state = await pauseTimer();
      return { type: "POMODORO_STATE", payload: state };
    }
    case "POMODORO_RESET": {
      const state = await resetTimer();
      return { type: "POMODORO_STATE", payload: state };
    }
    case "POMODORO_SKIP": {
      const state = await skipPhase();
      return { type: "POMODORO_STATE", payload: state };
    }
    case "UPDATE_SETTINGS": {
      await setSettings(request.payload);
      const state = await updateSettings(request.payload);
      return { type: "POMODORO_STATE", payload: state };
    }
    case "GET_USAGE": {
      const usage = await getUsage(request.payload.dateKey);
      return { type: "USAGE", payload: usage };
    }
    case "FLUSH_TIME": {
      await handleFlushAlarm();
      return { type: "OK" };
    }
  }
}
