import { z } from "zod";
import {
  CHECK_STATUSES,
  DIRECTIONS,
  DXY_BIASES,
  OUTCOMES,
  SESSIONS,
  TRADE_STATUSES,
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

  setupTagId: z.string().nullable().optional(),
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
