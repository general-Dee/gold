"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Group = { count: number; winRate: number | null; avgR: number | null };

export function CorrelationChart({
  adherent,
  nonAdherent,
}: {
  adherent: Group;
  nonAdherent: Group;
}) {
  if (adherent.count === 0 && nonAdherent.count === 0) {
    return <p className="text-sm text-muted-foreground">Not enough trades yet.</p>;
  }

  const data = [
    {
      group: "Followed rules",
      winRate: adherent.winRate != null ? Math.round(adherent.winRate * 100) : 0,
      count: adherent.count,
    },
    {
      group: "Broke a rule",
      winRate: nonAdherent.winRate != null ? Math.round(nonAdherent.winRate * 100) : 0,
      count: nonAdherent.count,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="group"
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => [`${v}%`, "Win rate"]}
          />
          <Bar dataKey="winRate" fill="var(--primary)" radius={4} barSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground">Followed rules ({adherent.count})</div>
          <div>Avg R: {adherent.avgR != null ? `${adherent.avgR.toFixed(2)}R` : "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Broke a rule ({nonAdherent.count})</div>
          <div>Avg R: {nonAdherent.avgR != null ? `${nonAdherent.avgR.toFixed(2)}R` : "—"}</div>
        </div>
      </div>
    </div>
  );
}
