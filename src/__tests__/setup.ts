import "@testing-library/jest-dom";
import { vi } from "vitest";

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      onChanged: { addListener: vi.fn() },
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    lastError: null,
  },
  tabs: {
    get: vi.fn(),
    query: vi.fn(),
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
  },
  windows: {
    onFocusChanged: { addListener: vi.fn() },
    WINDOW_ID_NONE: -1,
  },
  idle: {
    setDetectionInterval: vi.fn(),
    onStateChanged: { addListener: vi.fn() },
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: { addListener: vi.fn() },
  },
  notifications: {
    create: vi.fn(),
  },
};

vi.stubGlobal("chrome", chromeMock);

beforeEach(() => {
  vi.clearAllMocks();
  chromeMock.runtime.lastError = null;
});
