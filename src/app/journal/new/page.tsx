import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { localDateKey } from "@/lib/dates";
import { createReflectionAction } from "@/server/actions/reflections";

export default function NewReflectionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New reflection</h1>
        <p className="text-sm text-muted-foreground">
          Pick any date in the week or month you&apos;re reflecting on.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action={createReflectionAction} className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div>
                <Label htmlFor="period" className="mb-1.5 block">
                  Period
                </Label>
                <select
                  id="period"
                  name="period"
                  defaultValue="weekly"
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <Label htmlFor="anchorDate" className="mb-1.5 block">
                  Date within period
                </Label>
                <Input
                  id="anchorDate"
                  name="anchorDate"
                  type="date"
                  defaultValue={localDateKey()}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="body" className="mb-1.5 block">
                Reflection
              </Label>
              <Textarea
                id="body"
                name="body"
                rows={10}
                placeholder="What went well, what didn't, what to change..."
                required
              />
            </div>
            <Button type="submit" className="self-start">
              Save
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
