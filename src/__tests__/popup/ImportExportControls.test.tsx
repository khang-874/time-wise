import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ImportExportControls from "../../popup/components/block/ImportExportControls";
import { DEFAULT_BLOCK_SETTINGS } from "../../shared/constants";
import type { BlockSettings } from "../../shared/types";

function makeSettings(overrides: Partial<BlockSettings> = {}): BlockSettings {
  return { ...DEFAULT_BLOCK_SETTINGS, ...overrides };
}

function makeFile(content: unknown): File {
  return new File([JSON.stringify(content)], "block-list.json", { type: "application/json" });
}

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe("ImportExportControls", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let anchorClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    anchorClick = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(anchorClick);
  });

  it("downloads the current block list as JSON on Export", async () => {
    const onImport = vi.fn();
    render(
      <ImportExportControls
        blockSettings={makeSettings({
          blockedDomains: [{ hostname: "facebook.com", ruleId: 1, addedAt: 0, removalRequestedAt: null }],
          contentFilters: [{ id: "1", platform: "youtube", keyword: "crypto", addedAt: 0, removalRequestedAt: null }],
        })}
        onImport={onImport}
      />
    );
    fireEvent.click(screen.getByLabelText("Export block list"));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const text = await readBlobAsText(blob);
    expect(JSON.parse(text)).toEqual({
      version: 1,
      blockedDomains: [{ hostname: "facebook.com" }],
      contentFilters: [{ platform: "youtube", keyword: "crypto" }],
    });
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("imports a valid file and forwards sanitized entries", async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<ImportExportControls blockSettings={makeSettings()} onImport={onImport} />);
    const input = screen.getByLabelText("Choose block list file");
    const file = makeFile({
      version: 1,
      blockedDomains: [{ hostname: "reddit.com" }],
      contentFilters: [{ platform: "youtube", keyword: "gaming" }],
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(onImport).toHaveBeenCalledWith({
        blockedDomains: [{ hostname: "reddit.com" }],
        contentFilters: [{ platform: "youtube", keyword: "gaming" }],
      })
    );
  });

  it("filters out malformed entries before importing", async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<ImportExportControls blockSettings={makeSettings()} onImport={onImport} />);
    const input = screen.getByLabelText("Choose block list file");
    const file = makeFile({
      blockedDomains: [{ hostname: "reddit.com" }, {}, { hostname: 5 }],
      contentFilters: [{ platform: "unknown", keyword: "x" }, { keyword: "gaming" }],
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(onImport).toHaveBeenCalledWith({
        blockedDomains: [{ hostname: "reddit.com" }],
        contentFilters: [],
      })
    );
  });

  it("shows an error and does not import on invalid JSON", async () => {
    const onImport = vi.fn();
    render(<ImportExportControls blockSettings={makeSettings()} onImport={onImport} />);
    const input = screen.getByLabelText("Choose block list file");
    const file = new File(["not json"], "block-list.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/Could not read that file/)).toBeInTheDocument());
    expect(onImport).not.toHaveBeenCalled();
  });
});
