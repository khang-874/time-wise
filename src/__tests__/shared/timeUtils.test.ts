import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toDateKey,
  formatTime,
  formatCountdown,
  getLast7Days,
  toDisplayLabel,
  computeRemainingSeconds,
} from "../../shared/timeUtils";

describe("toDateKey", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(toDateKey(new Date("2024-03-15T10:00:00Z"))).toBe("2024-03-15");
  });
});

describe("formatTime", () => {
  it("formats seconds only", () => {
    expect(formatTime(45)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatTime(90)).toBe("1m 30s");
  });

  it("formats hours and minutes", () => {
    expect(formatTime(3661)).toBe("1h 01m");
  });

  it("formats 0 seconds", () => {
    expect(formatTime(0)).toBe("0s");
  });

  it("clamps negative values to 0", () => {
    expect(formatTime(-5)).toBe("0s");
  });

  it("formats exactly 1 hour", () => {
    expect(formatTime(3600)).toBe("1h 00m");
  });

  it("formats 59 seconds", () => {
    expect(formatTime(59)).toBe("59s");
  });

  it("formats 60 seconds as 1m 00s", () => {
    expect(formatTime(60)).toBe("1m 00s");
  });
});

describe("formatCountdown", () => {
  it("formats 25 minutes as 25:00", () => {
    expect(formatCountdown(1500)).toBe("25:00");
  });

  it("formats 0 as 00:00", () => {
    expect(formatCountdown(0)).toBe("00:00");
  });

  it("formats 90 seconds as 01:30", () => {
    expect(formatCountdown(90)).toBe("01:30");
  });

  it("clamps negative values to 00:00", () => {
    expect(formatCountdown(-10)).toBe("00:00");
  });
});

describe("getLast7Days", () => {
  it("returns exactly 7 items", () => {
    expect(getLast7Days()).toHaveLength(7);
  });

  it("ends with today", () => {
    const days = getLast7Days();
    expect(days[6]).toBe(toDateKey(new Date()));
  });

  it("returns days in ascending order", () => {
    const days = getLast7Days();
    for (let i = 1; i < days.length; i++) {
      expect(days[i] > days[i - 1]).toBe(true);
    }
  });
});

describe("toDisplayLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-08T12:00:00Z"));
  });

  it("returns 'Today' for today", () => {
    expect(toDisplayLabel("2024-06-08")).toBe("Today");
  });

  it("returns 'Yesterday' for yesterday", () => {
    expect(toDisplayLabel("2024-06-07")).toBe("Yesterday");
  });

  it("returns MM/DD for older dates", () => {
    expect(toDisplayLabel("2024-06-05")).toBe("06/05");
  });
});

describe("computeRemainingSeconds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000000);
  });

  it("returns durationSeconds minus elapsedSeconds when paused (startedAt null)", () => {
    expect(computeRemainingSeconds(1500, null, 300)).toBe(1200);
  });

  it("accounts for real time elapsed since startedAt", () => {
    const startedAt = 1000000 - 60000; // 60 seconds ago
    expect(computeRemainingSeconds(1500, startedAt, 0)).toBe(1440);
  });

  it("clamps to 0 when time is up", () => {
    const startedAt = 1000000 - 2000000; // way past
    expect(computeRemainingSeconds(1500, startedAt, 0)).toBe(0);
  });
});
