"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importTradesAction, type ImportResult } from "@/server/actions/import";

export function ImportTradesDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      try {
        const res = await importTradesAction(formData);
        setResult(res);
        if (res.importedCount > 0) {
          toast.success(
            `Imported ${res.importedCount} trade${res.importedCount === 1 ? "" : "s"}.`,
          );
        }
        if (res.skipped.length > 0) {
          toast.error(`${res.skipped.length} row(s) could not be imported.`);
        }
        formRef.current?.reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setResult(null);
      }}
    >
      <DialogTrigger className={buttonVariants({ variant: "outline" })}>
        Import CSV
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import trades from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV in this app&apos;s export format. Unknown setup/mood tag names are
            created automatically. Rows that fail validation are skipped and reported below.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            disabled={isPending}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-2.5 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
          />
          <DialogFooter>
            <DialogClose className={buttonVariants({ variant: "outline" })}>
              Close
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </form>

        {result && (
          <div className="flex flex-col gap-2 border-t pt-3 text-sm">
            <p>
              Imported <strong>{result.importedCount}</strong> trade
              {result.importedCount === 1 ? "" : "s"}.
            </p>
            {result.createdSetupTags.length > 0 && (
              <p className="text-muted-foreground">
                New setup tags created: {result.createdSetupTags.join(", ")}
              </p>
            )}
            {result.createdMoodTags.length > 0 && (
              <p className="text-muted-foreground">
                New mood tags created: {result.createdMoodTags.join(", ")}
              </p>
            )}
            {result.skipped.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="font-medium text-destructive">
                  {result.skipped.length} row(s) skipped:
                </p>
                <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-muted-foreground">
                  {result.skipped.map((s) => (
                    <li key={s.row}>
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
