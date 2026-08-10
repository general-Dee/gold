import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { summarizeTrades } from "@/server/queries/analytics";
import { listActiveSetupTags } from "@/server/queries/rules";
import { listTrades } from "@/server/queries/trades";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const rMultiple = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}R`);

export default async function SetupsIndexPage() {
  const setupTags = await listActiveSetupTags();

  const rows = await Promise.all(
    setupTags.map(async (tag) => {
      const trades = await listTrades({ setupTagId: tag.id });
      const stats = summarizeTrades(trades.filter((t) => t.status === "closed"));
      return { tag, stats };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Setups</h1>
        <p className="text-sm text-muted-foreground">
          Every setup tag, side by side. Click one to view or edit its playbook.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All setups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setup</TableHead>
                  <TableHead>Win rate</TableHead>
                  <TableHead>Avg R</TableHead>
                  <TableHead>Expectancy</TableHead>
                  <TableHead>Trades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ tag, stats }) => (
                  <TableRow key={tag.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell>
                      <Link href={`/setups/${tag.id}`} className="block font-medium">
                        {tag.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/setups/${tag.id}`} className="block">
                        {pct(stats.winRate)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/setups/${tag.id}`} className="block">
                        {rMultiple(stats.avgR)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/setups/${tag.id}`} className="block">
                        {stats.expectancy != null ? stats.expectancy.toFixed(2) : "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/setups/${tag.id}`} className="block">
                        {stats.count}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No setup tags yet — add one from Rules & Tags.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
