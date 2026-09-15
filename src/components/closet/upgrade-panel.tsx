"use client";

import { ScreenHeader } from "@/components/app-shell";
import { ctaPrimary, ctaSecondary } from "@/components/marks";
import { CLOSET_FREE_CAP } from "@/lib/types";
import { useState } from "react";

export function UpgradePanel() {
  const [blocked, setBlocked] = useState(false);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-6">
      <ScreenHeader backHref="/closet" title="Closet" />
      <h1 className="font-serif text-[30px] leading-tight">Ten pieces on the house.</h1>
      <p className="mt-3 text-[14px] leading-6 text-black/50">
        Free closet holds {CLOSET_FREE_CAP} pieces on this device. A larger closet is coming — this is a preview, not
        a checkout.
      </p>

      <div className="mt-8 space-y-2.5">
        <article className="rounded-2xl bg-white px-4 py-4">
          <p className="text-[12px] tracking-[0.14em] text-black/40 uppercase">Free</p>
          <p className="mt-1 text-[17px] font-medium">{CLOSET_FREE_CAP} pieces</p>
          <p className="mt-1 text-[13px] text-black/45">Photo or note add. Mixes into Generate when you have at least one.</p>
        </article>
        <article className="rounded-2xl border border-black/10 bg-white px-4 py-4">
          <p className="text-[12px] tracking-[0.14em] text-black/40 uppercase">Atelier+</p>
          <p className="mt-1 text-[17px] font-medium">Unlimited closet</p>
          <p className="mt-1 text-[13px] text-black/45">Keep more of what you own in the mix. Not for sale yet.</p>
        </article>
      </div>

      {blocked ? (
        <div className="mt-8 rounded-2xl bg-[#efe8dc] px-4 py-5">
          <p className="text-[15px] font-semibold">Development in progress</p>
          <p className="mt-2 text-[13px] leading-5 text-black/55">
            Payments aren&apos;t live. Nothing was charged. Your {CLOSET_FREE_CAP} free pieces stay in this browser.
          </p>
        </div>
      ) : (
        <button type="button" className={`${ctaPrimary} mt-8`} onClick={() => setBlocked(true)}>
          Continue with Atelier+
        </button>
      )}

      <a href="/closet" className={`${ctaSecondary} mt-2.5`}>
        Back to closet
      </a>
    </div>
  );
}
