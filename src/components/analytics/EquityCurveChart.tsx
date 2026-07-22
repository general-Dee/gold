"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@/server/queries/analytics";

export function EquityCurveChart({
  data,
  metric = "cumulativePnl",
  sparkline = false,
}: {
  data: EquityPoint[];
  metric?: "cumulativePnl" | "cumulativeR";
  sparkline?: boolean;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No closed trades yet.</p>;
  }

  const chartData = data.map((d, i) => ({ index: i + 1, value: d[metric] }));

  return (
    <ResponsiveContainer width="100%" height={sparkline ? 60 : 240}>
      <LineChart data={chartData} margin={sparkline ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}>
        {!sparkline && (
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        )}
        {!sparkline && (
          <XAxis dataKey="index" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        )}
        {!sparkline && (
          <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={48} />
        )}
        {!sparkline && (
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => `Trade #${v}`}
            formatter={(v) => [
              metric === "cumulativeR" ? `${Number(v).toFixed(2)}R` : Number(v).toFixed(2),
              "",
            ]}
          />
        )}
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
