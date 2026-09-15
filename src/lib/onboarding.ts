import type { ProfileSession } from "./types";

/** Profile complete enough that `/` should redirect to the saved Lookbook archive. */
export function isReturningSignedIn(session?: ProfileSession | null): boolean {
  if (!session) return false;
  return Boolean(
    session.stylistRequestId ||
      session.generated ||
      session.hasUsedFreeBoard ||
      session.deepDone?.budget
  );
}

/**
 * First-board auto storeFirst is allowed only when this is truly the first generate ever:
 * no prior request, free board unused, and no look votes yet.
 * Prefer firing from post-profile ready (`preheatFirstBoardStoreFirst`) so Style is a fallback.
 */
export function shouldAutoFirstStoreFirst(
  session?: ProfileSession | null,
  opts?: { lookVoteCount?: number }
): boolean {
  if (!session) return false;
  if (session.hasUsedFreeBoard) return false;
  if (session.stylistRequestId) return false;
  if ((session.stylistRequestIds?.length ?? 0) > 0) return false;
  if ((session.lookFeedback?.length ?? 0) > 0) return false;
  if ((opts?.lookVoteCount ?? 0) > 0) return false;
  // Profile must be ready to generate (budget done, or styles liked for quick path).
  return Boolean(session.deepDone?.budget || (session.likedStyleIds?.length ?? 0) >= 2);
}
