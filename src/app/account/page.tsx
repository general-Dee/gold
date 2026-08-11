import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { TRANSACTION_TYPES } from "@/lib/constants";
import {
  addAccountTransactionAction,
  deleteAccountTransactionAction,
  updateAccountSettingsAction,
} from "@/server/actions/account";
import {
  getAccountSettings,
  getCurrentBalance,
  getGoalProgress,
  listAccountTransactions,
} from "@/server/queries/account";

const pct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const money = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

export default async function AccountPage() {
  const [settings, balance, goalProgress, transactions] = await Promise.all([
    getAccountSettings(),
    getCurrentBalance(),
    getGoalProgress(),
    listAccountTransactions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Current balance</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {balance.toFixed(2)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Month-to-date</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {pct(goalProgress.monthToDateProfitPct)}
            {goalProgress.monthlyProfitTargetPct != null && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / {goalProgress.monthlyProfitTargetPct}% target
              </span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Drawdown from peak</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
            {goalProgress.currentDrawdownPct != null ? `${goalProgress.currentDrawdownPct.toFixed(2)}%` : "—"}
            {goalProgress.isOverDrawdownLimit && <Badge variant="destructive">Over limit</Badge>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateAccountSettingsAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="startingBalance" className="mb-1.5 block">
                Starting balance
              </Label>
              <Input
                id="startingBalance"
                name="startingBalance"
                type="number"
                step="any"
                defaultValue={settings.startingBalance}
                required
              />
            </div>
            <div>
              <Label htmlFor="monthlyProfitTargetPct" className="mb-1.5 block">
                Monthly profit target %
              </Label>
              <Input
                id="monthlyProfitTargetPct"
                name="monthlyProfitTargetPct"
                type="number"
                step="any"
                defaultValue={settings.monthlyProfitTargetPct ?? ""}
                placeholder="e.g. 5"
              />
            </div>
            <div>
              <Label htmlFor="maxDrawdownLimitPct" className="mb-1.5 block">
                Max drawdown limit %
              </Label>
              <Input
                id="maxDrawdownLimitPct"
                name="maxDrawdownLimitPct"
                type="number"
                step="any"
                defaultValue={settings.maxDrawdownLimitPct ?? ""}
                placeholder="e.g. 10"
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit">Save settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deposits & withdrawals</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.occurredAt).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize">{t.type}</TableCell>
                    <TableCell>{money(t.type === "deposit" ? t.amount : -t.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{t.note ?? "—"}</TableCell>
                    <TableCell>
                      <form action={deleteAccountTransactionAction.bind(null, t.id)}>
                        <button type="submit" className="text-muted-foreground hover:text-foreground">
                          ×
                        </button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
                {transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No deposits or withdrawals logged yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <form action={addAccountTransactionAction} className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="type" className="mb-1.5 block">
                Type
              </Label>
              <select
                id="type"
                name="type"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {TRANSACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="amount" className="mb-1.5 block">
                Amount
              </Label>
              <Input id="amount" name="amount" type="number" step="any" min="0" required />
            </div>
            <div>
              <Label htmlFor="occurredAt" className="mb-1.5 block">
                Date
              </Label>
              <Input id="occurredAt" name="occurredAt" type="date" required />
            </div>
            <div className="flex-1">
              <Label htmlFor="note" className="mb-1.5 block">
                Note
              </Label>
              <Input id="note" name="note" placeholder="optional" />
            </div>
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
        </CardHeader>
        <CardContent>
          <a href="/api/export/backup" className={buttonVariants({ variant: "outline" })}>
            Download backup (.json)
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
