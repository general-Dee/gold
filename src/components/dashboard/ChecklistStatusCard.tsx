import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChecklistStatusCard({
  total,
  completed,
  allDone,
}: {
  total: number;
  completed: number;
  allDone: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pre-market checklist</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div>
          <div
            className={`text-2xl font-semibold tabular-nums ${allDone ? "text-primary" : ""}`}
          >
            {completed} / {total}
          </div>
          <div className="text-xs text-muted-foreground">
            {total === 0 ? "No items configured" : allDone ? "All done today" : "steps done today"}
          </div>
        </div>
        <Link href="/checklist" className="text-sm text-muted-foreground hover:text-foreground">
          Open →
        </Link>
      </CardContent>
    </Card>
  );
}
