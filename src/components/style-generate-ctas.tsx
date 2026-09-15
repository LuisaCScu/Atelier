"use client";

import { FirstBoardAutoGenerate } from "@/components/first-board-auto";
import { OnceForm } from "@/components/once-form";
import { StyleMyClosetCta } from "@/components/style-my-closet-cta";
import { ctaPrimary } from "@/components/marks";
import { cn } from "cn";

/** Pinned Style-tab CTA — Create new looks (regenerate) + quiet closet. */
export function StyleGenerateCtas({
  className,
  autoFirstStoreFirst = false,
}: {
  className?: string;
  /** One auto storeFirst only for the first board ever — never regenerate. */
  autoFirstStoreFirst?: boolean;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <FirstBoardAutoGenerate enabled={autoFirstStoreFirst} />
      <OnceForm action="/regenerate" generateMode="storeFirst">
        <button type="submit" className={ctaPrimary}>
          Create new looks
        </button>
      </OnceForm>
      <StyleMyClosetCta variant="quiet" className="mt-0" />
    </div>
  );
}
