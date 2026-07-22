import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StreakCard({
  currentStreak,
  longestStreak,
}: {
  currentStreak: number;
  longestStreak: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Discipline streak</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end gap-8">
        <div>
          <div className="text-4xl font-semibold tabular-nums">{currentStreak}</div>
          <div className="text-xs text-muted-foreground">consecutive rule-following trades</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums text-muted-foreground">
            {longestStreak}
          </div>
          <div className="text-xs text-muted-foreground">longest streak ever</div>
        </div>
      </CardContent>
    </Card>
  );
}
