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
