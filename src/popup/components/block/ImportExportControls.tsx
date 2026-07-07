import { useRef, useState } from "react";
import type { BlockSettings, ContentFilterPlatform } from "../../../shared/types";

interface ImportPayload {
  blockedDomains?: { hostname: string }[];
  contentFilters?: { platform: ContentFilterPlatform; keyword: string }[];
}

interface Props {
  blockSettings: BlockSettings;
  onImport: (payload: ImportPayload) => Promise<void>;
}

function isHostnameEntry(value: unknown): value is { hostname: string } {
  return typeof value === "object" && value !== null && typeof (value as { hostname?: unknown }).hostname === "string";
}

function isFilterEntry(value: unknown): value is { platform: ContentFilterPlatform; keyword: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { platform?: unknown; keyword?: unknown };
  return typeof v.keyword === "string" && (v.platform === "youtube" || v.platform === "generic");
}

export default function ImportExportControls({ blockSettings, onImport }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const handleExport = () => {
    const payload = {
      version: 1,
      blockedDomains: blockSettings.blockedDomains.map((d) => ({ hostname: d.hostname })),
      contentFilters: blockSettings.contentFilters.map((f) => ({ platform: f.platform, keyword: f.keyword })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "timewise-block-list.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    setError("");
    fileInputRef.current?.click();
  };

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await readFileAsText(file));
      const raw = parsed as { blockedDomains?: unknown; contentFilters?: unknown };
      const blockedDomains = Array.isArray(raw.blockedDomains) ? raw.blockedDomains.filter(isHostnameEntry) : [];
      const contentFilters = Array.isArray(raw.contentFilters) ? raw.contentFilters.filter(isFilterEntry) : [];
      await onImport({ blockedDomains, contentFilters });
    } catch {
      setError("Could not read that file — expected a TimeWise block list export.");
    }
  };

  return (
    <section className="px-4 py-3 border-b border-gray-100">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">Block list</div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            aria-label="Export block list"
            className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded px-2 py-1"
          >
            Export
          </button>
          <button
            onClick={handleImportClick}
            aria-label="Import block list"
            className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded px-2 py-1"
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Choose block list file"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </section>
  );
}
