"use client";

import { readImageAsDataUrl } from "@/lib/image";
import { loadFacePhoto, saveFacePhoto } from "@/lib/media";
import { useEffect, useRef, useState } from "react";

/** Daylight face only — guesses season aspects and/or appearance chips. */
export function FacePhotoField({
  value,
  onChange,
  hint,
}: {
  value?: string;
  onChange?: (next: string) => void;
  hint?: string;
}) {
  const [photo, setPhoto] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setPhoto(value);
      return;
    }
    setPhoto(loadFacePhoto());
  }, [value]);

  async function onFile(file?: File) {
    if (!file) return;
    const dataUrl = await readImageAsDataUrl(file, 1000);
    saveFacePhoto(dataUrl);
    setPhoto(dataUrl);
    onChange?.(dataUrl);
  }

  function clear() {
    saveFacePhoto("");
    setPhoto("");
    onChange?.("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="mt-6">
      <p className="text-[11px] tracking-[0.16em] text-black/40 uppercase">Face photo (optional)</p>
      <p className="mt-1 text-[13px] text-black/45">
        {hint ??
          "Daylight on the face, little or no makeup. We guess appearance chips — you can still change them."}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      {photo ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Your face in daylight" className="aspect-[4/3] w-full object-cover" />
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-[13px] text-black/50">Saved on this device.</p>
            <div className="flex gap-3">
              <button
                type="button"
                className="text-[13px] underline underline-offset-2"
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </button>
              <button type="button" className="text-[13px] text-black/45 underline underline-offset-2" onClick={clear}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-dashed border-black/20 bg-white text-[14px] font-medium"
        >
          Add daylight face photo
        </button>
      )}
    </div>
  );
}
