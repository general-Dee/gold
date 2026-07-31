"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DIRECTIONS, OUTCOMES, SESSIONS } from "@/lib/constants";

type Option = { id: string; name: string };

const selectClassName = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function TradesFilterBar({ setupTags }: { setupTags: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const isFirstRender = useRef(true);

  const pushParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Debounce the free-text search so it doesn't refetch on every keystroke.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => pushParams({ q }), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = Array.from(searchParams.keys()).length > 0;

  return (
    <div className="flex flex-col gap-4 rounded-md border p-4">
      <div key={searchParams.toString()} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <Label htmlFor="filter-from" className="mb-1.5 block">
            From
          </Label>
          <Input
            id="filter-from"
            type="date"
            defaultValue={searchParams.get("from") ?? ""}
            onChange={(e) => pushParams({ from: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="filter-to" className="mb-1.5 block">
            To
          </Label>
          <Input
            id="filter-to"
            type="date"
            defaultValue={searchParams.get("to") ?? ""}
            onChange={(e) => pushParams({ to: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="filter-direction" className="mb-1.5 block">
            Direction
          </Label>
          <select
            id="filter-direction"
            className={selectClassName}
            defaultValue={searchParams.get("direction") ?? ""}
            onChange={(e) => pushParams({ direction: e.target.value })}
          >
            <option value="">All</option>
            {DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="filter-outcome" className="mb-1.5 block">
            Outcome
          </Label>
          <select
            id="filter-outcome"
            className={selectClassName}
            defaultValue={searchParams.get("outcome") ?? ""}
            onChange={(e) => pushParams({ outcome: e.target.value })}
          >
            <option value="">All</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="filter-session" className="mb-1.5 block">
            Session
          </Label>
          <select
            id="filter-session"
            className={selectClassName}
            defaultValue={searchParams.get("session") ?? ""}
            onChange={(e) => pushParams({ session: e.target.value })}
          >
            <option value="">All</option>
            {SESSIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="filter-setup" className="mb-1.5 block">
            Setup
          </Label>
          <select
            id="filter-setup"
            className={selectClassName}
            defaultValue={searchParams.get("setupTagId") ?? ""}
            onChange={(e) => pushParams({ setupTagId: e.target.value })}
          >
            <option value="">All</option>
            {setupTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label htmlFor="filter-q" className="mb-1.5 block">
            Search reasoning &amp; notes
          </Label>
          <Input
            id="filter-q"
            type="text"
            placeholder="e.g. breakout, news, FOMO..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {hasFilters && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setQ("");
              router.push(pathname, { scroll: false });
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
