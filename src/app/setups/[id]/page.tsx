import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { updateSetupTagDetailsAction } from "@/server/actions/rules";
import { summarizeTrades } from "@/server/queries/analytics";
import { getSetupTagById } from "@/server/queries/rules";
import { listTrades } from "@/server/queries/trades";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const rMultiple = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}R`);

export default async function SetupPlaybookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tag, trades] = await Promise.all([getSetupTagById(id), listTrades({ setupTagId: id })]);
  if (!tag) notFound();

  const stats = summarizeTrades(trades.filter((t) => t.status === "closed"));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{tag.name}</h1>
        <p className="text-sm text-muted-foreground">Setup playbook</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Win rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{pct(stats.winRate)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Avg R</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {rMultiple(stats.avgR)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expectancy</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {stats.expectancy != null ? stats.expectancy.toFixed(2) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Trades</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{stats.count}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Playbook notes</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateSetupTagDetailsAction.bind(null, tag.id)} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="expectedR" className="mb-1.5 block">
                Expected R
              </Label>
              <Input
                id="expectedR"
                name="expectedR"
                type="number"
                step="0.1"
                defaultValue={tag.expectedR ?? ""}
                className="max-w-40"
              />
            </div>
            <div>
              <Label htmlFor="notes" className="mb-1.5 block">
                Notes
              </Label>
              <Textarea
                id="notes"
                name="notes"
                rows={5}
                defaultValue={tag.notes ?? ""}
                placeholder="Entry criteria, invalidation, context this setup works best in..."
              />
            </div>
            <Button type="submit" className="self-start">
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trades using this setup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Realized R</TableHead>
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
                        {t.riskRewardRealized != null ? `${t.riskRewardRealized.toFixed(2)}R` : "—"}
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
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No trades logged with this setup yet.
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
