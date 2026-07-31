/** Local (server machine) calendar date key, e.g. "2026-07-29". Not UTC — these are
 * daily-routine features tied to the user's actual wall-clock day, not price sessions. */
export function localDateKey(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfLocalDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** ISO-8601 week: Monday 00:00 local through the following Monday 00:00 local. */
export function startOfIsoWeek(d: Date = new Date()): Date {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  const start = startOfLocalDay(d);
  start.setDate(start.getDate() + diff);
  return start;
}

/** Calendar cells for a month grid, Sunday-first, padded with nulls so the
 * grid aligns to weekday columns. `month` is 1-indexed (1 = January). */
export function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = first.getDay(); // 0=Sun..6=Sat
  const days: (Date | null)[] = Array(leadingBlanks).fill(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month - 1, d));
  return days;
}
