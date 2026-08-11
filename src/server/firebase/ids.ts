export { nanoid } from "nanoid";

/** Deterministic doc ID replacing the (itemId, completionDate) unique index. */
export const completionId = (itemId: string, completionDate: string) =>
  `${itemId}_${completionDate}`;

/** Deterministic doc ID replacing the (period, periodStart) unique index. */
export const reflectionId = (period: string, periodStart: string) => `${period}_${periodStart}`;
