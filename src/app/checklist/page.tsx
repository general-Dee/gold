import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PreMarketChecklist } from "@/components/checklist/PreMarketChecklist";
import {
  archiveChecklistItemAction,
  createChecklistItemAction,
} from "@/server/actions/checklist";
import {
  getCompletionsForDate,
  listActiveChecklistItems,
} from "@/server/queries/checklist";
import { localDateKey } from "@/lib/dates";

export default async function ChecklistPage() {
  const today = localDateKey();
  const [items, completions] = await Promise.all([
    listActiveChecklistItems(),
    getCompletionsForDate(today),
  ]);
  const completedItemIds = completions.map((c) => c.itemId);

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
