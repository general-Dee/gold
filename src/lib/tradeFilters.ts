import { DIRECTIONS, OUTCOMES, SESSIONS } from "@/lib/constants";
import type { TradeFilters } from "@/server/queries/trades";

export function parseTradeFilters(params: Record<string, string | string[] | undefined>): TradeFilters {
  const get = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const direction = get("direction");
  const outcome = get("outcome");
  const session = get("session");
  const from = get("from");
  const to = get("to");
  const setupTagId = get("setupTagId");
  const q = get("q");

  return {
    from: from ? `${from}T00:00:00.000Z` : undefined,
    to: to ? `${to}T23:59:59.999Z` : undefined,
    direction: DIRECTIONS.includes(direction as (typeof DIRECTIONS)[number])
      ? (direction as (typeof DIRECTIONS)[number])
      : undefined,
    outcome: OUTCOMES.includes(outcome as (typeof OUTCOMES)[number])
      ? (outcome as (typeof OUTCOMES)[number])
      : undefined,
    session: SESSIONS.includes(session as (typeof SESSIONS)[number])
      ? (session as (typeof SESSIONS)[number])
      : undefined,
    setupTagId: setupTagId || undefined,
    q: q || undefined,
  };
}
