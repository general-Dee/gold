import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { localDateKey } from "@/lib/dates";

export async function GET() {
  const url = process.env.DATABASE_URL ?? "file:./data/trading-journal.db";
  if (!url.startsWith("file:")) {
    return new NextResponse("No local database file to back up", { status: 404 });
  }

  const filePath = path.join(process.cwd(), url.slice("file:".length));

  try {
    const data = await readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="trading-journal-backup-${localDateKey()}.db"`,
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
