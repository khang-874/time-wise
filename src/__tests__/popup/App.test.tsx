import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../../popup/App";
import { DEFAULT_POMODORO_STATE, DEFAULT_SETTINGS } from "../../shared/constants";

const mockSendMessage = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;
const mockStorageGet = chrome.storage.local.get as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockSendMessage.mockImplementation(async (msg: { type: string }) => {
    if (msg.type === "FLUSH_TIME") return { type: "OK" };
    if (msg.type === "GET_USAGE") return { type: "USAGE", payload: {} };
    if (msg.type === "GET_POMODORO_STATE") {
      return { type: "POMODORO_STATE", payload: DEFAULT_POMODORO_STATE };
    }
    return { type: "OK" };
  });
  mockStorageGet.mockResolvedValue({ settings: DEFAULT_SETTINGS });
});

describe("App", () => {
  it("renders Stats tab by default", async () => {
    render(<App />);
    await act(async () => {});
    expect(screen.getByRole("tab", { name: "Stats" })).toHaveAttribute("aria-selected", "true");
  });

  it("switches to Pomodoro tab", async () => {
    render(<App />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("tab", { name: "Pomodoro" }));
    await waitFor(() => expect(screen.getByText("Focus")).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "Pomodoro" })).toHaveAttribute("aria-selected", "true");
  });

  it("switches back to Stats tab", async () => {
    render(<App />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("tab", { name: "Pomodoro" }));
    await waitFor(() => screen.getByText("Focus"));
    fireEvent.click(screen.getByRole("tab", { name: "Stats" }));
    await waitFor(() => expect(screen.queryByText("Focus")).not.toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "Stats" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("TabBar", () => {
  it("renders both tab buttons", async () => {
    render(<App />);
    await act(async () => {});
    expect(screen.getByRole("tab", { name: "Stats" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pomodoro" })).toBeInTheDocument();
  });
});
