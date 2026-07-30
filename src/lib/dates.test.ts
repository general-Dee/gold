import { describe, it, expect } from "vitest";
import { localDateKey, startOfLocalDay, startOfIsoWeek } from "@/lib/dates";

describe("localDateKey", () => {
  it("pads single-digit month and day", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("does not pad double-digit month and day", () => {
    expect(localDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("startOfLocalDay", () => {
  it("zeroes out the time component", () => {
    const input = new Date(2026, 6, 30, 14, 35, 10, 500);
    const result = startOfLocalDay(input);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(30);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});

describe("startOfIsoWeek", () => {
  // Jul 27 2026 = Monday, Jul 29 2026 = Wednesday, Aug 2 2026 = Sunday;
  // all three belong to the ISO week starting Mon Jul 27 2026.
  const expectedMonday = new Date(2026, 6, 27);

  it("returns the same day when given a Monday", () => {
    const result = startOfIsoWeek(new Date(2026, 6, 27, 9, 0));
    expect(result.getTime()).toBe(expectedMonday.getTime());
  });

  it("shifts back to Monday when given a mid-week day", () => {
    const result = startOfIsoWeek(new Date(2026, 6, 29, 23, 59));
    expect(result.getTime()).toBe(expectedMonday.getTime());
  });

  it("shifts back to the previous Monday when given a Sunday", () => {
    const result = startOfIsoWeek(new Date(2026, 7, 2, 0, 0));
    expect(result.getTime()).toBe(expectedMonday.getTime());
  });
});
