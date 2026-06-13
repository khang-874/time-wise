/**
 * Converts a `Date` to an ISO date string used as storage keys.
 *
 * @returns `"YYYY-MM-DD"` in the user's local timezone.
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats a duration as a human-readable string for the Stats UI.
 *
 * @param totalSeconds - Total elapsed seconds; negative values are clamped to 0.
 * @returns `"Xs"` for under a minute, `"Xm Ys"` for under an hour, `"Xh YYm"` for an hour or more.
 *
 * @example
 * formatTime(45)    // "45s"
 * formatTime(90)    // "1m 30s"
 * formatTime(3661)  // "1h 01m"
 */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

/**
 * Formats a duration as `"MM:SS"` for the Pomodoro countdown display.
 *
 * @param totalSeconds - Remaining seconds; negative values are clamped to `"00:00"`.
 */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Returns the last 7 days as date keys, oldest first, ending with today.
 *
 * @returns Array of 7 `"YYYY-MM-DD"` strings.
 */
export function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toDateKey(d));
  }
  return days;
}

/**
 * Converts a date key to a short display label for the Stats header.
 *
 * @param dateKey - ISO date string in `YYYY-MM-DD` format.
 * @returns `"Today"`, `"Yesterday"`, or `"MM/DD"` for older dates.
 */
export function toDisplayLabel(dateKey: string): string {
  const today = toDateKey(new Date());
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = toDateKey(d);
  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  const [, month, day] = dateKey.split("-");
  return `${month}/${day}`;
}

/**
 * Computes remaining seconds for the active Pomodoro phase.
 *
 * @remarks
 * When the timer is running (`startedAt` is set), real wall-clock time is
 * used so the result stays accurate even if the service worker was suspended.
 * When paused (`startedAt` is `null`), the result is purely `durationSeconds - elapsedSeconds`.
 *
 * @param durationSeconds - Total phase duration.
 * @param startedAt - Epoch ms when the current run started, or `null` if paused.
 * @param elapsedSeconds - Seconds accumulated across all previous runs within this phase.
 * @returns Remaining seconds, clamped to 0.
 */
export function computeRemainingSeconds(
  durationSeconds: number,
  startedAt: number | null,
  elapsedSeconds: number
): number {
  if (startedAt === null) {
    return durationSeconds - elapsedSeconds;
  }
  const totalElapsed = elapsedSeconds + Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, durationSeconds - totalElapsed);
}
