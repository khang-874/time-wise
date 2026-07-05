import { useEffect, useState } from "react";
import { REMOVAL_DELAY_MS } from "../../../shared/constants";

interface Props {
  removalRequestedAt: number | null;
  onRequest: () => Promise<void>;
  onCancel: () => Promise<void>;
  onConfirm: () => Promise<void>;
  /** Used to build accessible labels, e.g. a hostname or filter keyword. */
  label: string;
  /** Verb shown on the initial button, e.g. "Unblock" or "Remove". Defaults to "Remove". */
  actionVerb?: string;
}

function remainingSeconds(removalRequestedAt: number): number {
  return Math.max(0, Math.ceil((REMOVAL_DELAY_MS - (Date.now() - removalRequestedAt)) / 1000));
}

export default function RemoveWithDelay({
  removalRequestedAt,
  onRequest,
  onCancel,
  onConfirm,
  label,
  actionVerb = "Remove",
}: Props) {
  const [remaining, setRemaining] = useState(() =>
    removalRequestedAt ? remainingSeconds(removalRequestedAt) : 0
  );

  useEffect(() => {
    if (!removalRequestedAt) return;
    setRemaining(remainingSeconds(removalRequestedAt));
    const interval = setInterval(() => {
      setRemaining(remainingSeconds(removalRequestedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [removalRequestedAt]);

  if (!removalRequestedAt) {
    return (
      <button
        onClick={onRequest}
        aria-label={`${actionVerb} ${label}`}
        className="text-xs text-gray-400 hover:text-red-500 ml-2 shrink-0"
      >
        {actionVerb}
      </button>
    );
  }

  const canConfirm = remaining <= 0;

  return (
    <span className="flex items-center gap-2 ml-2 shrink-0">
      {canConfirm ? (
        <button
          onClick={onConfirm}
          aria-label={`Confirm remove ${label}`}
          className="text-xs text-red-500 font-semibold hover:text-red-600"
        >
          Confirm remove
        </button>
      ) : (
        <span className="text-xs text-gray-400" aria-live="polite">
          Removing available in {remaining}s
        </span>
      )}
      <button
        onClick={onCancel}
        aria-label={`Cancel removing ${label}`}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
    </span>
  );
}
