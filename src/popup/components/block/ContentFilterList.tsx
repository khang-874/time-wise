import { useState } from "react";
import type { ContentFilter, ContentFilterPlatform } from "../../../shared/types";

interface Props {
  filters: ContentFilter[];
  onAdd: (platform: ContentFilterPlatform, keyword: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

const PLATFORMS: { value: ContentFilterPlatform; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "reddit", label: "Reddit" },
  { value: "generic", label: "Any site" },
];

export default function ContentFilterList({ filters, onAdd, onRemove }: Props) {
  const [platform, setPlatform] = useState<ContentFilterPlatform>("youtube");
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!keyword.trim()) {
      setError("Keyword cannot be empty");
      return;
    }
    setError("");
    await onAdd(platform, keyword.trim());
    setKeyword("");
  };

  const platformLabel = (p: ContentFilterPlatform) =>
    PLATFORMS.find((x) => x.value === p)?.label ?? p;

  return (
    <section className="px-4 py-3">
      <div className="text-sm font-semibold text-gray-700 mb-2">Content filters</div>
      <div className="flex gap-2 mb-1">
        <select
          aria-label="Platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as ContentFilterPlatform)}
          className="border border-gray-200 rounded px-2 py-1 text-sm"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          aria-label="Filter keyword"
          placeholder="keyword"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm"
        />
        <button
          onClick={handleAdd}
          aria-label="Add filter"
          className="px-3 py-1 text-sm text-white bg-indigo-500 rounded hover:bg-indigo-600"
        >
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
      {filters.length === 0 && (
        <p className="text-xs text-gray-400">No content filters</p>
      )}
      <ul>
        {filters.map((f) => (
          <li key={f.id} className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-700">
              <span className="text-gray-400 mr-1">{platformLabel(f.platform)}:</span>
              {f.keyword}
            </span>
            <button
              onClick={() => onRemove(f.id)}
              aria-label={`Remove filter ${f.keyword}`}
              className="text-xs text-gray-400 hover:text-red-500 ml-2 shrink-0"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
