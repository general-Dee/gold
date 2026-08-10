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
import { ImportTradesDialog } from "@/components/trades/ImportTradesDialog";
import { TradesFilterBar } from "@/components/trades/TradesFilterBar";
import { parseTradeFilters, parseTradeSort } from "@/lib/tradeFilters";
import type { TradeSortField } from "@/lib/constants";
import { listActiveMoodTags, listActiveSetupTags } from "@/server/queries/rules";
import { listTrades } from "@/server/queries/trades";

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const filters = parseTradeFilters(rawParams);
  const sort = parseTradeSort(rawParams);
  const hasFilters = Object.values(filters).some((v) => v !== undefined);

  const [trades, setupTags, moodTags] = await Promise.all([
    listTrades(filters, sort),
    listActiveSetupTags(),
    listActiveMoodTags(),
  ]);

  const exportParams = new URLSearchParams(
    Object.entries(rawParams).flatMap(([key, value]) =>
      value == null ? [] : [[key, Array.isArray(value) ? value[0] : value]],
    ),
  );

  function sortHref(field: TradeSortField) {
    const params = new URLSearchParams(
      Object.entries(rawParams).flatMap(([key, value]) =>
        value == null || key === "sort" || key === "dir"
          ? []
          : [[key, Array.isArray(value) ? value[0] : value]],
      ),
    );
    const nextDir = sort?.sortBy === field && sort.sortDir === "desc" ? "asc" : "desc";
    params.set("sort", field);
    params.set("dir", nextDir);
    return `?${params.toString()}`;
  }

  function sortIndicator(field: TradeSortField) {
    if (sort?.sortBy !== field) return null;
    return sort.sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trades</h1>
          <p className="text-sm text-muted-foreground">
            {trades.length} {hasFilters ? "matching" : "logged"}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/export/trades?${exportParams.toString()}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Export CSV
          </a>
          <ImportTradesDialog />
          <Link href="/trades/new" className={buttonVariants()}>
            Log new trade
          </Link>
        </div>
      </div>

      <TradesFilterBar setupTags={setupTags} moodTags={moodTags} />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Link href={sortHref("entryAt")} className="hover:underline">
                  Entry{sortIndicator("entryAt")}
                </Link>
              </TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>
                <Link href={sortHref("riskRewardPlanned")} className="hover:underline">
                  Planned R:R{sortIndicator("riskRewardPlanned")}
                </Link>
              </TableHead>
              <TableHead>
                <Link href={sortHref("pnl")} className="hover:underline">
                  P&amp;L{sortIndicator("pnl")}
                </Link>
              </TableHead>
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
                <TableCell className="capitalize">
                  <Link href={`/trades/${t.id}`} className="block">
                    {t.direction}
                  </Link>
                </TableCell>
                <TableCell className="capitalize">
                  <Link href={`/trades/${t.id}`} className="block">
                    {t.session}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/trades/${t.id}`} className="block">
                    <Badge variant={t.status === "open" ? "default" : "outline"}>{t.status}</Badge>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/trades/${t.id}`} className="block">
                    {t.outcome ? (
                      <Badge variant={t.outcome === "win" ? "default" : "secondary"}>
                        {t.outcome}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/trades/${t.id}`} className="block">
                    {t.riskRewardPlanned != null ? `${t.riskRewardPlanned.toFixed(2)}R` : "—"}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/trades/${t.id}`} className="block">
                    {t.pnl != null ? t.pnl.toFixed(2) : "—"}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {trades.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
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
