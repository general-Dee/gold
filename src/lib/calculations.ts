import type { Direction } from "./constants";

const directionSign = (direction: Direction) => (direction === "long" ? 1 : -1);

/**
 * R-multiple: broker/point-value agnostic, so it stays meaningful across
 * brokers with different XAUUSD contract conventions (unlike raw $ P&L).
 */
export function riskReward(params: {
  direction: Direction;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number | null | undefined;
}): number | null {
  const { direction, entryPrice, stopLoss, targetPrice } = params;
  if (targetPrice == null) return null;

  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  if (riskPerUnit === 0) return null;

  const rewardPerUnit = (targetPrice - entryPrice) * directionSign(direction);
  return rewardPerUnit / riskPerUnit;
}

export function plannedRiskReward(params: {
  direction: Direction;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number | null;
}): number | null {
  return riskReward({ ...params, targetPrice: params.takeProfit });
}

export function realizedRiskReward(params: {
  direction: Direction;
  entryPrice: number;
  stopLoss: number;
  exitPrice?: number | null;
}): number | null {
  return riskReward({ ...params, targetPrice: params.exitPrice });
}

/** This app only trades XAUUSD, where a standard lot is 100 oz — not a
 * generic multi-instrument sizer. */
const XAUUSD_LOT_SIZE_OZ = 100;

export function suggestPositionSize(params: {
  accountBalance: number;
  riskPct: number;
  entryPrice: number;
  stopLoss: number;
}): number | null {
  const { accountBalance, riskPct, entryPrice, stopLoss } = params;
  const stopDistance = Math.abs(entryPrice - stopLoss);
  if (stopDistance === 0 || accountBalance <= 0 || riskPct <= 0) return null;

  const riskAmount = accountBalance * (riskPct / 100);
  return riskAmount / (stopDistance * XAUUSD_LOT_SIZE_OZ);
}
