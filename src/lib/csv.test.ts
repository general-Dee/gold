import { describe, it, expect } from "vitest";
import { toCsvField, rowsToCsv, parseCsvRows, rowsFromCsv } from "@/lib/csv";

describe("toCsvField", () => {
  it("renders null and undefined as an empty string", () => {
    expect(toCsvField(null)).toBe("");
    expect(toCsvField(undefined)).toBe("");
  });

  it("passes plain values through unquoted", () => {
    expect(toCsvField("long")).toBe("long");
    expect(toCsvField(42)).toBe("42");
    expect(toCsvField(true)).toBe("true");
  });

  it("quotes a field containing a comma", () => {
    expect(toCsvField("London, NY overlap")).toBe('"London, NY overlap"');
  });

  it("quotes and doubles internal quotes", () => {
    expect(toCsvField('said "go long"')).toBe('"said ""go long"""');
  });

  it("quotes a field containing a newline", () => {
    expect(toCsvField("line one\nline two")).toBe('"line one\nline two"');
  });
});

describe("rowsToCsv", () => {
  it("joins headers and rows with CRLF, escaping as needed", () => {
    const csv = rowsToCsv(
      ["direction", "note"],
      [
        ["long", "clean entry"],
        ["short", "hesitated, entered late"],
      ],
    );
    expect(csv).toBe(
      ["direction,note", "long,clean entry", 'short,"hesitated, entered late"'].join("\r\n"),
    );
  });

  it("renders an empty rows array as just the header line", () => {
    expect(rowsToCsv(["a", "b"], [])).toBe("a,b");
  });
});

describe("parseCsvRows", () => {
  it("round-trips plain fields", () => {
    const csv = rowsToCsv(
      ["direction", "note"],
      [
        ["long", "clean entry"],
        ["short", "hesitated late"],
      ],
    );
    expect(parseCsvRows(csv)).toEqual([
      ["direction", "note"],
      ["long", "clean entry"],
      ["short", "hesitated late"],
    ]);
  });

  it("round-trips fields with embedded commas", () => {
    const csv = rowsToCsv(["setupTag"], [["London breakout, NY reversal"]]);
    expect(parseCsvRows(csv)).toEqual([["setupTag"], ["London breakout, NY reversal"]]);
  });

  it("round-trips fields with embedded quotes", () => {
    const csv = rowsToCsv(["note"], [['said "go long"']]);
    expect(parseCsvRows(csv)).toEqual([["note"], ['said "go long"']]);
  });

  it("round-trips fields with embedded newlines", () => {
    const csv = rowsToCsv(["note"], [["line one\nline two"]]);
    expect(parseCsvRows(csv)).toEqual([["note"], ["line one\nline two"]]);
  });

  it("strips a leading UTF-8 BOM", () => {
    const csv = "﻿a,b\r\n1,2";
    expect(parseCsvRows(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("ignores a trailing blank line", () => {
    expect(parseCsvRows("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("rowsFromCsv", () => {
  it("splits headers from data rows", () => {
    expect(rowsFromCsv("a,b\r\n1,2\r\n3,4")).toEqual({
      headers: ["a", "b"],
      rows: [
        ["1", "2"],
        ["3", "4"],
      ],
    });
  });
});
