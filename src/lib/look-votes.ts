import type { HomeLookVote } from "./home-lookbook";

function asStoredVote(vote: string): string {
  if (vote === "wear" || vote === "like") return "like";
  if (vote === "no" || vote === "dislike") return "dislike";
  return "skip";
}

export const LOOK_VOTES_KEY = "atelier.lookVotes.v1";
export const LOOK_VOTES_EVENT = "atelier:lookVotes";

export function loadLookVotes(): HomeLookVote[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOOK_VOTES_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredVote);
  } catch {
    return [];
  }
}

function isStoredVote(value: unknown): value is HomeLookVote {
  if (!value || typeof value !== "object") return false;
  const rec = value as HomeLookVote;
  return typeof rec.lookId === "string" && typeof rec.vote === "string";
}

export function upsertLookVote(input: { requestId?: string; lookId: string; vote: string }) {
  if (typeof window === "undefined") return loadLookVotes();
  const next: HomeLookVote = {
    lookId: input.lookId,
    vote: asStoredVote(input.vote),
    requestId: input.requestId,
  };
  const rest = loadLookVotes().filter((item) => item.lookId !== next.lookId || (item.requestId && next.requestId && item.requestId !== next.requestId));
  const stored = [next, ...rest].slice(0, 80);
  window.localStorage.setItem(LOOK_VOTES_KEY, JSON.stringify(stored));
  window.dispatchEvent(new Event(LOOK_VOTES_EVENT));
  return stored;
}

export function subscribeLookVotes(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener("storage", handler);
  window.addEventListener(LOOK_VOTES_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(LOOK_VOTES_EVENT, handler);
  };
}

/** Device votes win when the session cookie is stale or too large to keep lookFeedback. */
export function mergeHomeVotes(server: HomeLookVote[] = [], device: HomeLookVote[] = []): HomeLookVote[] {
  const map = new Map<string, HomeLookVote>();
  for (const vote of server) {
    map.set(vote.lookId, vote);
    if (vote.requestId) map.set(`${vote.requestId}:${vote.lookId}`, vote);
  }
  for (const vote of device) {
    map.set(vote.lookId, vote);
    if (vote.requestId) map.set(`${vote.requestId}:${vote.lookId}`, vote);
  }
  const seen = new Set<string>();
  const out: HomeLookVote[] = [];
  for (const vote of map.values()) {
    if (seen.has(vote.lookId)) continue;
    seen.add(vote.lookId);
    out.push(vote);
  }
  return out;
}
