"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTradeAction } from "@/server/actions/trades";

export function DeleteTradeButton({ tradeId }: { tradeId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Delete this trade? This can't be undone.")) return;

    startTransition(async () => {
      try {
        await deleteTradeAction(tradeId);
      } catch (err) {
        // Next.js redirect() throws internally on success — only surface real errors.
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
        toast.error("Could not delete trade. Try again.");
      }
    });
  }

  return (
    <Button type="button" variant="destructive" onClick={handleClick} disabled={isPending}>
      {isPending ? "Deleting…" : "Delete"}
    </Button>
  );
}
