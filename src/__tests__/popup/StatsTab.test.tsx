import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import StatsTab from "../../popup/components/stats/StatsTab";

const mockSendMessage = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;

const MOCK_USAGE = {
  "github.com": 3600,
  "youtube.com": 1800,
  "google.com": 600,
};

beforeEach(() => {
  mockSendMessage.mockImplementation(async (msg: { type: string }) => {
    if (msg.type === "FLUSH_TIME") return { type: "OK" };
    if (msg.type === "GET_USAGE") return { type: "USAGE", payload: MOCK_USAGE };
    return { type: "OK" };
  });
});

describe("StatsTab", () => {
  it("renders loading state initially", async () => {
    render(<StatsTab />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    // flush async state updates to avoid act() warning
    await act(async () => {});
  });

  it("renders sites sorted by usage", async () => {
    render(<StatsTab />);
    await waitFor(() => expect(screen.getByText("github.com")).toBeInTheDocument());

    const sites = screen.getAllByText(/\.com/);
    expect(sites[0].textContent).toContain("github.com");
    expect(sites[1].textContent).toContain("youtube.com");
    expect(sites[2].textContent).toContain("google.com");
  });

  it("shows 'Today' label for today's date", async () => {
    render(<StatsTab />);
    // waitFor until loading clears and header renders
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("shows empty state when no data", async () => {
    mockSendMessage.mockImplementation(async (msg: { type: string }) => {
      if (msg.type === "FLUSH_TIME") return { type: "OK" };
      if (msg.type === "GET_USAGE") return { type: "USAGE", payload: {} };
      return { type: "OK" };
    });

    render(<StatsTab />);
    await waitFor(() =>
      expect(screen.getByText("No browsing data for this day")).toBeInTheDocument()
    );
  });

  it("next day button is disabled when viewing today", async () => {
    render(<StatsTab />);
    await waitFor(() => screen.getByText("Today"));
    const nextBtn = screen.getByLabelText("Next day");
    expect(nextBtn).toBeDisabled();
  });

  it("prev day navigates to yesterday", async () => {
    render(<StatsTab />);
    await waitFor(() => screen.getByText("Today"));
    fireEvent.click(screen.getByLabelText("Previous day"));
    await waitFor(() => expect(screen.getByText("Yesterday")).toBeInTheDocument());
  });

  it("next day button is enabled after going to previous day", async () => {
    render(<StatsTab />);
    await waitFor(() => screen.getByText("Today"));
    fireEvent.click(screen.getByLabelText("Previous day"));
    await waitFor(() => screen.getByText("Yesterday"));
    expect(screen.getByLabelText("Next day")).not.toBeDisabled();
  });

  it("shows total time in header", async () => {
    render(<StatsTab />);
    await waitFor(() => screen.getByText(/total/));
    // 3600 + 1800 + 600 = 6000s = 1h 40m
    expect(screen.getByText(/1h 40m total/)).toBeInTheDocument();
  });
});
