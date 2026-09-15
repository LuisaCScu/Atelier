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
  autoFirstStoreFirst = false,
}: {
  quotaExhausted?: boolean;
  generateUserKey?: string | null;
  generateAccess?: GenerateAccess;
  showStyleCtas?: boolean;
  autoFirstStoreFirst?: boolean;
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
        autoFirstStoreFirst={false}
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
        Create new looks or style your closet. Generating wait and the active board live here.
      </p>
      {showStyleCtas ? (
        <StyleGenerateCtas className="mt-8" autoFirstStoreFirst={autoFirstStoreFirst} />
      ) : null}
      {autoFirstStoreFirst ? null : (
        <a href="/personalize" className={`${ctaPrimary} ${showStyleCtas ? "mt-4" : "mt-8"}`}>
          Create profile
        </a>
      )}
    </AppShell>
  );
}
