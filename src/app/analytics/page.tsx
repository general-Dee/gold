import Link from "next/link";
import { AdherenceTrendChart } from "@/components/analytics/AdherenceTrendChart";
import { BreakdownBarChart } from "@/components/analytics/BreakdownBarChart";
import { CorrelationChart } from "@/components/analytics/CorrelationChart";
import { EquityCurveChart } from "@/components/analytics/EquityCurveChart";
import { RMultipleHistogram } from "@/components/analytics/RMultipleHistogram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAdherenceCorrelation,
  getAdherenceTrend,
  getAverageRiskReward,
  getBreakdownByDayOfWeek,
  getBreakdownByDxyBias,
  getBreakdownByMoodBefore,
  getBreakdownByNewsNearby,
  getBreakdownBySession,
  getBreakdownBySetupTag,
  getEquityCurve,
  getMaxDrawdown,
  getRMultipleDistribution,
  getWinRate,
} from "@/server/queries/analytics";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const rMultiple = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}R`);

export default async function AnalyticsPage() {
  const [
    winRate,
    avgPlannedR,
    avgRealizedR,
    equity,
    adherenceTrend,
    correlation,
    maxDrawdown,
    bySetupTag,
    bySession,
    byMoodBefore,
    byDayOfWeek,
    byDxyBias,
    byNewsNearby,
    rDistribution,
  ] = await Promise.all([
    getWinRate(),
    getAverageRiskReward("planned"),
    getAverageRiskReward("realized"),
    getEquityCurve(),
    getAdherenceTrend(),
    getAdherenceCorrelation(),
    getMaxDrawdown(),
    getBreakdownBySetupTag(),
    getBreakdownBySession(),
    getBreakdownByMoodBefore(),
    getBreakdownByDayOfWeek(),
    getBreakdownByDxyBias(),
    getBreakdownByNewsNearby(),
    getRMultipleDistribution(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Win rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{pct(winRate)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Avg planned R:R</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {rMultiple(avgPlannedR)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Avg realized R</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {rMultiple(avgRealizedR)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Max drawdown</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {maxDrawdown ? `-${maxDrawdown.maxDrawdownR.toFixed(2)}R` : "—"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equity curve (cumulative R)</CardTitle>
        </CardHeader>
        <CardContent>
          <EquityCurveChart data={equity} metric="cumulativeR" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>R-multiple distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <RMultipleHistogram data={rDistribution} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rule adherence over time</CardTitle>
        </CardHeader>
        <CardContent>
          <AdherenceTrendChart data={adherenceTrend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Does following your rules actually help?</CardTitle>
        </CardHeader>
        <CardContent>
          <CorrelationChart adherent={correlation.adherent} nonAdherent={correlation.nonAdherent} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Performance by setup</CardTitle>
          <Link href="/setups" className="text-sm text-muted-foreground hover:underline">
            View all setups →
          </Link>
        </CardHeader>
        <CardContent>
          <BreakdownBarChart groups={bySetupTag} linkBase="/setups" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance by session</CardTitle>
        </CardHeader>
        <CardContent>
          <BreakdownBarChart groups={bySession} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance by mood (before trade)</CardTitle>
        </CardHeader>
        <CardContent>
          <BreakdownBarChart groups={byMoodBefore} linkBase="/moods" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance by day of week</CardTitle>
        </CardHeader>
        <CardContent>
          <BreakdownBarChart groups={byDayOfWeek} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance by DXY bias</CardTitle>
        </CardHeader>
        <CardContent>
          <BreakdownBarChart groups={byDxyBias} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance by news proximity</CardTitle>
        </CardHeader>
        <CardContent>
          <BreakdownBarChart groups={byNewsNearby} />
        </CardContent>
      </Card>
    </div>
  );
}
