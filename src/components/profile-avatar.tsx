"use client";

import { profileInitials } from "@/lib/format";
import { loadFacePhoto } from "@/lib/media";
import { cn } from "cn";
import { useEffect, useState } from "react";

export function ProfileAvatar({ name, className }: { name: string; className?: string }) {
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    setPhoto(loadFacePhoto() || null);
  }, []);

  const letters = profileInitials(name);

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        className={cn("size-16 rounded-full object-cover object-top", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex size-16 items-center justify-center rounded-full bg-black font-serif text-[20px] tracking-wide text-white",
        className
      )}
      aria-hidden
    >
      {letters}
    </div>
  );
}
