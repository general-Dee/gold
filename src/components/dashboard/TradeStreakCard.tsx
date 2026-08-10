import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TradeStreakCard({
  currentStreak,
  currentStreakType,
  longestWinStreak,
  longestLossStreak,
}: {
  currentStreak: number;
  currentStreakType: "win" | "loss" | null;
  longestWinStreak: number;
  longestLossStreak: number;
}) {
  const currentCaption =
    currentStreakType === "win"
      ? "consecutive wins"
      : currentStreakType === "loss"
        ? "consecutive losses"
        : "no active streak";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade streak</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end gap-8">
        <div>
          <div
            className={`text-4xl font-semibold tabular-nums ${
              currentStreakType === "loss" ? "text-destructive" : ""
            }`}
          >
            {currentStreak}
          </div>
          <div className="text-xs text-muted-foreground">{currentCaption}</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums text-muted-foreground">
            {longestWinStreak}
          </div>
          <div className="text-xs text-muted-foreground">longest win streak</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums text-muted-foreground">
            {longestLossStreak}
          </div>
          <div className="text-xs text-muted-foreground">longest loss streak</div>
        </div>
      </CardContent>
    </Card>
  );
}
