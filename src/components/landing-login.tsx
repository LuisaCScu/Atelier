"use client";

import { SESSION_COOKIE } from "@/lib/types";
import { useState } from "react";

const pillOutline =
  "flex h-12 w-full items-center justify-center rounded-full border border-black text-[13px] font-medium tracking-[0.14em] text-black";

export function LandingLogin({
  lookbookHref = "/lookbook",
  createHref = "/personalize",
}: {
  lookbookHref?: string;
  createHref?: string;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const stored = window.localStorage.getItem(SESSION_COOKIE);
      if (stored) {
        const res = await fetch("/api/session/restore", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: stored,
        });
        if (res.ok) {
          window.location.href = lookbookHref;
          return;
        }
      }
    } catch {
      /* cookie atelier.v2 only — no fake auth */
    }
    setBusy(false);
    setNote("No saved profile on this device.");
  }

  return (
    <div className="w-full">
      <a href={lookbookHref} onClick={onClick} className={pillOutline} aria-busy={busy}>
        Log in
      </a>
      {note ? (
        <p className="mt-3 text-center text-[12px] leading-5 text-black/50">
          {note}{" "}
          <a href={createHref} className="text-black underline underline-offset-4">
            Create a profile
          </a>
        </p>
      ) : null}
    </div>
  );
}
