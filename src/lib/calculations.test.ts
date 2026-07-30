import { describe, it, expect } from "vitest";
import { riskReward, plannedRiskReward, realizedRiskReward } from "@/lib/calculations";

describe("riskReward", () => {
  it("returns null when targetPrice is null", () => {
    expect(
      riskReward({ direction: "long", entryPrice: 100, stopLoss: 90, targetPrice: null }),
    ).toBeNull();
  });

  it("returns null when targetPrice is undefined", () => {
    expect(
      riskReward({ direction: "long", entryPrice: 100, stopLoss: 90, targetPrice: undefined }),
    ).toBeNull();
  });

  it("returns null when entryPrice equals stopLoss (division-by-zero guard)", () => {
    expect(
      riskReward({ direction: "long", entryPrice: 100, stopLoss: 100, targetPrice: 110 }),
    ).toBeNull();
  });

  it("computes a positive R for a winning long trade", () => {
    expect(
      riskReward({ direction: "long", entryPrice: 100, stopLoss: 90, targetPrice: 120 }),
    ).toBe(2);
  });

  it("computes a negative R for a losing long trade", () => {
    expect(
      riskReward({ direction: "long", entryPrice: 100, stopLoss: 90, targetPrice: 95 }),
    ).toBe(-0.5);
  });

  it("computes a positive R for a winning short trade", () => {
    expect(
      riskReward({ direction: "short", entryPrice: 100, stopLoss: 110, targetPrice: 80 }),
    ).toBe(2);
  });

  it("computes a negative R for a losing short trade", () => {
    expect(
      riskReward({ direction: "short", entryPrice: 100, stopLoss: 110, targetPrice: 105 }),
    ).toBe(-0.5);
  });
});

describe("plannedRiskReward", () => {
  it("delegates to riskReward using takeProfit as the target", () => {
    expect(
      plannedRiskReward({ direction: "long", entryPrice: 100, stopLoss: 90, takeProfit: 120 }),
    ).toBe(2);
  });

  it("returns null when takeProfit is not provided", () => {
    expect(plannedRiskReward({ direction: "long", entryPrice: 100, stopLoss: 90 })).toBeNull();
  });
});

describe("realizedRiskReward", () => {
  it("delegates to riskReward using exitPrice as the target", () => {
    expect(
      realizedRiskReward({ direction: "short", entryPrice: 100, stopLoss: 110, exitPrice: 80 }),
    ).toBe(2);
  });

  it("returns null when exitPrice is null", () => {
    expect(
      realizedRiskReward({ direction: "long", entryPrice: 100, stopLoss: 90, exitPrice: null }),
    ).toBeNull();
  });
});
