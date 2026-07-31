import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TradesFilterBar } from "@/components/trades/TradesFilterBar";
import { DIRECTIONS, OUTCOMES, SESSIONS } from "@/lib/constants";
import { listActiveSetupTags } from "@/server/queries/rules";
import { listTrades, type TradeFilters } from "@/server/queries/trades";

function parseFilters(params: Record<string, string | string[] | undefined>): TradeFilters {
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

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const filters = parseFilters(rawParams);
  const hasFilters = Object.values(filters).some((v) => v !== undefined);

  const [trades, setupTags] = await Promise.all([listTrades(filters), listActiveSetupTags()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trades</h1>
          <p className="text-sm text-muted-foreground">
            {trades.length} {hasFilters ? "matching" : "logged"}
          </p>
        </div>
        <Link href="/trades/new" className={buttonVariants()}>
          Log new trade
        </Link>
      </div>

      <TradesFilterBar setupTags={setupTags} />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Planned R:R</TableHead>
              <TableHead>P&amp;L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((t) => (
              <TableRow key={t.id} className="cursor-pointer hover:bg-muted/40">
                <TableCell>
                  <Link href={`/trades/${t.id}`} className="block">
                    {new Date(t.entryAt).toLocaleString()}
                  </Link>
                </TableCell>
                <TableCell className="capitalize">{t.direction}</TableCell>
                <TableCell className="capitalize">{t.session}</TableCell>
                <TableCell>
                  {t.outcome ? (
                    <Badge variant={t.outcome === "win" ? "default" : "secondary"}>
                      {t.outcome}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {t.riskRewardPlanned != null ? `${t.riskRewardPlanned.toFixed(2)}R` : "—"}
                </TableCell>
                <TableCell>{t.pnl != null ? t.pnl.toFixed(2) : "—"}</TableCell>
              </TableRow>
            ))}
            {trades.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {hasFilters ? "No trades match these filters." : "No trades logged yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
