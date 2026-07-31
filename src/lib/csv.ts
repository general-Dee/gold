export function toCsvField(value: string | number | boolean | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rowsToCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  return [headers, ...rows].map((row) => row.map(toCsvField).join(",")).join("\r\n");
}

/** Inverse of toCsvField/rowsToCsv's quoting rules: quote-wrapped fields may
 * contain commas/newlines, and "" inside quotes is an escaped literal quote. */
export function parseCsvRows(text: string): string[][] {
  const body = text.startsWith("﻿") ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < body.length) {
    const ch = body[i];

    if (inQuotes) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"' && field === "") {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      endField();
      i += 1;
      continue;
    }
    if (ch === "\r" && body[i + 1] === "\n") {
      endRow();
      i += 2;
      continue;
    }
    if (ch === "\n") {
      endRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (field !== "" || row.length > 0) endRow();

  return rows;
}

export function rowsFromCsv(text: string): { headers: string[]; rows: string[][] } {
  const [headers = [], ...rows] = parseCsvRows(text);
  return { headers, rows };
}
