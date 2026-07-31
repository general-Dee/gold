import { z } from "zod";
import {
  CHECK_STATUSES,
  DIRECTIONS,
  DXY_BIASES,
  OUTCOMES,
  SESSIONS,
  TRADE_STATUSES,
  TRANSACTION_TYPES,
} from "./constants";

export const ruleCheckSchema = z.object({
  ruleId: z.string().min(1),
  status: z.enum(CHECK_STATUSES),
});

export const tradeSchema = z.object({
  direction: z.enum(DIRECTIONS),
  instrument: z.string().min(1).default("XAUUSD"),
  status: z.enum(TRADE_STATUSES).default("closed"),

  entryPrice: z.coerce.number().positive(),
  exitPrice: z.coerce.number().positive().nullable().optional(),
  stopLoss: z.coerce.number().positive(),
  takeProfit: z.coerce.number().positive().nullable().optional(),
  positionSize: z.coerce.number().positive(),

  outcome: z.enum(OUTCOMES).nullable().optional(),
  pnl: z.coerce.number().nullable().optional(),

  setupTagIds: z.array(z.string()).default([]),
  session: z.enum(SESSIONS),
  dxyBias: z.enum(DXY_BIASES).nullable().optional(),
  newsNearby: z.coerce.boolean().default(false),
  newsNote: z.string().nullable().optional(),

  moodBeforeId: z.string().nullable().optional(),
  moodAfterId: z.string().nullable().optional(),

  reasoning: z.string().nullable().optional(),
  notesAfter: z.string().nullable().optional(),

  entryAt: z.string().min(1),
  exitAt: z.string().nullable().optional(),

  ruleChecks: z.array(ruleCheckSchema).default([]),
});

export type TradeInput = z.infer<typeof tradeSchema>;

/** Shape of a parsed CSV import row — mirrors the CSV export's column names,
 * with tags/mood referenced by name (as exported) rather than id. */
export const tradeImportRowSchema = z.object({
  entryAt: z.string().min(1),
  exitAt: z.string().nullable().optional(),
  direction: z.enum(DIRECTIONS),
  instrument: z.string().min(1).default("XAUUSD"),
  status: z.enum(TRADE_STATUSES).default("closed"),

  entryPrice: z.coerce.number().positive(),
  exitPrice: z.coerce.number().positive().nullable().optional(),
  stopLoss: z.coerce.number().positive(),
  takeProfit: z.coerce.number().positive().nullable().optional(),
  positionSize: z.coerce.number().positive(),

  outcome: z.enum(OUTCOMES).nullable().optional(),
  pnl: z.coerce.number().nullable().optional(),

  setupTag: z.string().nullable().optional(),
  session: z.enum(SESSIONS),
  dxyBias: z.enum(DXY_BIASES).nullable().optional(),
  // Plain z.coerce.boolean() would treat the literal string "false" as truthy
  // (Boolean("false") === true) — CSV cells are the literal strings the
  // exporter wrote, so this must special-case that string explicitly.
  newsNearby: z
    .preprocess((v) => (typeof v === "string" ? v.toLowerCase() !== "false" && v !== "" : v), z.boolean())
    .default(false),
  newsNote: z.string().nullable().optional(),

  moodBefore: z.string().nullable().optional(),
  moodAfter: z.string().nullable().optional(),

  reasoning: z.string().nullable().optional(),
  notesAfter: z.string().nullable().optional(),
});

export type TradeImportRow = z.infer<typeof tradeImportRowSchema>;

export const ruleSchema = z.object({
  text: z.string().min(1, "Rule text is required"),
});

export const setupTagSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export const moodTagSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.enum(["before", "after", "both"]).default("both"),
});

export const checklistItemSchema = z.object({
  text: z.string().min(1, "Item text is required"),
});

export const accountSettingsSchema = z.object({
  startingBalance: z.coerce.number(),
  monthlyProfitTargetPct: z.coerce.number().nullable().optional(),
  maxDrawdownLimitPct: z.coerce.number().nullable().optional(),
});

export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;

export const accountTransactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  amount: z.coerce.number().positive(),
  occurredAt: z.string().min(1),
  note: z.string().nullable().optional(),
});

export type AccountTransactionInput = z.infer<typeof accountTransactionSchema>;
