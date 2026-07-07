import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import BlockTab from "../../popup/components/block/BlockTab";
import { DEFAULT_BLOCK_SETTINGS, REMOVAL_DELAY_MS } from "../../shared/constants";
import type { BlockSettings } from "../../shared/types";

const mockSendMessage = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;

function makeSettings(overrides: Partial<BlockSettings> = {}): BlockSettings {
  return { ...DEFAULT_BLOCK_SETTINGS, ...overrides };
}

beforeEach(() => {
  mockSendMessage.mockResolvedValue({ type: "BLOCK_SETTINGS", payload: makeSettings() });
});

describe("BlockTab", () => {
  it("renders domain and filter sections", async () => {
    render(<BlockTab />);
    await waitFor(() => expect(screen.getByText("Blocked domains")).toBeInTheDocument());
    expect(screen.getByText("Content filters")).toBeInTheDocument();
  });

  it("shows empty state messages when no rules exist", async () => {
    render(<BlockTab />);
    await waitFor(() => expect(screen.getByText("No domains blocked")).toBeInTheDocument());
    expect(screen.getByText("No content filters")).toBeInTheDocument();
  });

  it("renders blocked domains from settings", async () => {
    mockSendMessage.mockResolvedValueOnce({
      type: "BLOCK_SETTINGS",
      payload: makeSettings({
        blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0, removalRequestedAt: null }],
      }),
    });
    render(<BlockTab />);
    await waitFor(() => expect(screen.getByText("facebook.com")).toBeInTheDocument());
  });

  it("renders content filters from settings", async () => {
    mockSendMessage.mockResolvedValueOnce({
      type: "BLOCK_SETTINGS",
      payload: makeSettings({
        contentFilters: [{ id: "1", platform: "youtube", keyword: "crypto", addedAt: 0, removalRequestedAt: null }],
      }),
    });
    render(<BlockTab />);
    await waitFor(() => expect(screen.getByText("crypto")).toBeInTheDocument());
  });

  describe("DomainBlocker", () => {
    it("sends ADD_BLOCKED_DOMAIN for a valid domain", async () => {
      mockSendMessage
        .mockResolvedValueOnce({ type: "BLOCK_SETTINGS", payload: makeSettings() }) // GET_BLOCK_SETTINGS
        .mockResolvedValueOnce({ type: "BLOCK_SETTINGS", payload: makeSettings() }); // ADD_BLOCKED_DOMAIN
      render(<BlockTab />);
      await waitFor(() => screen.getByLabelText("Domain to block"));
      fireEvent.change(screen.getByLabelText("Domain to block"), {
        target: { value: "reddit.com" },
      });
      fireEvent.click(screen.getByLabelText("Add domain"));
      await waitFor(() =>
        expect(mockSendMessage).toHaveBeenCalledWith({
          type: "ADD_BLOCKED_DOMAIN",
          payload: { hostname: "reddit.com" },
        })
      );
    });

    it("strips www. prefix before sending", async () => {
      mockSendMessage
        .mockResolvedValueOnce({ type: "BLOCK_SETTINGS", payload: makeSettings() })
        .mockResolvedValueOnce({ type: "BLOCK_SETTINGS", payload: makeSettings() });
      render(<BlockTab />);
      await waitFor(() => screen.getByLabelText("Domain to block"));
      fireEvent.change(screen.getByLabelText("Domain to block"), {
        target: { value: "www.reddit.com" },
      });
      fireEvent.click(screen.getByLabelText("Add domain"));
      await waitFor(() =>
        expect(mockSendMessage).toHaveBeenCalledWith({
          type: "ADD_BLOCKED_DOMAIN",
          payload: { hostname: "reddit.com" },
        })
      );
    });

    it("shows validation error for invalid domain", async () => {
      render(<BlockTab />);
      await waitFor(() => screen.getByLabelText("Domain to block"));
      fireEvent.change(screen.getByLabelText("Domain to block"), {
        target: { value: "not a domain!" },
      });
      fireEvent.click(screen.getByLabelText("Add domain"));
      await waitFor(() =>
        expect(screen.getByText(/valid domain/)).toBeInTheDocument()
      );
      expect(mockSendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "ADD_BLOCKED_DOMAIN" })
      );
    });

    it("requests removal when Unblock is clicked, then confirms once the delay has elapsed", async () => {
      mockSendMessage
        .mockResolvedValueOnce({
          type: "BLOCK_SETTINGS",
          payload: makeSettings({
            blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0, removalRequestedAt: null }],
          }),
        })
        .mockResolvedValueOnce({
          type: "BLOCK_SETTINGS",
          payload: makeSettings({
            blockedDomains: [
              {
                hostname: "facebook.com",
                ruleId: 1,
                addedAt: 0,
                removalRequestedAt: Date.now() - REMOVAL_DELAY_MS - 1000,
              },
            ],
          }),
        })
        .mockResolvedValueOnce({ type: "BLOCK_SETTINGS", payload: makeSettings() });
      render(<BlockTab />);
      await waitFor(() => screen.getByLabelText("Unblock facebook.com"));
      fireEvent.click(screen.getByLabelText("Unblock facebook.com"));
      await waitFor(() =>
        expect(mockSendMessage).toHaveBeenCalledWith({
          type: "REQUEST_REMOVE_BLOCKED_DOMAIN",
          payload: { hostname: "facebook.com" },
        })
      );
      await waitFor(() => screen.getByLabelText("Confirm remove facebook.com"));
      fireEvent.click(screen.getByLabelText("Confirm remove facebook.com"));
      await waitFor(() =>
        expect(mockSendMessage).toHaveBeenCalledWith({
          type: "REMOVE_BLOCKED_DOMAIN",
          payload: { hostname: "facebook.com" },
        })
      );
    });

    it("shows a countdown and Cancel while the removal delay is still pending", async () => {
      mockSendMessage
        .mockResolvedValueOnce({
          type: "BLOCK_SETTINGS",
          payload: makeSettings({
            blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0, removalRequestedAt: null }],
          }),
        })
        .mockResolvedValueOnce({
          type: "BLOCK_SETTINGS",
          payload: makeSettings({
            blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0, removalRequestedAt: Date.now() }],
          }),
        });
      render(<BlockTab />);
      await waitFor(() => screen.getByLabelText("Unblock facebook.com"));
      fireEvent.click(screen.getByLabelText("Unblock facebook.com"));
      await waitFor(() => screen.getByLabelText("Cancel removing facebook.com"));
      expect(screen.getByText(/Removing available in/)).toBeInTheDocument();
      expect(screen.queryByLabelText("Confirm remove facebook.com")).not.toBeInTheDocument();
    });
  });

  describe("ContentFilterList", () => {
    it("sends ADD_CONTENT_FILTER with platform and keyword", async () => {
      mockSendMessage
        .mockResolvedValueOnce({ type: "BLOCK_SETTINGS", payload: makeSettings() })
        .mockResolvedValueOnce({ type: "BLOCK_SETTINGS", payload: makeSettings() });
      render(<BlockTab />);
      await waitFor(() => screen.getByLabelText("Filter keyword"));
      fireEvent.change(screen.getByLabelText("Filter keyword"), {
        target: { value: "league of legends" },
      });
      fireEvent.click(screen.getByLabelText("Add filter"));
      await waitFor(() =>
        expect(mockSendMessage).toHaveBeenCalledWith({
          type: "ADD_CONTENT_FILTER",
          payload: { platform: "youtube", keyword: "league of legends" },
        })
      );
    });

    it("shows validation error for empty keyword", async () => {
      render(<BlockTab />);
      await waitFor(() => screen.getByLabelText("Add filter"));
      fireEvent.click(screen.getByLabelText("Add filter"));
      await waitFor(() =>
        expect(screen.getByText(/cannot be empty/)).toBeInTheDocument()
      );
    });

    it("requests removal when Remove is clicked, then confirms once the delay has elapsed", async () => {
      mockSendMessage
        .mockResolvedValueOnce({
          type: "BLOCK_SETTINGS",
          payload: makeSettings({
            contentFilters: [{ id: "filter-1", platform: "youtube", keyword: "crypto", addedAt: 0, removalRequestedAt: null }],
          }),
        })
        .mockResolvedValueOnce({
          type: "BLOCK_SETTINGS",
          payload: makeSettings({
            contentFilters: [
              {
                id: "filter-1",
                platform: "youtube",
                keyword: "crypto",
                addedAt: 0,
                removalRequestedAt: Date.now() - REMOVAL_DELAY_MS - 1000,
              },
            ],
          }),
        })
        .mockResolvedValueOnce({ type: "BLOCK_SETTINGS", payload: makeSettings() });
      render(<BlockTab />);
      await waitFor(() => screen.getByLabelText("Remove filter crypto"));
      fireEvent.click(screen.getByLabelText("Remove filter crypto"));
      await waitFor(() =>
        expect(mockSendMessage).toHaveBeenCalledWith({
          type: "REQUEST_REMOVE_CONTENT_FILTER",
          payload: { id: "filter-1" },
        })
      );
      await waitFor(() => screen.getByLabelText("Confirm remove filter crypto"));
      fireEvent.click(screen.getByLabelText("Confirm remove filter crypto"));
      await waitFor(() =>
        expect(mockSendMessage).toHaveBeenCalledWith({
          type: "REMOVE_CONTENT_FILTER",
          payload: { id: "filter-1" },
        })
      );
    });

    it("allows switching platform before adding a filter", async () => {
      mockSendMessage
        .mockResolvedValueOnce({ type: "BLOCK_SETTINGS", payload: makeSettings() })
        .mockResolvedValueOnce({ type: "BLOCK_SETTINGS", payload: makeSettings() });
      render(<BlockTab />);
      await waitFor(() => screen.getByLabelText("Platform"));
      fireEvent.change(screen.getByLabelText("Platform"), { target: { value: "generic" } });
      fireEvent.change(screen.getByLabelText("Filter keyword"), { target: { value: "gaming" } });
      fireEvent.click(screen.getByLabelText("Add filter"));
      await waitFor(() =>
        expect(mockSendMessage).toHaveBeenCalledWith({
          type: "ADD_CONTENT_FILTER",
          payload: { platform: "generic", keyword: "gaming" },
        })
      );
    });
  });

  describe("ShortsToggle", () => {
    it("reflects the current blockYoutubeShorts setting", async () => {
      mockSendMessage.mockResolvedValueOnce({
        type: "BLOCK_SETTINGS",
        payload: makeSettings({ blockYoutubeShorts: true }),
      });
      render(<BlockTab />);
      await waitFor(() => expect(screen.getByLabelText("Block YouTube Shorts")).toBeChecked());
    });

    it("sends SET_BLOCK_YOUTUBE_SHORTS when toggled off", async () => {
      mockSendMessage
        .mockResolvedValueOnce({ type: "BLOCK_SETTINGS", payload: makeSettings({ blockYoutubeShorts: true }) })
        .mockResolvedValueOnce({ type: "BLOCK_SETTINGS", payload: makeSettings({ blockYoutubeShorts: false }) });
      render(<BlockTab />);
      await waitFor(() => expect(screen.getByLabelText("Block YouTube Shorts")).toBeChecked());
      fireEvent.click(screen.getByLabelText("Block YouTube Shorts"));
      await waitFor(() =>
        expect(mockSendMessage).toHaveBeenCalledWith({
          type: "SET_BLOCK_YOUTUBE_SHORTS",
          payload: { enabled: false },
        })
      );
      await waitFor(() => expect(screen.getByLabelText("Block YouTube Shorts")).not.toBeChecked());
    });
  });
});
