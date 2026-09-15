"use client";

import { OnceForm } from "@/components/once-form";
import {
  firstBoardAutoAlreadyArmed,
  markFirstBoardAutoArmed,
} from "@/lib/first-board-generate";
import { loadLookVotes } from "@/lib/look-votes";
import { useEffect, useRef } from "react";

/**
 * Auto storeFirst once — only the first board ever.
 * Server must already gate: !hasUsedFreeBoard, no stylistRequestId, profile ready.
 * Client re-checks look votes and a one-shot flag so Style landing never re-fires.
 * Prefer post-profile preheat (`preheatFirstBoardStoreFirst`); this is the Style fallback.
 */
export function FirstBoardAutoGenerate({ enabled }: { enabled: boolean }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    if (firstBoardAutoAlreadyArmed()) return;
    if (loadLookVotes().length > 0) return;
    const form = wrapRef.current?.querySelector("form");
    if (!(form instanceof HTMLFormElement)) return;
    started.current = true;
    markFirstBoardAutoArmed();
    const t = window.setTimeout(() => {
      try {
        form.requestSubmit();
      } catch {
        form.submit();
      }
    }, 40);
    return () => window.clearTimeout(t);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div ref={wrapRef} className="sr-only" aria-hidden>
      <OnceForm action="/generate" generateMode="storeFirst">
        <button type="submit" tabIndex={-1}>
          Style a new outfit
        </button>
      </OnceForm>
    </div>
  );
}
