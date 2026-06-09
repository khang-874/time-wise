import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PomodoroTab from "../../popup/components/pomodoro/PomodoroTab";
import { DEFAULT_POMODORO_STATE, DEFAULT_SETTINGS } from "../../shared/constants";
import type { PomodoroState } from "../../shared/types";

const mockSendMessage = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;
const mockStorageGet = chrome.storage.local.get as ReturnType<typeof vi.fn>;

function makeState(overrides: Partial<PomodoroState> = {}): PomodoroState {
  return { ...DEFAULT_POMODORO_STATE, ...overrides };
}

beforeEach(() => {
  mockStorageGet.mockResolvedValue({ settings: DEFAULT_SETTINGS });
  mockSendMessage.mockImplementation(async (msg: { type: string }) => {
    if (msg.type === "GET_POMODORO_STATE") {
      return { type: "POMODORO_STATE", payload: makeState() };
    }
    if (msg.type === "POMODORO_START") {
      return { type: "POMODORO_STATE", payload: makeState({ running: true, startedAt: Date.now() }) };
    }
    if (msg.type === "POMODORO_PAUSE") {
      return { type: "POMODORO_STATE", payload: makeState({ running: false }) };
    }
    return { type: "POMODORO_STATE", payload: makeState() };
  });
});

describe("PomodoroTab", () => {
  it("renders initial 25:00 countdown", async () => {
    render(<PomodoroTab />);
    await waitFor(() => expect(screen.getByText("25:00")).toBeInTheDocument());
  });

  it("shows Focus phase label", async () => {
    render(<PomodoroTab />);
    await waitFor(() => expect(screen.getByText("Focus")).toBeInTheDocument());
  });

  it("shows Start button when not running", async () => {
    render(<PomodoroTab />);
    await waitFor(() => expect(screen.getByLabelText("Start timer")).toBeInTheDocument());
  });

  it("shows Pause button after starting", async () => {
    render(<PomodoroTab />);
    await waitFor(() => screen.getByLabelText("Start timer"));
    fireEvent.click(screen.getByLabelText("Start timer"));
    await waitFor(() => expect(screen.getByLabelText("Pause timer")).toBeInTheDocument());
  });

  it("shows session counter", async () => {
    render(<PomodoroTab />);
    await waitFor(() => expect(screen.getByText("0")).toBeInTheDocument());
    expect(screen.getByText("Pomodoros")).toBeInTheDocument();
  });

  it("sends POMODORO_RESET message on reset", async () => {
    render(<PomodoroTab />);
    await waitFor(() => screen.getByLabelText("Start timer"));
    fireEvent.click(screen.getByLabelText("Reset timer"));
    await waitFor(() =>
      expect(mockSendMessage).toHaveBeenCalledWith({ type: "POMODORO_RESET" })
    );
  });

  it("sends POMODORO_SKIP message on skip", async () => {
    render(<PomodoroTab />);
    await waitFor(() => screen.getByLabelText("Start timer"));
    fireEvent.click(screen.getByLabelText("Skip phase"));
    await waitFor(() =>
      expect(mockSendMessage).toHaveBeenCalledWith({ type: "POMODORO_SKIP" })
    );
  });

  it("toggles settings panel", async () => {
    render(<PomodoroTab />);
    await waitFor(() => screen.getByLabelText("Toggle settings"));
    expect(screen.queryByText("Focus (min)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Toggle settings"));
    expect(screen.getByText("Focus (min)")).toBeInTheDocument();
  });
});
