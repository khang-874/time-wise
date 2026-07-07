interface Props {
  enabled: boolean;
  onChange: (enabled: boolean) => Promise<void>;
}

export default function ShortsToggle({ enabled, onChange }: Props) {
  return (
    <section className="px-4 py-3 border-b border-gray-100">
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          aria-label="Block YouTube Shorts"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        Block YouTube Shorts entirely
      </label>
      <p className="text-xs text-gray-400 mt-1">
        Redirects away from any Shorts video, regardless of content filter keywords.
      </p>
    </section>
  );
}
