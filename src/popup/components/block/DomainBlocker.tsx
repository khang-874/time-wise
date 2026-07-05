import { useState } from "react";
import type { BlockedDomain } from "../../../shared/types";

interface Props {
  domains: BlockedDomain[];
  onAdd: (hostname: string) => Promise<void>;
  onRemove: (hostname: string) => Promise<void>;
}

function isValidHostname(h: string): boolean {
  return /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(h.trim());
}

export default function DomainBlocker({ domains, onAdd, onRemove }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleAdd = async () => {
    const h = input.trim().toLowerCase().replace(/^www\./, "");
    if (!isValidHostname(h)) {
      setError("Enter a valid domain, e.g. reddit.com");
      return;
    }
    setError("");
    await onAdd(h);
    setInput("");
  };

  return (
    <section className="px-4 py-3 border-b border-gray-100">
      <div className="text-sm font-semibold text-gray-700 mb-2">Blocked domains</div>
      <div className="flex gap-2 mb-1">
        <input
          type="text"
          aria-label="Domain to block"
          placeholder="reddit.com"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm"
        />
        <button
          onClick={handleAdd}
          aria-label="Add domain"
          className="px-3 py-1 text-sm text-white bg-red-500 rounded hover:bg-red-600"
        >
          Block
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
      {domains.length === 0 && (
        <p className="text-xs text-gray-400">No domains blocked</p>
      )}
      <ul>
        {domains.map((d) => (
          <li key={d.hostname} className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-700 truncate">{d.hostname}</span>
            <button
              onClick={() => onRemove(d.hostname)}
              aria-label={`Unblock ${d.hostname}`}
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
