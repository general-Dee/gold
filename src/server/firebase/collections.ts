import type { CollectionReference, FirestoreDataConverter } from "firebase-admin/firestore";
import { db } from "./client";

/**
 * A generic id-outside-the-document-body converter: Firestore doc IDs aren't
 * automatically fields, so this adds/strips `id` on read/write to match the
 * `{id, ...fields}` row shape every query function used to get from Drizzle.
 */
function converter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(data) {
      const { id: _id, ...rest } = data as T;
      return rest;
    },
    fromFirestore(snapshot) {
      return { id: snapshot.id, ...snapshot.data() } as T;
    },
  };
}

function collection<T extends { id: string }>(name: string): CollectionReference<T> {
  return db.collection(name).withConverter(converter<T>());
}

export interface Rule {
  id: string;
  text: string;
  sortOrder: number;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetupTag {
  id: string;
  name: string;
  notes: string | null;
  expectedR: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MoodTag {
  id: string;
  name: string;
  category: "before" | "after" | "both";
  notes: string | null;
  expectedR: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TradeRuleCheck {
  ruleId: string;
  ruleTextSnapshot: string;
  status: "followed" | "not_followed" | "not_applicable";
}

export interface Trade {
  id: string;
  direction: "long" | "short";
  instrument: string;
  status: "open" | "closed";
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number;
  takeProfit: number | null;
  positionSize: number;
  riskRewardPlanned: number | null;
  riskRewardRealized: number | null;
  outcome: "win" | "loss" | "breakeven" | null;
  pnl: number | null;
  session: "asian" | "london" | "ny" | "overlap" | "other";
  dxyBias: "up" | "down" | "flat" | null;
  newsNearby: boolean;
  newsNote: string | null;
  moodBeforeId: string | null;
  moodAfterId: string | null;
  reasoning: string | null;
  notesAfter: string | null;
  entryAt: string;
  exitAt: string | null;
  ruleChecks: TradeRuleCheck[];
  setupTagIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TradeImage {
  id: string;
  filePath: string;
  caption: string | null;
  createdAt: string;
}

export interface BadgeUnlock {
  id: string;
  badgeKey: string;
  tradeId: string | null;
  unlockedAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  sortOrder: number;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountSettings {
  id: string;
  startingBalance: number;
  monthlyProfitTargetPct: number | null;
  maxDrawdownLimitPct: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountTransaction {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  occurredAt: string;
  note: string | null;
  createdAt: string;
}

export interface ChecklistCompletion {
  id: string;
  itemId: string;
  completionDate: string;
  completedAt: string;
}

export interface Reflection {
  id: string;
  period: "weekly" | "monthly";
  periodStart: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export const ACCOUNT_SETTINGS_SINGLETON_ID = "singleton";

export const rulesCollection = () => collection<Rule>("rules");
export const setupTagsCollection = () => collection<SetupTag>("setupTags");
export const moodTagsCollection = () => collection<MoodTag>("moodTags");
export const tradesCollection = () => collection<Trade>("trades");
export const badgeUnlocksCollection = () => collection<BadgeUnlock>("badgeUnlocks");
export const checklistItemsCollection = () => collection<ChecklistItem>("checklistItems");
export const accountSettingsCollection = () => collection<AccountSettings>("accountSettings");
export const accountTransactionsCollection = () =>
  collection<AccountTransaction>("accountTransactions");
export const checklistCompletionsCollection = () =>
  collection<ChecklistCompletion>("checklistCompletions");
export const reflectionsCollection = () => collection<Reflection>("reflections");

export const tradeImagesCollection = (tradeId: string): CollectionReference<TradeImage> =>
  tradesCollection().doc(tradeId).collection("images").withConverter(converter<TradeImage>());
