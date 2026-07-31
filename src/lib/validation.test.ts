import { describe, it, expect } from "vitest";
import {
  ruleCheckSchema,
  tradeSchema,
  tradeImportRowSchema,
  ruleSchema,
  setupTagSchema,
  moodTagSchema,
  checklistItemSchema,
} from "@/lib/validation";

const validTradeInput = {
  direction: "long",
  entryPrice: 1950.5,
  stopLoss: 1945,
  positionSize: 1,
  session: "london",
  entryAt: "2026-07-30T08:00:00.000Z",
};

describe("tradeSchema", () => {
  it("parses a minimal valid trade and applies defaults", () => {
    const result = tradeSchema.parse(validTradeInput);
    expect(result.instrument).toBe("XAUUSD");
    expect(result.status).toBe("closed");
    expect(result.newsNearby).toBe(false);
    expect(result.ruleChecks).toEqual([]);
  });

  it("coerces numeric-string fields to numbers", () => {
    const result = tradeSchema.parse({
      ...validTradeInput,
      entryPrice: "1950.5",
      stopLoss: "1945",
      positionSize: "1",
    });
    expect(result.entryPrice).toBe(1950.5);
    expect(result.stopLoss).toBe(1945);
    expect(result.positionSize).toBe(1);
  });

  it("fails when a required field is missing", () => {
    const withoutDirection: Partial<typeof validTradeInput> = { ...validTradeInput };
    delete withoutDirection.direction;
    expect(tradeSchema.safeParse(withoutDirection).success).toBe(false);
  });

  it("fails when entryPrice is not positive", () => {
    expect(tradeSchema.safeParse({ ...validTradeInput, entryPrice: 0 }).success).toBe(false);
    expect(tradeSchema.safeParse({ ...validTradeInput, entryPrice: -5 }).success).toBe(false);
  });

  it("fails on an invalid enum value", () => {
    expect(
      tradeSchema.safeParse({ ...validTradeInput, direction: "sideways" }).success,
    ).toBe(false);
    expect(tradeSchema.safeParse({ ...validTradeInput, session: "tokyo" }).success).toBe(false);
  });

  it("accepts null/undefined for nullable-optional fields", () => {
    const result = tradeSchema.parse({
      ...validTradeInput,
      exitPrice: null,
      takeProfit: undefined,
      outcome: null,
      dxyBias: undefined,
    });
    expect(result.exitPrice).toBeNull();
    expect(result.outcome).toBeNull();
  });

  it("parses ruleChecks entries via ruleCheckSchema", () => {
    const result = tradeSchema.parse({
      ...validTradeInput,
      ruleChecks: [{ ruleId: "rule-1", status: "followed" }],
    });
    expect(result.ruleChecks).toEqual([{ ruleId: "rule-1", status: "followed" }]);
  });
});

describe("ruleCheckSchema", () => {
  it("rejects an empty ruleId", () => {
    expect(ruleCheckSchema.safeParse({ ruleId: "", status: "followed" }).success).toBe(false);
  });

  it("rejects an invalid status", () => {
    expect(
      ruleCheckSchema.safeParse({ ruleId: "rule-1", status: "maybe" }).success,
    ).toBe(false);
  });
});

describe("ruleSchema / setupTagSchema / checklistItemSchema", () => {
  it("require non-empty text/name", () => {
    expect(ruleSchema.safeParse({ text: "" }).success).toBe(false);
    expect(setupTagSchema.safeParse({ name: "" }).success).toBe(false);
    expect(checklistItemSchema.safeParse({ text: "" }).success).toBe(false);
  });

  it("accept non-empty text/name", () => {
    expect(ruleSchema.parse({ text: "Wait for confirmation" }).text).toBe(
      "Wait for confirmation",
    );
  });
});

const validImportRow = {
  entryAt: "2026-07-30T08:00:00.000Z",
  direction: "long",
  entryPrice: "1950.5",
  stopLoss: "1945",
  positionSize: "1",
  session: "london",
};

describe("tradeImportRowSchema", () => {
  it("parses a minimal valid row, coercing numeric strings and applying defaults", () => {
    const result = tradeImportRowSchema.parse(validImportRow);
    expect(result.entryPrice).toBe(1950.5);
    expect(result.stopLoss).toBe(1945);
    expect(result.positionSize).toBe(1);
    expect(result.instrument).toBe("XAUUSD");
    expect(result.status).toBe("closed");
    expect(result.newsNearby).toBe(false);
  });

  it("accepts setupTag/moodBefore/moodAfter as raw name strings", () => {
    const result = tradeImportRowSchema.parse({
      ...validImportRow,
      setupTag: "London breakout, NY reversal",
      moodBefore: "Calm",
      moodAfter: "Relieved",
    });
    expect(result.setupTag).toBe("London breakout, NY reversal");
    expect(result.moodBefore).toBe("Calm");
    expect(result.moodAfter).toBe("Relieved");
  });

  it("fails when a required field is missing", () => {
    const withoutDirection: Partial<typeof validImportRow> = { ...validImportRow };
    delete withoutDirection.direction;
    expect(tradeImportRowSchema.safeParse(withoutDirection).success).toBe(false);
  });

  it("fails on an invalid enum value", () => {
    expect(
      tradeImportRowSchema.safeParse({ ...validImportRow, session: "tokyo" }).success,
    ).toBe(false);
  });

  it("accepts undefined optional numeric/nullable fields (empty CSV cells)", () => {
    const result = tradeImportRowSchema.parse({
      ...validImportRow,
      exitPrice: undefined,
      takeProfit: undefined,
      outcome: undefined,
      setupTag: undefined,
    });
    expect(result.exitPrice).toBeUndefined();
    expect(result.setupTag).toBeUndefined();
  });

  it("coerces the newsNearby string 'true'/'false' to boolean", () => {
    expect(tradeImportRowSchema.parse({ ...validImportRow, newsNearby: "true" }).newsNearby).toBe(
      true,
    );
    expect(tradeImportRowSchema.parse({ ...validImportRow, newsNearby: "false" }).newsNearby).toBe(
      false,
    );
  });
});

describe("moodTagSchema", () => {
  it("defaults category to 'both'", () => {
    expect(moodTagSchema.parse({ name: "Calm" }).category).toBe("both");
  });

  it("rejects an invalid category", () => {
    expect(moodTagSchema.safeParse({ name: "Calm", category: "during" }).success).toBe(false);
  });
});
