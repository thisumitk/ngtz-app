import { afterEach, describe, expect, it, vi } from "vitest";
import { getLocalDateStr, getLocalDateStrDaysAgo } from "@/lib/date";

afterEach(() => vi.useRealTimers());

describe("local calendar dates", () => {
  it("uses local year/month/day components with zero padding", () => {
    expect(getLocalDateStr(new Date(2026, 0, 9, 23, 59))).toBe("2026-01-09");
  });

  it("defaults to the current local date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 1, 12));
    expect(getLocalDateStr()).toBe("2026-03-01");
    expect(getLocalDateStrDaysAgo(0)).toBe("2026-03-01");
  });

  it("crosses leap days correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 2, 1, 12));
    expect(getLocalDateStrDaysAgo(1)).toBe("2024-02-29");
  });

  it("crosses year boundaries correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12));
    expect(getLocalDateStrDaysAgo(1)).toBe("2025-12-31");
  });
});
