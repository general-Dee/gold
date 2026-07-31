"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALLOWED_IMAGE_MIME_TYPES } from "@/lib/uploads";
import {
  deleteTradeImageAction,
  updateTradeImageCaptionAction,
  uploadTradeImageAction,
} from "@/server/actions/images";

type TradeImage = { id: string; filePath: string; caption: string | null };

const ACCEPT = Object.keys(ALLOWED_IMAGE_MIME_TYPES).join(",");

function ImageThumbnail({ tradeId, image }: { tradeId: string; image: TradeImage }) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(image.caption ?? "");

  function handleDelete() {
    if (!window.confirm("Delete this image? This can't be undone.")) return;
    startTransition(async () => {
      try {
        await deleteTradeImageAction(image.id, tradeId);
      } catch {
        toast.error("Could not delete image. Try again.");
      }
    });
  }

  function save() {
    setIsEditing(false);
    startTransition(async () => {
      try {
        await updateTradeImageCaptionAction(image.id, tradeId, draft);
      } catch {
        toast.error("Could not save caption. Try again.");
      }
    });
  }

  function cancel() {
    setDraft(image.caption ?? "");
    setIsEditing(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="group relative">
        <a href={`/api/uploads/${image.filePath}`} target="_blank" rel="noreferrer">
          <Image
            src={`/api/uploads/${image.filePath}`}
            alt={image.caption ?? "Trade chart"}
            width={300}
            height={200}
            className="h-32 w-full rounded-md border object-cover"
            unoptimized
          />
        </a>
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          onClick={handleDelete}
          disabled={isPending}
          aria-label="Delete image"
          className="absolute top-1.5 right-1.5"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {isEditing ? (
        <div className="flex items-center gap-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            autoFocus
            className="h-7 flex-1 text-xs"
          />
          <Button type="button" variant="ghost" size="icon-sm" onClick={save} aria-label="Save">
            <Check className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={cancel} aria-label="Cancel">
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1 text-left text-xs text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3 shrink-0" />
          <span className={image.caption ? "" : "italic"}>{image.caption ?? "Add caption"}</span>
        </button>
      )}
    </div>
  );
}

export function TradeImagesCard({
  tradeId,
  images,
}: {
  tradeId: string;
  images: TradeImage[];
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await uploadTradeImageAction(tradeId, formData);
        toast.success("Image uploaded.");
        formRef.current?.reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not upload image.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <ImageThumbnail key={img.id} tradeId={tradeId} image={img} />
          ))}
        </div>
      )}

      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input type="file" name="file" accept={ACCEPT} required disabled={isPending} />
        </div>
        <div className="flex-1">
          <Input
            type="text"
            name="caption"
            placeholder="e.g. 15m entry confirmation"
            disabled={isPending}
          />
        </div>
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Uploading…" : "Upload"}
        </Button>
      </form>
    </div>
  );
}
