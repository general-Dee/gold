"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RuleChecklist, type ChecklistRule } from "@/components/trades/RuleChecklist";
import { plannedRiskReward, realizedRiskReward, suggestPositionSize } from "@/lib/calculations";
import { cn } from "@/lib/utils";
import {
  DXY_BIASES,
  DIRECTIONS,
  OUTCOMES,
  SESSIONS,
  sessionFromEntryTime,
  type CheckStatus,
} from "@/lib/constants";
import type { TradeInput } from "@/lib/validation";

/** Empty string -> null, otherwise Number(v) — used for optional numeric fields. */
const optionalNumber = (v: string) => (v === "" ? null : Number(v));
/** Empty option value ("—") -> null — used for optional select/enum fields. */
const optionalSelect = (v: string) => (v === "" ? null : v);

type Option = { id: string; name: string };
type MoodOption = { id: string; name: string; category: string };

export const toDatetimeLocal = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

export function TradeForm({
  rules,
  setupTags,
  moodTags,
  initialTrade,
  initialChecks,
  onSubmitAction,
  accountBalance,
}: {
  rules: ChecklistRule[];
  setupTags: Option[];
  moodTags: MoodOption[];
  initialTrade?: TradeInput & { id?: string };
  initialChecks?: { ruleId: string; status: CheckStatus }[];
  onSubmitAction: (input: TradeInput) => Promise<unknown>;
  accountBalance: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [checklist, setChecklist] = useState<Record<string, CheckStatus>>(() => {
    const map: Record<string, CheckStatus> = {};
    for (const c of initialChecks ?? []) map[c.ruleId] = c.status;
    return map;
  });
  const [riskPct, setRiskPct] = useState(1);
  const [setupTagIds, setSetupTagIds] = useState<string[]>(initialTrade?.setupTagIds ?? []);

  const now = new Date();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TradeInput>({
    defaultValues: initialTrade ?? {
      direction: "long",
      instrument: "XAUUSD",
      status: "closed",
      session: sessionFromEntryTime(now),
      entryAt: toDatetimeLocal(now.toISOString()),
      newsNearby: false,
      ruleChecks: [],
    },
  });

  const direction = watch("direction");
  const entryPrice = watch("entryPrice");
  const stopLoss = watch("stopLoss");
  const takeProfit = watch("takeProfit");
  const exitPrice = watch("exitPrice");
  const newsNearby = watch("newsNearby");

  const plannedRR = useMemo(() => {
    if (!entryPrice || !stopLoss) return null;
    return plannedRiskReward({
      direction,
      entryPrice: Number(entryPrice),
      stopLoss: Number(stopLoss),
      takeProfit: takeProfit ? Number(takeProfit) : null,
    });
  }, [direction, entryPrice, stopLoss, takeProfit]);

  const realizedRR = useMemo(() => {
    if (!entryPrice || !stopLoss) return null;
    return realizedRiskReward({
      direction,
      entryPrice: Number(entryPrice),
      stopLoss: Number(stopLoss),
      exitPrice: exitPrice ? Number(exitPrice) : null,
    });
  }, [direction, entryPrice, stopLoss, exitPrice]);

  const suggestedPositionSize = useMemo(() => {
    if (!entryPrice || !stopLoss) return null;
    return suggestPositionSize({
      accountBalance,
      riskPct,
      entryPrice: Number(entryPrice),
      stopLoss: Number(stopLoss),
    });
  }, [accountBalance, riskPct, entryPrice, stopLoss]);

  const onSubmit = (values: TradeInput) => {
    const ruleChecks = Object.entries(checklist).map(([ruleId, status]) => ({
      ruleId,
      status,
    }));

    const entryAtIso = values.entryAt ? new Date(values.entryAt).toISOString() : values.entryAt;
    const exitAtIso = values.exitAt ? new Date(values.exitAt).toISOString() : values.exitAt;

    startTransition(async () => {
      try {
        await onSubmitAction({
          ...values,
          entryAt: entryAtIso,
          exitAt: exitAtIso,
          ruleChecks,
          setupTagIds,
        });
      } catch (err) {
        // Next.js redirect() throws internally on success — only surface real errors.
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
        toast.error("Could not save trade. Check the form and try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Trade details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="direction" className="mb-1.5 block">
              Direction
            </Label>
            <select
              id="direction"
              {...register("direction")}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="session" className="mb-1.5 block">
              Session
            </Label>
            <select
              id="session"
              {...register("session")}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              {SESSIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="mb-1.5 block">Setup</Label>
            {setupTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No setup tags yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {setupTags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setSetupTagIds((prev) =>
                        prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id],
                      )
                    }
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      setupTagIds.includes(t.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent",
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="entryAt" className="mb-1.5 block">
              Entry time
            </Label>
            <Input
              id="entryAt"
              type="datetime-local"
              {...register("entryAt", {
                onChange: (e) => {
                  if (e.target.value) {
                    setValue("session", sessionFromEntryTime(new Date(e.target.value)));
                  }
                },
              })}
            />
          </div>

          <div>
            <Label htmlFor="exitAt" className="mb-1.5 block">
              Exit time
            </Label>
            <Input id="exitAt" type="datetime-local" {...register("exitAt")} />
          </div>

          <div>
            <Label htmlFor="positionSize" className="mb-1.5 block">
              Position size (lots)
            </Label>
            <Input
              id="positionSize"
              type="number"
              step="any"
              {...register("positionSize", {
                required: "Required",
                setValueAs: (v) => (v === "" ? undefined : Number(v)),
              })}
            />
            {errors.positionSize && (
              <p className="mt-1 text-xs text-destructive">{errors.positionSize.message}</p>
            )}
            <div className="mt-2 flex items-end gap-2">
              <div>
                <Label htmlFor="riskPct" className="mb-1.5 block text-xs text-muted-foreground">
                  Risk %
                </Label>
                <Input
                  id="riskPct"
                  type="number"
                  step="any"
                  className="w-20"
                  value={riskPct}
                  onChange={(e) => setRiskPct(Number(e.target.value))}
                />
              </div>
              <p className="pb-1.5 text-xs text-muted-foreground">
                {suggestedPositionSize != null ? `${suggestedPositionSize.toFixed(2)} lots` : "—"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={suggestedPositionSize == null}
                onClick={() => {
                  if (suggestedPositionSize != null) setValue("positionSize", suggestedPositionSize);
                }}
              >
                Use this
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="entryPrice" className="mb-1.5 block">
              Entry price
            </Label>
            <Input
              id="entryPrice"
              type="number"
              step="any"
              {...register("entryPrice", {
                required: "Required",
                setValueAs: (v) => (v === "" ? undefined : Number(v)),
              })}
            />
            {errors.entryPrice && (
              <p className="mt-1 text-xs text-destructive">{errors.entryPrice.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="stopLoss" className="mb-1.5 block">
              Stop loss
            </Label>
            <Input
              id="stopLoss"
              type="number"
              step="any"
              {...register("stopLoss", {
                required: "Required",
                setValueAs: (v) => (v === "" ? undefined : Number(v)),
              })}
            />
            {errors.stopLoss && (
              <p className="mt-1 text-xs text-destructive">{errors.stopLoss.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="takeProfit" className="mb-1.5 block">
              Take profit (planned)
            </Label>
            <Input
              id="takeProfit"
              type="number"
              step="any"
              {...register("takeProfit", { setValueAs: optionalNumber })}
            />
          </div>

          <div>
            <Label htmlFor="exitPrice" className="mb-1.5 block">
              Exit price (actual)
            </Label>
            <Input
              id="exitPrice"
              type="number"
              step="any"
              {...register("exitPrice", { setValueAs: optionalNumber })}
            />
          </div>

          <div className="flex flex-col justify-center rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Planned R:R</span>
            <span className="font-medium">{plannedRR != null ? `${plannedRR.toFixed(2)}R` : "—"}</span>
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
              {...register("outcome", { setValueAs: optionalSelect })}
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
          <CardTitle>XAUUSD context</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="dxyBias" className="mb-1.5 block">
              DXY bias
            </Label>
            <select
              id="dxyBias"
              {...register("dxyBias", { setValueAs: optionalSelect })}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">—</option>
              {DXY_BIASES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              id="newsNearby"
              checked={!!newsNearby}
              onCheckedChange={(v) => setValue("newsNearby", v === true)}
            />
            <Label htmlFor="newsNearby">High-impact news nearby</Label>
          </div>

          {newsNearby && (
            <div className="sm:col-span-2 lg:col-span-1">
              <Label htmlFor="newsNote" className="mb-1.5 block">
                News note
              </Label>
              <Input id="newsNote" {...register("newsNote")} placeholder="e.g. NFP at 12:30" />
            </div>
          )}

          <div>
            <Label htmlFor="moodBeforeId" className="mb-1.5 block">
              Mood before
            </Label>
            <select
              id="moodBeforeId"
              {...register("moodBeforeId", { setValueAs: optionalSelect })}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">—</option>
              {moodTags
                .filter((m) => m.category !== "after")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <Label htmlFor="moodAfterId" className="mb-1.5 block">
              Mood after
            </Label>
            <select
              id="moodAfterId"
              {...register("moodAfterId", { setValueAs: optionalSelect })}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">—</option>
              {moodTags
                .filter((m) => m.category !== "before")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rule checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <RuleChecklist
            rules={rules}
            value={checklist}
            onChange={(ruleId, status) =>
              setChecklist((prev) => ({ ...prev, [ruleId]: status }))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reasoning & reflection</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="reasoning" className="mb-1.5 block">
              Pre-trade thesis
            </Label>
            <Textarea id="reasoning" rows={3} {...register("reasoning")} />
          </div>
          <div>
            <Label htmlFor="notesAfter" className="mb-1.5 block">
              Post-trade reflection
            </Label>
            <Textarea id="notesAfter" rows={3} {...register("notesAfter")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save trade"}
        </Button>
      </div>
    </form>
  );
}
