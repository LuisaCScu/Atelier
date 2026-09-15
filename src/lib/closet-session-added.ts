/**
 * Closet inventory "m added" counter.
 *
 * Rule: `atelier.closet.addedSession` in sessionStorage is incremented by 1
 * on each successful Photo / Note save (addClosetItems ok). Resets when the
 * browser tab session ends. ClosetScreen reads it for `{n} pieces · {m} added`.
 * Not derived from createdAt (ClosetItem has no createdAt field).
 */
export const CLOSET_SESSION_ADDED_KEY = "atelier.closet.addedSession";

export function readSessionAddedCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(sessionStorage.getItem(CLOSET_SESSION_ADDED_KEY) || "0");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function bumpSessionAddedCount(by = 1): number {
  if (typeof window === "undefined") return 0;
  const next = readSessionAddedCount() + Math.max(1, Math.floor(by));
  try {
    sessionStorage.setItem(CLOSET_SESSION_ADDED_KEY, String(next));
  } catch {
    /* private mode / quota — ignore */
  }
  return next;
}
