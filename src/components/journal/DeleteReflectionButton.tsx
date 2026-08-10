"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteReflectionAction } from "@/server/actions/reflections";

export function DeleteReflectionButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Delete this reflection? This can't be undone.")) return;

    startTransition(async () => {
      try {
        await deleteReflectionAction(id);
      } catch (err) {
        // Next.js redirect() throws internally on success — only surface real errors.
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
        toast.error("Could not delete reflection. Try again.");
      }
    });
  }

  return (
    <Button type="button" variant="destructive" onClick={handleClick} disabled={isPending}>
      {isPending ? "Deleting…" : "Delete entry"}
    </Button>
  );
}
