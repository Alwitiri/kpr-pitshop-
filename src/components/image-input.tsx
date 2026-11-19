"use client";

import { useState } from "react";

/**
 * File input for pictures that shrinks big photos in the browser before upload
 * (phone photos are often 3–8 MB). The shrunk file replaces the chosen one, so the
 * normal form submit sends the small version.
 *   mode "logo"  -> PNG, max 600 px (keeps transparency)
 *   mode "photo" -> JPEG, max 1400 px
 */
export function ImageInput({
  name,
  mode = "photo",
  required,
  className = "input py-1.5",
  accept = "image/png,image/jpeg,image/webp",
}: {
  name: string;
  mode?: "logo" | "photo";
  required?: boolean;
  className?: string;
  accept?: string;
}) {
  const [note, setNote] = useState("");

  return (
    <>
      <input
        type="file"
        name={name}
        accept={accept}
        required={required}
        className={className}
        onChange={async (e) => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          setNote("");
          if (!file || !file.type.startsWith("image/")) return;
          try {
            const small = await shrink(file, mode);
            if (small && small.size < file.size) {
              const dt = new DataTransfer();
              dt.items.add(small);
              input.files = dt.files;
              setNote(`Image resized for upload: ${kb(file.size)} → ${kb(small.size)}`);
            }
          } catch {
            /* keep the original file */
          }
        }}
      />
      {note && <span className="mt-1 block text-xs text-emerald-700">{note}</span>}
    </>
  );
}

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

async function shrink(file: File, mode: "logo" | "photo"): Promise<File | null> {
  const max = mode === "logo" ? 600 : 1400;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  // Small enough already and in a fine format: leave it alone
  if (scale === 1 && file.size < 400 * 1024) return null;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  const type = mode === "logo" ? "image/png" : "image/jpeg";
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, type, 0.88));
  if (!blob) return null;
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.${mode === "logo" ? "png" : "jpg"}`, { type });
}
