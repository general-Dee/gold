export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB — headroom for a full 4K screenshot

export const ALLOWED_IMAGE_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

/** Returns a user-facing error message, or null if the file passes. */
export function validateUploadFile(file: { name: string; size: number }): string | null {
  if (file.size === 0) return "Please choose a file to upload.";
  if (file.size > MAX_UPLOAD_BYTES) return "Images must be 5MB or smaller.";
  if (!(extensionOf(file.name) in ALLOWED_IMAGE_MIME_TYPES)) {
    return "Unsupported file type — use PNG, JPG, GIF, or WEBP.";
  }
  return null;
}
