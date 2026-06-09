import { useState, useEffect, useCallback } from "react";
import type { DailyUsage } from "../../shared/types";
import { sendMessage } from "../../shared/messages";
import { toDateKey } from "../../shared/timeUtils";

interface UseTimeStatsResult {
  usage: DailyUsage;
  loading: boolean;
  dateKey: string;
  goToPrevDay: () => void;
  goToNextDay: () => void;
  isToday: boolean;
  refresh: () => void;
}

export function useTimeStats(): UseTimeStatsResult {
  const todayKey = toDateKey(new Date());
  const [dateKey, setDateKey] = useState(todayKey);
  const [usage, setUsage] = useState<DailyUsage>({});
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async (key: string) => {
    setLoading(true);
    try {
      if (key === todayKey) {
        await sendMessage({ type: "FLUSH_TIME" });
      }
      const response = await sendMessage({ type: "GET_USAGE", payload: { dateKey: key } });
      if (response.type === "USAGE") {
        setUsage(response.payload);
      }
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => {
    fetchUsage(dateKey);
  }, [dateKey, fetchUsage]);

  const goToPrevDay = () => {
    setDateKey((prev) => {
      const d = new Date(prev + "T00:00:00");
      d.setDate(d.getDate() - 1);
      return toDateKey(d);
    });
  };

  const goToNextDay = () => {
    setDateKey((prev) => {
      const d = new Date(prev + "T00:00:00");
      d.setDate(d.getDate() + 1);
      const next = toDateKey(d);
      return next <= todayKey ? next : prev;
    });
  };

  return {
    usage,
    loading,
    dateKey,
    goToPrevDay,
    goToNextDay,
    isToday: dateKey === todayKey,
    refresh: () => fetchUsage(dateKey),
  };
}
