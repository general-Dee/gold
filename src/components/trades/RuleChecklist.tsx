"use client";

import type { CheckStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type ChecklistRule = { id: string; text: string };

const OPTIONS: { value: CheckStatus; label: string }[] = [
  { value: "followed", label: "Followed" },
  { value: "not_followed", label: "Broke it" },
  { value: "not_applicable", label: "N/A" },
];

export function RuleChecklist({
  rules,
  value,
  onChange,
}: {
  rules: ChecklistRule[];
  value: Record<string, CheckStatus>;
  onChange: (ruleId: string, status: CheckStatus) => void;
}) {
  if (rules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active rules yet. Add some on the Rules page to start building a discipline streak.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rules.map((rule) => (
        <div key={rule.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm">{rule.text}</span>
          <div className="flex gap-1">
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(rule.id, opt.value)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  value[rule.id] === opt.value
                    ? opt.value === "not_followed"
                      ? "border-destructive bg-destructive text-white"
                      : "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
