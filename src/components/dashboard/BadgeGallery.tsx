import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveBadge } from "@/server/gamification/badgeDefinitions";

type Unlock = { id: string; badgeKey: string; unlockedAt: string };

export function BadgeGallery({ unlocks, title = "Badges" }: { unlocks: Unlock[]; title?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {unlocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No badges yet — they unlock based on rule-adherence, not profit.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {unlocks.map((u) => {
              const badge = resolveBadge(u.badgeKey);
              return (
                <li key={u.id} className="flex flex-col gap-0.5 rounded-md border px-3 py-2">
                  <span className="text-sm font-medium">{badge.label}</span>
                  <span className="text-xs text-muted-foreground">{badge.description}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(u.unlockedAt).toLocaleDateString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
