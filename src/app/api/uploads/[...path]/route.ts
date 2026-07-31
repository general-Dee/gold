import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ALLOWED_IMAGE_MIME_TYPES } from "@/lib/uploads";
import { UPLOADS_DIR } from "@/server/uploadsDir";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  // Reject anything that isn't a single flat filename — uploads are always
  // written as bare nanoid-based names with no subdirectories.
  if (segments.length !== 1 || segments[0].includes("..") || segments[0].includes("/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(UPLOADS_DIR, segments[0]);
  if (!filePath.startsWith(UPLOADS_DIR)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": ALLOWED_IMAGE_MIME_TYPES[ext] ?? "application/octet-stream" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
