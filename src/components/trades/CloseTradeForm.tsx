"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toDatetimeLocal } from "@/components/trades/TradeForm";
import { realizedRiskReward } from "@/lib/calculations";
import { OUTCOMES } from "@/lib/constants";
import type { TradeInput } from "@/lib/validation";

type CloseFields = {
  exitPrice: number;
  exitAt: string;
  outcome: TradeInput["outcome"];
  pnl: TradeInput["pnl"];
  notesAfter: TradeInput["notesAfter"];
};

// See TradeForm.tsx's optionalNumber for why null/undefined must be handled
// alongside "" — untouched fields resubmit their raw (possibly null) defaultValue.
const optionalNumber = (v: string | number | null | undefined) =>
  v === "" || v == null ? null : Number(v);

export function CloseTradeForm({
  trade,
  onSubmitAction,
}: {
  trade: TradeInput;
  onSubmitAction: (input: TradeInput) => Promise<unknown>;
}) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<CloseFields>({
    defaultValues: {
      exitPrice: trade.exitPrice ?? undefined,
      exitAt: toDatetimeLocal(trade.exitAt) || toDatetimeLocal(new Date().toISOString()),
      outcome: trade.outcome ?? undefined,
      pnl: trade.pnl ?? undefined,
      notesAfter: trade.notesAfter ?? "",
    },
  });

  const exitPrice = watch("exitPrice");

  const realizedRR = useMemo(() => {
    if (!exitPrice) return null;
    return realizedRiskReward({
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      stopLoss: trade.stopLoss,
      exitPrice: Number(exitPrice),
    });
  }, [trade.direction, trade.entryPrice, trade.stopLoss, exitPrice]);

  const suggestedOutcome = useMemo(() => {
    if (realizedRR == null) return null;
    // Small dead-zone around 0R so near-flat exits suggest breakeven instead
    // of an arbitrary win/loss based on a fractional-pip sign flip.
    if (Math.abs(realizedRR) < 0.05) return "breakeven";
    return realizedRR > 0 ? "win" : "loss";
  }, [realizedRR]);

  // Only auto-fill outcome while the user hasn't touched the field, so a
  // manual choice is never silently overwritten as exit price changes.
  useEffect(() => {
    if (suggestedOutcome && !dirtyFields.outcome) {
      setValue("outcome", suggestedOutcome);
    }
  }, [suggestedOutcome, dirtyFields.outcome, setValue]);

  const onSubmit = (values: CloseFields) => {
    startTransition(async () => {
      try {
        await onSubmitAction({
          ...trade,
          exitPrice: values.exitPrice,
          exitAt: values.exitAt ? new Date(values.exitAt).toISOString() : values.exitAt,
          outcome: values.outcome,
          pnl: values.pnl,
          notesAfter: values.notesAfter,
        });
      } catch (err) {
        // Next.js redirect() throws internally on success — only surface real errors.
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
        toast.error("Could not close trade. Check the form and try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Exit details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="exitPrice" className="mb-1.5 block">
              Exit price
            </Label>
            <Input
              id="exitPrice"
              type="number"
              step="any"
              {...register("exitPrice", {
                required: "Required",
                setValueAs: (v) => (v === "" ? undefined : Number(v)),
              })}
            />
            {errors.exitPrice && (
              <p className="mt-1 text-xs text-destructive">{errors.exitPrice.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="exitAt" className="mb-1.5 block">
              Exit time
            </Label>
            <Input
              id="exitAt"
              type="datetime-local"
              {...register("exitAt", { required: "Required" })}
            />
          </div>

          <div className="flex flex-col justify-center rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Realized R:R</span>
            <span className="font-medium">
              {realizedRR != null ? `${realizedRR.toFixed(2)}R` : "—"}
            </span>
          </div>

          <div>
            <Label htmlFor="outcome" className="mb-1.5 block">
              Outcome
            </Label>
            <select
              id="outcome"
              {...register("outcome", { setValueAs: (v) => (v === "" ? null : v) })}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">—</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="pnl" className="mb-1.5 block">
              P&amp;L (account currency)
            </Label>
            <Input
              id="pnl"
              type="number"
              step="any"
              {...register("pnl", { setValueAs: optionalNumber })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Post-trade reflection</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="notesAfter" className="mb-1.5 block">
            Notes
          </Label>
          <Textarea id="notesAfter" rows={3} {...register("notesAfter")} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Closing…" : "Close trade"}
        </Button>
      </div>
    </form>
  );
}
