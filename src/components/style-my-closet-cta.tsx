"use client";

import { OnceForm } from "@/components/once-form";
import { ctaPrimary } from "@/components/marks";
import { hydrateCloset, subscribeCloset } from "@/lib/closet-store";
import { useEffect, useState } from "react";

/**
 * Style my closet — closetFirst generate.
 * Primary on filled Closet; quieter on Home / You. Hidden when closet is empty.
 */
export function StyleMyClosetCta({
  variant = "quiet",
  className,
}: {
  variant?: "primary" | "quiet";
  className?: string;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    setCount(hydrateCloset().length);
    return subscribeCloset(() => setCount(hydrateCloset().length));
  }, []);

  if (count === null || count < 1) return null;

  if (variant === "primary") {
    return (
      <OnceForm action="/generate" generateMode="closetFirst" className={className ?? "mt-6"}>
        <button type="submit" className={ctaPrimary}>
          Style my closet
        </button>
      </OnceForm>
    );
  }

  return (
    <OnceForm action="/generate" generateMode="closetFirst" className={className ?? "mt-3"}>
      <button
        type="submit"
        className="block w-full text-center text-[13px] text-black/45 underline underline-offset-4"
      >
        Style my closet
      </button>
    </OnceForm>
  );
}
