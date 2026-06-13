import { useState, useEffect, useCallback, useRef } from "react";
import type { DailyUsage } from "../../shared/types";
import { sendMessage } from "../../shared/messages";
import { toDateKey } from "../../shared/timeUtils";

interface UseTimeStatsResult {
  /** Hostname-to-seconds map for the currently selected day. */
  usage: DailyUsage;
  loading: boolean;
  /** Currently displayed date in `YYYY-MM-DD` format. */
  dateKey: string;
  goToPrevDay: () => void;
  /** Clamped to today — calling when `isToday` is `true` is a no-op. */
  goToNextDay: () => void;
  /** `true` when the displayed day is today. Used to disable the "next day" button. */
  isToday: boolean;
  /** Re-fetches usage for the current date (triggers a flush first when viewing today). */
  refresh: () => void;
}

/**
 * Fetches and paginates time-usage data from the background service worker.
 *
 * @remarks
 * When viewing today, a `FLUSH_TIME` message is sent before fetching so the
 * displayed totals include the currently active (not-yet-persisted) session.
 * For historical days the flush is skipped to avoid unnecessary SW wake-ups.
 */
export function useTimeStats(): UseTimeStatsResult {
  const todayDate = toDateKey(new Date());
  const [date, setDate] = useState(todayDate);
  const [usage, setUsage] = useState<DailyUsage>({});
  const [loading, setLoading] = useState(true);
  const activeRequestRef = useRef<string | null>(null);

  const fetchUsage = useCallback(
    async (dateToFetch: string) => {
      activeRequestRef.current = dateToFetch;
      setLoading(true);
      try {
        if (dateToFetch === todayDate) {
          await sendMessage({ type: "FLUSH_TIME" });
        }
        const response = await sendMessage({
          type: "GET_USAGE",
          payload: { dateKey: dateToFetch },
        });
        if (activeRequestRef.current !== dateToFetch) return;
        if (response.type === "USAGE") {
          setUsage(response.payload);
        }
      } finally {
        if (activeRequestRef.current === dateToFetch) setLoading(false);
      }
    },
    [todayDate],
  );

  useEffect(() => {
    fetchUsage(date);
  }, [date, fetchUsage]);

  const goToPrevDay = () => {
    setDate((prev) => {
      const d = new Date(prev + "T00:00:00");
      d.setDate(d.getDate() - 1);
      return toDateKey(d);
    });
  };

  const goToNextDay = () => {
    setDate((prev) => {
      const d = new Date(prev + "T00:00:00");
      d.setDate(d.getDate() + 1);
      const next = toDateKey(d);
      return next <= todayDate ? next : prev;
    });
  };

  return {
    usage,
    loading,
    dateKey: date,
    goToPrevDay,
    goToNextDay,
    isToday: date === todayDate,
    refresh: () => fetchUsage(date),
  };
}
