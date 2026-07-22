import { TradeForm } from "@/components/trades/TradeForm";
import { createTradeAction } from "@/server/actions/trades";
import { listActiveMoodTags, listActiveRules, listActiveSetupTags } from "@/server/queries/rules";

export default async function NewTradePage() {
  const [rules, setupTags, moodTags] = await Promise.all([
    listActiveRules(),
    listActiveSetupTags(),
    listActiveMoodTags(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log a trade</h1>
        <p className="text-sm text-muted-foreground">
          Fill this in right after you take the trade — the checklist below is what builds your
          streak.
        </p>
      </div>
      <TradeForm
        rules={rules}
        setupTags={setupTags}
        moodTags={moodTags}
        onSubmitAction={createTradeAction}
      />
    </div>
  );
}
