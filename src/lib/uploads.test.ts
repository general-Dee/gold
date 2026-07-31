import { describe, it, expect } from "vitest";
import { validateUploadFile, MAX_UPLOAD_BYTES } from "@/lib/uploads";

describe("validateUploadFile", () => {
  it.each([".png", ".jpg", ".jpeg", ".gif", ".webp"])("accepts %s", (ext) => {
    expect(validateUploadFile({ name: `chart${ext}`, size: 1024 })).toBeNull();
  });

  it("is case-insensitive on extension", () => {
    expect(validateUploadFile({ name: "chart.PNG", size: 1024 })).toBeNull();
  });

  it.each([".pdf", ".exe", ".svg", ""])("rejects %s", (ext) => {
    expect(validateUploadFile({ name: `chart${ext}`, size: 1024 })).toMatch(/unsupported/i);
  });

  it("rejects a zero-byte file", () => {
    expect(validateUploadFile({ name: "chart.png", size: 0 })).toMatch(/choose a file/i);
  });

  it("accepts a file exactly at the size limit", () => {
    expect(validateUploadFile({ name: "chart.png", size: MAX_UPLOAD_BYTES })).toBeNull();
  });

  it("rejects a file one byte over the size limit", () => {
    expect(validateUploadFile({ name: "chart.png", size: MAX_UPLOAD_BYTES + 1 })).toMatch(
      /5MB or smaller/i,
    );
  });
});
