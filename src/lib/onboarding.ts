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
 * First-board auto storeFirst is parked: Style chat collects occasion first
 * so we do not burn the free 1/day generate without a brief.
 */
export function shouldAutoFirstStoreFirst(
  _session?: ProfileSession | null,
  _opts?: { lookVoteCount?: number }
): boolean {
  return false;
}
