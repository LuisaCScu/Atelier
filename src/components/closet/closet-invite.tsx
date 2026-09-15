"use client";

import { HangerIcon } from "@/components/icons";
import { hydrateCloset } from "@/lib/closet-store";
import { CLOSET_INVITE_KEY } from "@/lib/types";
import { useEffect, useState } from "react";

export function ClosetInvite() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(CLOSET_INVITE_KEY);
    const closet = hydrateCloset();
    if (!dismissed && closet.length === 0) setShow(true);
  }, []);

  function skip() {
    window.localStorage.setItem(CLOSET_INVITE_KEY, "dismissed");
    setShow(false);
  }

  if (!show) return null;

  return (
    <article className="mt-7 flex gap-3 rounded-2xl bg-white px-4 py-4">
      <HangerIcon className="mt-0.5 size-6 shrink-0 text-black/45" />
      <div>
        <h2 className="text-[15px] font-semibold">Style what you already own</h2>
        <p className="mt-1.5 text-[13px] leading-5 text-black/50">
          Add a few pieces you already wear. Looks can mix your closet with the store.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <a href="/closet" className="rounded-xl border border-black px-3.5 py-1.5 text-[13px] font-medium">
            Add to closet
          </a>
          <button type="button" className="text-[13px] text-black/40" onClick={skip}>
            Not now
          </button>
        </div>
      </div>
    </article>
  );
}
