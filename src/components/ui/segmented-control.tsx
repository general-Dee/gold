"use client";

import { cn } from "@/lib/utils";

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Override the active-state classes (e.g. accent-2 for a "broke rule" option). */
  activeClassName?: string;
};

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  name,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  name?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn("inline-flex gap-1 rounded-lg border border-border bg-card p-1", className)}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? (opt.activeClassName ?? "bg-primary text-primary-foreground")
                : "text-muted-foreground hover:bg-accent-100 hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export { SegmentedControl };
