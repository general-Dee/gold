import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  archiveMoodTagAction,
  archiveRuleAction,
  archiveSetupTagAction,
  createMoodTagAction,
  createRuleAction,
  createSetupTagAction,
} from "@/server/actions/rules";
import { listActiveMoodTags, listActiveRules, listActiveSetupTags } from "@/server/queries/rules";

export default async function RulesPage() {
  const [rules, setupTags, moodTags] = await Promise.all([
    listActiveRules(),
    listActiveSetupTags(),
    listActiveMoodTags(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rules & Tags</h1>
        <p className="text-sm text-muted-foreground">
          These are your own trading rules. Every trade you log gets checked against this list —
          this is what your discipline streak is built on.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trading rules</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm"
              >
                <span>{rule.text}</span>
                <form action={archiveRuleAction.bind(null, rule.id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Archive
                  </Button>
                </form>
              </li>
            ))}
            {rules.length === 0 && (
              <li className="text-sm text-muted-foreground">No rules yet — add one below.</li>
            )}
          </ul>
          <Separator />
          <form action={createRuleAction} className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="text" className="mb-1.5 block">
                New rule
              </Label>
              <Input id="text" name="text" placeholder="e.g. Risk sized at or below 1%" required />
            </div>
            <Button type="submit">Add rule</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup tags</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-wrap gap-2">
            {setupTags.map((tag) => (
              <li
                key={tag.id}
                className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
              >
                {tag.name}
                <form action={archiveSetupTagAction.bind(null, tag.id)}>
                  <button type="submit" className="text-muted-foreground hover:text-foreground">
                    ×
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <Separator />
          <form action={createSetupTagAction} className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="setup-name" className="mb-1.5 block">
                New setup tag
              </Label>
              <Input id="setup-name" name="name" placeholder="e.g. London breakout" required />
            </div>
            <Button type="submit">Add tag</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mood tags</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-wrap gap-2">
            {moodTags.map((tag) => (
              <li
                key={tag.id}
                className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
              >
                {tag.name}
                <span className="text-xs text-muted-foreground">({tag.category})</span>
                <form action={archiveMoodTagAction.bind(null, tag.id)}>
                  <button type="submit" className="text-muted-foreground hover:text-foreground">
                    ×
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <Separator />
          <form action={createMoodTagAction} className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="mood-name" className="mb-1.5 block">
                New mood tag
              </Label>
              <Input id="mood-name" name="name" placeholder="e.g. Anxious" required />
            </div>
            <div>
              <Label htmlFor="mood-category" className="mb-1.5 block">
                Category
              </Label>
              <select
                id="mood-category"
                name="category"
                defaultValue="both"
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="before">Before</option>
                <option value="after">After</option>
                <option value="both">Both</option>
              </select>
            </div>
            <Button type="submit">Add tag</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
