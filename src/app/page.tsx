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
import { getCurrentBalance, getGoalProgress } from "@/server/queries/account";
import { getChecklistStatusForDate, getChecklistStreaks } from "@/server/queries/checklist";
import {
  getBadgeUnlocks,
  getTradeAdherenceHistory,
  getMostRecentTradeViolations,
  computeStreaks,
} from "@/server/queries/gamification";
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
    balance,
    goalProgress,
    violation,
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
    getCurrentBalance(),
    getGoalProgress(),
    getMostRecentTradeViolations(),
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

      {violation && (
        <Card className="bg-destructive/10">
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <p className="text-sm">
              <span className="font-medium text-destructive">Rule broken on your last trade:</span>{" "}
              {violation.violatedRules.join(", ")}
            </p>
            <Link
              href={`/trades/${violation.tradeId}`}
              className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
            >
              View trade →
            </Link>
          </CardContent>
        </Card>
      )}

      {goalProgress.isOverDrawdownLimit && (
        <Card className="bg-destructive/10">
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <p className="text-sm">
              <span className="font-medium text-destructive">Drawdown limit exceeded:</span>{" "}
              {goalProgress.currentDrawdownPct?.toFixed(2)}% (limit {goalProgress.maxDrawdownLimitPct}%)
            </p>
            <Link href="/account" className="shrink-0 text-sm text-muted-foreground hover:text-foreground">
              View account →
            </Link>
          </CardContent>
        </Card>
      )}

      {goalProgress.isTargetReached && (
        <Card className="bg-primary/10">
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <p className="text-sm">
              <span className="font-medium">Monthly profit target reached:</span>{" "}
              +{goalProgress.monthToDateProfitPct?.toFixed(2)}% (target {goalProgress.monthlyProfitTargetPct}%)
            </p>
            <Link href="/account" className="shrink-0 text-sm text-muted-foreground hover:text-foreground">
              View account →
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <StreakCard currentStreak={currentStreak} longestStreak={longestStreak} />
        <QuickStats winRate={winRate} avgRealizedR={avgRealizedR} adherence30d={adherence30d} />
        <ChecklistStatusCard {...checklistStatus} />
        <ChecklistStreakCard {...checklistStreaks} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account balance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <span className="text-2xl font-semibold tabular-nums">{balance.toFixed(2)}</span>
          {goalProgress.monthToDateProfitPct != null && (
            <span className="text-sm text-muted-foreground">
              {goalProgress.monthToDateProfitPct >= 0 ? "+" : ""}
              {goalProgress.monthToDateProfitPct.toFixed(2)}% this month
            </span>
          )}
          <Link href="/account" className="ml-auto text-sm text-muted-foreground hover:text-foreground">
            View account →
          </Link>
        </CardContent>
      </Card>

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
