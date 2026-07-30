import { describe, it, expect } from "vitest";
import { sessionFromEntryTime } from "@/lib/constants";

const atUtcHour = (hour: number) => new Date(Date.UTC(2026, 6, 30, hour, 0, 0));

describe("sessionFromEntryTime", () => {
  it.each([
    [0, "asian"],
    [7, "london"],
    [8, "london"],
    [11, "london"],
    [12, "overlap"],
    [15, "overlap"],
    [16, "ny"],
    [20, "ny"],
    [21, "other"],
    [23, "other"],
  ])("hour %i UTC -> %s", (hour, expected) => {
    expect(sessionFromEntryTime(atUtcHour(hour))).toBe(expected);
  });
});
