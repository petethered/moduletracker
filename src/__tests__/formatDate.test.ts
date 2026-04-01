import { describe, it, expect, vi, afterEach } from "vitest";
import { formatDisplayDate, toDateString, getLocalDateString } from "../utils/formatDate";

describe("formatDisplayDate", () => {
  it("formats a YYYY-MM-DD string as a locale-aware date", () => {
    const result = formatDisplayDate("2026-03-31");
    // The exact format depends on locale, but should contain the year
    expect(result).toContain("2026");
    // Should contain day number
    expect(result).toContain("31");
  });

  it("handles single-digit months and days", () => {
    const result = formatDisplayDate("2026-01-05");
    expect(result).toContain("2026");
    expect(result).toContain("5");
  });

  it("parses as local date, not UTC (no off-by-one on timezone boundary)", () => {
    // This ensures the date is parsed using component parts, not new Date(string)
    // which would be treated as UTC and could shift the day in negative UTC offsets
    const result = formatDisplayDate("2026-01-01");
    expect(result).toContain("2026");
    expect(result).toContain("1");
  });
});

describe("toDateString", () => {
  it("formats a Date object as YYYY-MM-DD", () => {
    const date = new Date(2026, 2, 31); // March 31, 2026 (month is 0-indexed)
    expect(toDateString(date)).toBe("2026-03-31");
  });

  it("zero-pads single-digit months and days", () => {
    const date = new Date(2026, 0, 5); // January 5, 2026
    expect(toDateString(date)).toBe("2026-01-05");
  });

  it("handles December correctly", () => {
    const date = new Date(2025, 11, 25); // December 25, 2025
    expect(toDateString(date)).toBe("2025-12-25");
  });
});

describe("getLocalDateString", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today's date as YYYY-MM-DD", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 31, 14, 30, 0)); // March 31, 2026 2:30pm
    expect(getLocalDateString()).toBe("2026-03-31");
  });

  it("uses local time, not UTC", () => {
    vi.useFakeTimers();
    // Set to late evening -- in UTC this could be the next day
    vi.setSystemTime(new Date(2026, 2, 31, 23, 59, 0));
    expect(getLocalDateString()).toBe("2026-03-31");
  });
});
