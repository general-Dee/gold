import { BadgeGallery } from "@/components/dashboard/BadgeGallery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  PROFIT_R_MILESTONES,
  STREAK_MILESTONES,
  isPerformanceBadgeKey,
} from "@/server/gamification/badgeDefinitions";
import { computeStreaks, getBadgeUnlocks, getTradeAdherenceHistory } from "@/server/queries/gamification";

export default async function AchievementsPage() {
  const [history, unlocks] = await Promise.all([getTradeAdherenceHistory(), getBadgeUnlocks()]);
  const { currentStreak, longestStreak } = computeStreaks(history);
  const unlockedKeys = new Set(unlocks.map((u) => u.badgeKey));
  const performanceUnlocks = unlocks.filter((u) => isPerformanceBadgeKey(u.badgeKey));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Achievements</h1>
        <p className="text-sm text-muted-foreground">
          Every badge here is earned by following your own rules — never by profit or how many
          trades you take.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Streak milestones</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STREAK_MILESTONES.map((n) => (
            <div
              key={n}
              className={`rounded-md border px-3 py-4 text-center ${
                unlockedKeys.has(`streak_${n}`) ? "" : "opacity-40"
              }`}
            >
              <div className="text-xl font-semibold">{n}</div>
              <div className="text-xs text-muted-foreground">in a row</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current streak</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold tabular-nums">{currentStreak}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Longest streak ever</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold tabular-nums">{longestStreak}</CardContent>
        </Card>
      </div>

      <BadgeGallery unlocks={[...unlocks].reverse()} title="All badges earned" />

      <Separator />

      <div>
        <h2 className="text-xl font-semibold tracking-tight">Performance</h2>
        <p className="text-sm text-muted-foreground">
          Performance milestones — these track results (profit, streaks, big trades), separate
          from the discipline badges above.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profit milestones</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PROFIT_R_MILESTONES.map((n) => (
            <div
              key={n}
              className={`rounded-md border px-3 py-4 text-center ${
                unlockedKeys.has(`profit_${n}r`) ? "" : "opacity-40"
              }`}
            >
              <div className="text-xl font-semibold">{n}R</div>
              <div className="text-xs text-muted-foreground">total profit</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <BadgeGallery
        unlocks={[...performanceUnlocks].reverse()}
        title="Performance badges earned"
        emptyMessage="No performance badges yet — win streaks, big trades, and profit milestones will show up here."
      />
    </div>
  );
}
