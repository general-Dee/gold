import Link from "next/link";
import { PnlCalendar } from "@/components/calendar/PnlCalendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getDailyPnlForMonth } from "@/server/queries/analytics";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLink(year: number, month: number) {
  return `/calendar?y=${year}&m=${month}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();

  const parsedYear = Number(params.y);
  const parsedMonth = Number(params.m);
  const year = Number.isInteger(parsedYear) && parsedYear > 0 ? parsedYear : now.getFullYear();
  const month =
    Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : now.getMonth() + 1;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const days = await getDailyPnlForMonth(year, month);
  const totalPnl = days.reduce((s, d) => s + d.pnl, 0);
  const totalR = days.reduce((s, d) => s + d.r, 0);
  const totalTrades = days.reduce((s, d) => s + d.tradeCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <div className="flex gap-2">
          <Link href={monthLink(prevYear, prevMonth)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            ← Prev
          </Link>
          <Link href={monthLink(nextYear, nextMonth)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Next →
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {MONTH_NAMES[month - 1]} {year}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {totalTrades} trades · {totalPnl >= 0 ? "+" : ""}
            {totalPnl.toFixed(2)} P&amp;L · {totalR >= 0 ? "+" : ""}
            {totalR.toFixed(2)}R
          </p>
        </CardHeader>
        <CardContent>
          <PnlCalendar year={year} month={month} days={days} />
        </CardContent>
      </Card>
    </div>
  );
}
