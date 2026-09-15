"use client";

import { closetPacketOptionsForMode, closetToStylistPacket } from "@/lib/closet-packet";
import { ensureClosetImagesHydrated, hydrateCloset, loadCloset } from "@/lib/closet-store";
import { loadLookVotes } from "@/lib/look-votes";
import { FIRST_BOARD_AUTO_KEY } from "@/lib/types";

export function firstBoardAutoAlreadyArmed(): boolean {
  try {
    if (window.sessionStorage.getItem(FIRST_BOARD_AUTO_KEY) === "1") return true;
    if (window.localStorage.getItem(FIRST_BOARD_AUTO_KEY) === "fired") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function markFirstBoardAutoArmed() {
  try {
    window.sessionStorage.setItem(FIRST_BOARD_AUTO_KEY, "1");
    window.localStorage.setItem(FIRST_BOARD_AUTO_KEY, "fired");
  } catch {
    /* ignore */
  }
}

export type FirstBoardEnqueueResult =
  | { ok: true; requestId: string; status?: string }
  | { ok: false; error: string; quotaExhausted?: boolean; premiumRequired?: boolean };

/**
 * Programmatic first-board storeFirst — parked while Style chat is the generate UX.
 * Kept so a future first-board preheat can reuse the same path without burning 1/day blindly.
 */
export async function enqueueFirstBoardStoreFirst(): Promise<FirstBoardEnqueueResult> {
  if (firstBoardAutoAlreadyArmed()) {
    return { ok: false, error: "Already armed." };
  }
  if (loadLookVotes().length > 0) {
    return { ok: false, error: "Looks already voted." };
  }
  markFirstBoardAutoArmed();
  try {
    hydrateCloset();
    await ensureClosetImagesHydrated();
    const loaded = loadCloset();
    const packetOpts = closetPacketOptionsForMode("storeFirst", {
      closetLength: loaded.length,
    });
    const closet = closetToStylistPacket(loaded, packetOpts);
    let timezone = "";
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      timezone = "";
    }
    const res = await fetch("/api/stylist/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        generateMode: "storeFirst",
        ...(closet.length ? { closet } : {}),
        ...(timezone ? { timezone } : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      request?: { requestId?: string };
      status?: string;
    };
    if (res.status === 429) {
      return { ok: false, error: data.error || "Generate budget exhausted", quotaExhausted: true };
    }
    if (res.status === 403 || data.code === "premium_required") {
      return { ok: false, error: data.error || "Premium required", premiumRequired: true };
    }
    if (!res.ok) {
      return { ok: false, error: data.error || "Couldn’t start styling." };
    }
    const requestId = data.request?.requestId?.trim();
    if (!requestId) return { ok: false, error: "No styling request id." };
    return { ok: true, requestId, status: data.status };
  } catch {
    return { ok: false, error: "Couldn’t start styling. Try again." };
  }
}

/** Fire-and-forget first storeFirst (hide cold latency behind post-profile demo). */
export function preheatFirstBoardStoreFirst(onRequestId?: (requestId: string) => void): void {
  if (firstBoardAutoAlreadyArmed()) return;
  if (loadLookVotes().length > 0) return;
  void enqueueFirstBoardStoreFirst().then((result) => {
    if (result.ok) onRequestId?.(result.requestId);
  });
}
