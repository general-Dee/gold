import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ChecklistHistoryChart } from "@/components/checklist/ChecklistHistoryChart";
import { PreMarketChecklist } from "@/components/checklist/PreMarketChecklist";
import {
  archiveChecklistItemAction,
  createChecklistItemAction,
} from "@/server/actions/checklist";
import {
  computeChecklistStreaks,
  getChecklistHistory,
  getCompletionsForDate,
  listActiveChecklistItems,
} from "@/server/queries/checklist";
import { localDateKey } from "@/lib/dates";

export default async function ChecklistPage() {
  const today = localDateKey();
  const [items, completions, history] = await Promise.all([
    listActiveChecklistItems(),
    getCompletionsForDate(today),
    getChecklistHistory(90),
  ]);
  const completedItemIds = completions.map((c) => c.itemId);
  const { currentStreak, longestStreak } = computeChecklistStreaks(history);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pre-market checklist</h1>
        <p className="text-sm text-muted-foreground">
          A once-per-day routine, separate from the per-trade rule checklist — resets
          automatically at the start of each new day.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today — {today}</CardTitle>
        </CardHeader>
        <CardContent>
          <PreMarketChecklist items={items} date={today} completedItemIds={completedItemIds} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-end gap-8">
            <div>
              <div className="text-4xl font-semibold tabular-nums">{currentStreak}</div>
              <div className="text-xs text-muted-foreground">consecutive fully-completed days</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-muted-foreground">
                {longestStreak}
              </div>
              <div className="text-xs text-muted-foreground">longest streak (last 90 days)</div>
            </div>
          </div>
          <ChecklistHistoryChart data={history} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage checklist items</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm"
              >
                <span>{item.text}</span>
                <form action={archiveChecklistItemAction.bind(null, item.id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Archive
                  </Button>
                </form>
              </li>
            ))}
            {items.length === 0 && (
              <li className="text-sm text-muted-foreground">No items yet — add one below.</li>
            )}
          </ul>
          <Separator />
          <form action={createChecklistItemAction} className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="text" className="mb-1.5 block">
                New item
              </Label>
              <Input id="text" name="text" placeholder="e.g. Check economic calendar" required />
            </div>
            <Button type="submit">Add item</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
