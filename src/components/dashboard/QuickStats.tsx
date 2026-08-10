import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const rMultiple = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}R`);

export function QuickStats({
  winRate,
  avgRealizedR,
  adherence30d,
}: {
  winRate: number | null;
  avgRealizedR: number | null;
  adherence30d: number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick stats</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Stat label="Win rate" value={pct(winRate)} />
        <Stat label="Avg realized R" value={rMultiple(avgRealizedR)} />
        <Stat label="30-day adherence" value={pct(adherence30d)} />
      </CardContent>
    </Card>
  );
}
