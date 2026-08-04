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
import { parseTradeFilters } from "@/lib/tradeFilters";
import { listActiveSetupTags } from "@/server/queries/rules";
import { listTrades } from "@/server/queries/trades";

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const filters = parseTradeFilters(rawParams);
  const hasFilters = Object.values(filters).some((v) => v !== undefined);

  const [trades, setupTags] = await Promise.all([listTrades(filters), listActiveSetupTags()]);

  const exportParams = new URLSearchParams(
    Object.entries(rawParams).flatMap(([key, value]) =>
      value == null ? [] : [[key, Array.isArray(value) ? value[0] : value]],
    ),
  );

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

      <TradesFilterBar setupTags={setupTags} />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Status</TableHead>
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
                  <Badge variant={t.status === "open" ? "default" : "outline"}>{t.status}</Badge>
                </TableCell>
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
