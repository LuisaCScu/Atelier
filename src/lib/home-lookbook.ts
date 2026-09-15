import type { LikedLook } from "./liked-looks";
import { lookbookCardTitle, type StylistLookV1, type StylistResponseV1 } from "./stylist-contract";

export function isClearDislike(vote?: string | null): boolean {
  return vote === "dislike" || vote === "no";
}

export type HomeLookCard = {
  key: string;
  requestId: string;
  look: StylistLookV1;
};

export type HomeLookVote = {
  lookId: string;
  vote: string;
  requestId?: string;
};

function lookFromLiked(item: LikedLook): StylistLookV1 {
  return {
    id: item.lookId,
    title: lookbookCardTitle(item),
    hook: item.hook ?? "",
    why: item.why ?? item.formula ?? item.title,
    formula: item.formula,
    // Fittings parked — tiles-first; do not promote worn hero URLs.
    heroImage: "",
    fittingImage: "",
    fittingLocked: true,
    pieces: item.pieces,
    levelUp: item.levelUp,
  };
}

/** Liked + not-yet-voted board looks. Any voted look stays off the Home board strip (Wear/Maybe live in liked). */
export function selectHomeLookbook(input: {
  board?: StylistResponseV1 | null;
  feedback?: HomeLookVote[];
  liked?: LikedLook[];
}): HomeLookCard[] {
  const requestId = input.board?.requestId ?? "";
  const feedback = input.feedback ?? [];
  const liked = input.liked ?? [];
  const boardLooks = input.board?.looks ?? [];

  const disliked = new Set<string>();
  for (const vote of feedback) {
    if (!isClearDislike(vote.vote)) continue;
    disliked.add(vote.lookId);
    if (vote.requestId) disliked.add(`${vote.requestId}:${vote.lookId}`);
  }

  const cards: HomeLookCard[] = [];
  const seen = new Set<string>();

  const take = (rid: string, look: StylistLookV1) => {
    const key = `${rid}:${look.id}`;
    if (seen.has(key) || seen.has(look.id)) return;
    if (disliked.has(look.id) || disliked.has(key)) return;
    seen.add(key);
    seen.add(look.id);
    cards.push({ key, requestId: rid, look });
  };

  for (const item of liked) {
    take(item.requestId, lookFromLiked(item));
  }

  for (const look of boardLooks) {
    const vote = feedback.find((item) => item.lookId === look.id)?.vote;
    // Only truly unvoted board looks join Home; Wear/Maybe come from liked; No/dismissed stay off.
    if (vote) continue;
    take(requestId, look);
  }

  return cards;
}

/** Wear / like — saved archive; leave active board after soft grace. */
export function isWearVote(vote?: string | null): boolean {
  return vote === "like" || vote === "wear";
}

/** Maybe / skip — same Saved Lookbook path as Wear; also used for dismissed leftovers. */
export function isMaybeVote(vote?: string | null): boolean {
  return vote === "maybe" || vote === "skip";
}

/** Wear or Maybe — archive to Saved Lookbook. */
export function isSavedArchiveVote(vote?: string | null): boolean {
  return isWearVote(vote) || isMaybeVote(vote);
}

/** Wear / Maybe / No all leave the active ephemeral board. Only unvoted remain. */
export function lookLeavesActiveBoard(vote?: string | null): boolean {
  return isClearDislike(vote) || isWearVote(vote) || isMaybeVote(vote);
}

export function voteForLook(votes: HomeLookVote[], lookId: string, requestId?: string): string | undefined {
  if (requestId) {
    const scoped = votes.find((item) => item.lookId === lookId && item.requestId === requestId);
    if (scoped) return scoped.vote;
    // Unscoped device votes (legacy) only — never apply another board's requestId votes
    // or a regenerated board reuses look ids and looks "Create broken" (instant empty).
    const unscoped = votes.find((item) => item.lookId === lookId && !item.requestId);
    return unscoped?.vote;
  }
  return votes.find((item) => item.lookId === lookId)?.vote;
}

/** Active Lookbook board: only unvoted looks. lingerIds = soft Saved grace after Wear/Maybe. */
export function filterActiveBoardLooks<T extends { id: string }>(
  looks: T[],
  votes: HomeLookVote[],
  requestId?: string,
  options?: { lingerIds?: Iterable<string> }
): T[] {
  const linger = options?.lingerIds ? new Set(options.lingerIds) : null;
  return looks.filter((look) => {
    if (linger?.has(look.id)) return true;
    return !lookLeavesActiveBoard(voteForLook(votes, look.id, requestId));
  });
}

/** Unreviewed looks still on the active board (no linger). Used by Style new / Style closet gate. */
export function unvotedActiveBoardLooks<T extends { id: string }>(
  looks: T[],
  votes: HomeLookVote[],
  requestId?: string
): T[] {
  return filterActiveBoardLooks(looks, votes, requestId);
}
