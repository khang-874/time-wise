export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

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

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toDateKey(d));
  }
  return days;
}

export function toDisplayLabel(dateKey: string): string {
  const today = toDateKey(new Date());
  const yesterday = toDateKey(new Date(Date.now() - 86400000));
  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  const [, month, day] = dateKey.split("-");
  return `${month}/${day}`;
}

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
