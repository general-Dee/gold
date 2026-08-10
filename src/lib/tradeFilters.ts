import { DIRECTIONS, OUTCOMES, SESSIONS, SORT_DIRECTIONS, TRADE_SORT_FIELDS, TRADE_STATUSES } from "@/lib/constants";
import type { TradeFilters, TradeSort } from "@/server/queries/trades";

export function parseTradeFilters(params: Record<string, string | string[] | undefined>): TradeFilters {
  const get = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const direction = get("direction");
  const outcome = get("outcome");
  const session = get("session");
  const status = get("status");
  const from = get("from");
  const to = get("to");
  const setupTagId = get("setupTagId");
  const moodTagId = get("moodTagId");
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
    status: TRADE_STATUSES.includes(status as (typeof TRADE_STATUSES)[number])
      ? (status as (typeof TRADE_STATUSES)[number])
      : undefined,
    setupTagId: setupTagId || undefined,
    moodTagId: moodTagId || undefined,
    q: q || undefined,
  };
}

/** Sort is parsed separately from filters — it doesn't affect which trades
 * match, so pages can tell "no filters applied" apart from "just sorted". */
export function parseTradeSort(params: Record<string, string | string[] | undefined>): TradeSort | undefined {
  const get = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const sortBy = get("sort");
  const sortDir = get("dir");
  if (!TRADE_SORT_FIELDS.includes(sortBy as (typeof TRADE_SORT_FIELDS)[number])) return undefined;

  return {
    sortBy: sortBy as (typeof TRADE_SORT_FIELDS)[number],
    sortDir: SORT_DIRECTIONS.includes(sortDir as (typeof SORT_DIRECTIONS)[number])
      ? (sortDir as (typeof SORT_DIRECTIONS)[number])
      : "desc",
  };
}
