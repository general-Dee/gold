"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RMultipleBucket } from "@/server/queries/analytics";

export function RMultipleHistogram({ data }: { data: RMultipleBucket[] }) {
  if (data.every((d) => d.count === 0)) {
    return <p className="text-sm text-muted-foreground">Not enough trades yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 0, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="bucket"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v) => [v, "Trades"]}
        />
        <Bar dataKey="count" fill="var(--primary)" radius={4} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
