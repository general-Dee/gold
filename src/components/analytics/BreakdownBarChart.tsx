"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BreakdownGroup } from "@/server/queries/analytics";

const money = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

export function BreakdownBarChart({ groups }: { groups: BreakdownGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">Not enough trades yet.</p>;
  }

  const data = groups.map((g) => ({
    label: g.label,
    winRate: g.winRate != null ? Math.round(g.winRate * 100) : 0,
  }));

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={Math.max(120, groups.length * 40)}>
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
            dataKey="label"
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
          <Bar dataKey="winRate" fill="var(--primary)" radius={4} barSize={20} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-4 text-sm">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="text-muted-foreground">
              {g.label} ({g.count})
            </div>
            <div>Avg R: {g.avgR != null ? `${g.avgR.toFixed(2)}R` : "—"}</div>
            <div>Expectancy: {g.expectancy != null ? money(g.expectancy) : "—"}</div>
            <div>Total P&L: {money(g.totalPnl)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
