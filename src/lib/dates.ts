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
