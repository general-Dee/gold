"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AdherencePoint } from "@/server/queries/analytics";

export function AdherenceTrendChart({ data }: { data: AdherencePoint[] }) {
  const withRatio = data.filter((d) => d.adherenceRatio !== null);
  if (withRatio.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No checklist data yet — fill in the rule checklist on trades to see this trend.
      </p>
    );
  }

  const chartData = withRatio.map((d, i) => ({
    index: i + 1,
    value: Math.round((d.adherenceRatio ?? 0) * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="index"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => `Trade #${v}`}
          formatter={(v) => [`${v}%`, "Adherence"]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
