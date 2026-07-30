import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChecklistStreakCard({
  currentStreak,
  longestStreak,
}: {
  currentStreak: number;
  longestStreak: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist streak</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end gap-8">
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
      </CardContent>
    </Card>
  );
}
