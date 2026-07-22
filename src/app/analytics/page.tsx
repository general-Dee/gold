import { AdherenceTrendChart } from "@/components/analytics/AdherenceTrendChart";
import { CorrelationChart } from "@/components/analytics/CorrelationChart";
import { EquityCurveChart } from "@/components/analytics/EquityCurveChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAdherenceCorrelation,
  getAdherenceTrend,
  getAverageRiskReward,
  getEquityCurve,
  getWinRate,
} from "@/server/queries/analytics";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const rMultiple = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}R`);

export default async function AnalyticsPage() {
  const [winRate, avgPlannedR, avgRealizedR, equity, adherenceTrend, correlation] =
    await Promise.all([
      getWinRate(),
      getAverageRiskReward("planned"),
      getAverageRiskReward("realized"),
      getEquityCurve(),
      getAdherenceTrend(),
      getAdherenceCorrelation(),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
    </div>
  );
}
