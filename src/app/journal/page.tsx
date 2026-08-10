import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listReflections } from "@/server/queries/reflections";

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default async function JournalPage() {
  const entries = await listReflections();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Journal</h1>
          <p className="text-sm text-muted-foreground">Weekly and monthly reflections.</p>
        </div>
        <Link href="/journal/new" className={buttonVariants()}>
          New entry
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reflections yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {entries.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/journal/${e.id}/edit`}
                    className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <Badge variant="secondary" className="capitalize">
                      {e.period}
                    </Badge>
                    <span className="text-muted-foreground">{e.periodStart}</span>
                    <span className="truncate">{truncate(e.body, 80)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
