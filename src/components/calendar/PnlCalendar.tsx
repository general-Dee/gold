import Link from "next/link";
import type { CSSProperties } from "react";
import { getMonthGrid, localDateKey } from "@/lib/dates";
import type { DailyPnlPoint } from "@/server/queries/analytics";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PnlCalendar({
  year,
  month,
  days,
}: {
  year: number;
  month: number;
  days: DailyPnlPoint[];
}) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const grid = getMonthGrid(year, month);
  const maxAbsPnl = Math.max(1, ...days.map((d) => Math.abs(d.pnl)));

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-xs text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((date, i) => {
          if (date == null) return <div key={`blank-${i}`} />;

          const key = localDateKey(date);
          const point = byDate.get(key);
          const hasTrades = point != null && point.tradeCount > 0;

          let style: CSSProperties | undefined;
          let textClass = "text-foreground";
          if (hasTrades && point.pnl !== 0) {
            const tone = point.pnl > 0 ? "var(--pnl-profit)" : "var(--pnl-loss)";
            const intensity = Math.min(1, Math.abs(point.pnl) / maxAbsPnl);
            const mixPercent = Math.round(20 + intensity * 60);
            style = { backgroundColor: `color-mix(in oklch, ${tone} ${mixPercent}%, var(--card))` };
            textClass = mixPercent > 45 ? "text-white" : "text-foreground";
          }

          return (
            <Link
              key={key}
              href={`/trades?from=${key}&to=${key}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-md border text-xs transition-colors ${
                hasTrades ? "hover:opacity-80" : "text-muted-foreground hover:bg-muted/40"
              } ${textClass}`}
              style={style}
            >
              <span className="font-medium">{date.getDate()}</span>
              {hasTrades && (
                <span className="tabular-nums">
                  {point.pnl >= 0 ? "+" : ""}
                  {Math.round(point.pnl)}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
