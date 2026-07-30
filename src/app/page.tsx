import Link from "next/link";
import { BadgeGallery } from "@/components/dashboard/BadgeGallery";
import { ChecklistStatusCard } from "@/components/dashboard/ChecklistStatusCard";
import { ChecklistStreakCard } from "@/components/dashboard/ChecklistStreakCard";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { EquityCurveChart } from "@/components/analytics/EquityCurveChart";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAverageRiskReward, getEquityCurve, getWinRate, get30DayAdherence } from "@/server/queries/analytics";
import { getChecklistStatusForDate, getChecklistStreaks } from "@/server/queries/checklist";
import { getBadgeUnlocks, getTradeAdherenceHistory, computeStreaks } from "@/server/queries/gamification";
import { listTrades } from "@/server/queries/trades";
import { localDateKey } from "@/lib/dates";

export default async function DashboardPage() {
  const today = localDateKey();
  const [
    history,
    badgeUnlocks,
    winRate,
    avgRealizedR,
    adherence30d,
    equity,
    trades,
    checklistStatus,
    checklistStreaks,
  ] = await Promise.all([
    getTradeAdherenceHistory(),
    getBadgeUnlocks(),
    getWinRate(),
    getAverageRiskReward("realized"),
    get30DayAdherence(),
    getEquityCurve(),
    listTrades(),
    getChecklistStatusForDate(today),
    getChecklistStreaks(90),
  ]);

  const { currentStreak, longestStreak } = computeStreaks(history);
  const recentBadges = [...badgeUnlocks].reverse().slice(0, 5);
  const recentTrades = trades.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Link href="/trades/new" className={buttonVariants()}>
          Log new trade
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <StreakCard currentStreak={currentStreak} longestStreak={longestStreak} />
        <QuickStats winRate={winRate} avgRealizedR={avgRealizedR} adherence30d={adherence30d} />
        <ChecklistStatusCard {...checklistStatus} />
        <ChecklistStreakCard {...checklistStreaks} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equity curve</CardTitle>
        </CardHeader>
        <CardContent>
          <EquityCurveChart data={equity} sparkline />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BadgeGallery unlocks={recentBadges} title="Recent badges" />

        <Card>
          <CardHeader>
            <CardTitle>Recent trades</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTrades.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trades logged yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recentTrades.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/trades/${t.id}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                    >
                      <span className="capitalize">
                        {t.direction} · {new Date(t.entryAt).toLocaleDateString()}
                      </span>
                      {t.outcome ? (
                        <Badge variant={t.outcome === "win" ? "default" : "secondary"}>
                          {t.outcome}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
