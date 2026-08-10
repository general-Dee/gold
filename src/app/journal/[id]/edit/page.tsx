import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DeleteReflectionButton } from "@/components/journal/DeleteReflectionButton";
import { updateReflectionAction } from "@/server/actions/reflections";
import { getReflectionById } from "@/server/queries/reflections";

export default async function EditReflectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await getReflectionById(id);
  if (!entry) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="capitalize">
          {entry.period}
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">{entry.periodStart}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reflection</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <form
            action={updateReflectionAction.bind(null, entry.id)}
            className="flex flex-col gap-4"
          >
            <div>
              <Label htmlFor="body" className="mb-1.5 block">
                Reflection
              </Label>
              <Textarea id="body" name="body" rows={10} defaultValue={entry.body} required />
            </div>
            <Button type="submit" className="self-start">
              Save
            </Button>
          </form>

          <DeleteReflectionButton id={entry.id} />
        </CardContent>
      </Card>
    </div>
  );
}
