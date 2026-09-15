"use client";

import { AppShell, BrandWord } from "@/components/app-shell";
import { LookbookLive } from "@/components/lookbook-live";
import { StyleGenerateCtas } from "@/components/style-generate-ctas";
import { ctaPrimary } from "@/components/marks";
import type { GenerateAccess } from "@/lib/freemium";
import { findCachedLooks, readRecentLookIds } from "@/lib/stylist-client";
import { useEffect, useState } from "react";

export function LookbookCacheGate({
  quotaExhausted = false,
  generateUserKey,
  generateAccess,
  showStyleCtas = false,
  showProfileCta = true,
}: {
  quotaExhausted?: boolean;
  generateUserKey?: string | null;
  generateAccess?: GenerateAccess;
  showStyleCtas?: boolean;
  showProfileCta?: boolean;
}) {
  const [cached, setCached] = useState<ReturnType<typeof findCachedLooks> | undefined>(undefined);

  useEffect(() => {
    setCached(findCachedLooks());
  }, []);

  if (cached === undefined) return null;

  if (cached?.looks.length) {
    return (
      <LookbookLive
        name="there"
        budgetMax={280}
        sizeLine=""
        requestIds={readRecentLookIds()}
        initial={cached}
        cachedHint
        generateUserKey={generateUserKey}
        quotaExhausted={quotaExhausted}
        freeBoard={Boolean(cached.looks[3]?.fittingLocked)}
        generateAccess={generateAccess}
        showStyleCtas={showStyleCtas}
        generateAction="/regenerate"
      />
    );
  }

  return (
    <AppShell tab="style">
      <header className="flex items-center justify-between">
        <span className="size-8" />
        <BrandWord className="text-[20px]" />
        <span className="size-8" />
      </header>
      <h1 className="mt-10 font-serif text-[32px] leading-tight">Style</h1>
      <p className="mt-2 text-[14px] leading-6 text-black/50">
        Tell me what you’re dressing for. I’ll make four looks — one from your closet, two mixed, one from the store.
      </p>
      {showStyleCtas ? (
        <StyleGenerateCtas
          className="mt-8"
          action="/generate"
          quotaExhausted={quotaExhausted}
          generateAccess={generateAccess}
          generateUserKey={generateUserKey}
        />
      ) : null}
      {showProfileCta ? (
        <a href="/personalize" className={`${ctaPrimary} ${showStyleCtas ? "mt-4" : "mt-8"}`}>
          Create profile
        </a>
      ) : null}
    </AppShell>
  );
}
