import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid());

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
};

export const rules = sqliteTable("rules", {
  id: id(),
  text: text("text").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  archivedAt: text("archived_at"),
  ...timestamps,
});

export const setupTags = sqliteTable("setup_tags", {
  id: id(),
  name: text("name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const moodTags = sqliteTable("mood_tags", {
  id: id(),
  name: text("name").notNull(),
  // 'before' | 'after' | 'both'
  category: text("category").notNull().default("both"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const trades = sqliteTable("trades", {
  id: id(),
  // 'long' | 'short'
  direction: text("direction").notNull(),
  instrument: text("instrument").notNull().default("XAUUSD"),
  // 'open' | 'closed'
  status: text("status").notNull().default("closed"),

  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  stopLoss: real("stop_loss").notNull(),
  takeProfit: real("take_profit"),
  positionSize: real("position_size").notNull(),

  riskRewardPlanned: real("risk_reward_planned"),
  riskRewardRealized: real("risk_reward_realized"),

  // 'win' | 'loss' | 'breakeven'
  outcome: text("outcome"),
  pnl: real("pnl"),

  setupTagId: text("setup_tag_id").references(() => setupTags.id),
  // 'asian' | 'london' | 'ny' | 'overlap' | 'other'
  session: text("session").notNull(),
  // 'up' | 'down' | 'flat'
  dxyBias: text("dxy_bias"),
  newsNearby: integer("news_nearby", { mode: "boolean" }).notNull().default(false),
  newsNote: text("news_note"),

  moodBeforeId: text("mood_before_id").references(() => moodTags.id),
  moodAfterId: text("mood_after_id").references(() => moodTags.id),

  reasoning: text("reasoning"),
  notesAfter: text("notes_after"),

  entryAt: text("entry_at").notNull(),
  exitAt: text("exit_at"),

  ...timestamps,
});

export const tradeImages = sqliteTable("trade_images", {
  id: id(),
  tradeId: text("trade_id")
    .notNull()
    .references(() => trades.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  caption: text("caption"),
  createdAt: timestamps.createdAt,
});

export const tradeRuleChecks = sqliteTable("trade_rule_checks", {
  id: id(),
  tradeId: text("trade_id")
    .notNull()
    .references(() => trades.id, { onDelete: "cascade" }),
  ruleId: text("rule_id")
    .notNull()
    .references(() => rules.id),
  ruleTextSnapshot: text("rule_text_snapshot").notNull(),
  // 'followed' | 'not_followed' | 'not_applicable'
  status: text("status").notNull(),
});

export const badgeUnlocks = sqliteTable("badge_unlocks", {
  id: id(),
  badgeKey: text("badge_key").notNull(),
  tradeId: text("trade_id").references(() => trades.id),
  unlockedAt: text("unlocked_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const checklistItems = sqliteTable("checklist_items", {
  id: id(),
  text: text("text").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  archivedAt: text("archived_at"),
  ...timestamps,
});

export const checklistCompletions = sqliteTable(
  "checklist_completions",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => checklistItems.id, { onDelete: "cascade" }),
    // Local calendar date this completion applies to, 'YYYY-MM-DD' (see src/lib/dates.ts).
    completionDate: text("completion_date").notNull(),
    completedAt: text("completed_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("checklist_completions_item_date_idx").on(table.itemId, table.completionDate),
  ],
);
