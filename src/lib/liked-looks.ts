import type { StylistLookV1, StylistPieceV1 } from "./stylist-contract";
import { lookFittingUrl, lookbookSaveCap } from "./freemium";
import { upsertLookVote } from "./look-votes";
import { LIKED_LOOKS_KEY } from "./types";

export const LIKED_LOOKS_EVENT = "atelier:likedLooks";

function clientHasPremium(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const match = document.cookie.match(/(?:^|; )atelier\.v2=([^;]*)/);
    if (!match?.[1]) return false;
    const data = JSON.parse(decodeURIComponent(match[1])) as { hasPremium?: boolean };
    return data?.hasPremium === true;
  } catch {
    return false;
  }
}

export function likedLookSaveCap(hasPremium = clientHasPremium()): number {
  return lookbookSaveCap(hasPremium);
}

/** True when adding this id would stay under the free/premium Lookbook save cap. Updates to an existing save always allowed. */
export function canSaveLikedLook(items: LikedLook[], id: string, hasPremium = clientHasPremium()): boolean {
  if (items.some((item) => item.id === id)) return true;
  return items.length < likedLookSaveCap(hasPremium);
}

export type LikedLookVote = "wear" | "maybe" | "no" | "like" | "dislike" | "skip";

export type LikedLook = {
  id: string;
  requestId: string;
  lookId: string;
  title: string;
  formula?: string;
  hook?: string;
  why?: string;
  fittingUrl: string;
  pieces: StylistPieceV1[];
  /** Elevate / level-up pieces (bags etc.) — needed for Lookbook collage parity with Style. */
  levelUp?: StylistPieceV1[];
  vote: "wear" | "maybe";
  likedAt: string;
};

export function likedLookId(requestId: string, lookId: string): string {
  return `${requestId}:${lookId}`;
}

export function normalizeLikedVote(vote: LikedLookVote): "like" | "dislike" | "skip" {
  if (vote === "wear" || vote === "like") return "like";
  if (vote === "no" || vote === "dislike") return "dislike";
  return "skip";
}

export function voteKeepsHistory(vote: LikedLookVote): vote is "wear" | "maybe" | "like" {
  return vote === "wear" || vote === "maybe" || vote === "like";
}

function slimPiece(piece: Partial<StylistPieceV1> & { id?: string; name?: string }): StylistPieceV1 | null {
  if (!piece.id || !piece.name) return null;
  return {
    id: String(piece.id),
    role: (piece.role as StylistPieceV1["role"]) || "other",
    brand: typeof piece.brand === "string" ? piece.brand : "",
    name: String(piece.name),
    price: typeof piece.price === "number" && Number.isFinite(piece.price) ? piece.price : 0,
    currency: piece.currency === "USD" ? "USD" : "USD",
    image: typeof piece.image === "string" ? piece.image : "",
    shopUrl: typeof piece.shopUrl === "string" ? piece.shopUrl : "#demo-stub",
  };
}

export function likedLookFromVote(input: {
  requestId: string;
  look: Pick<StylistLookV1, "id" | "title" | "hook" | "formula" | "why" | "heroImage" | "fittingImage" | "pieces" | "levelUp">;
  vote: LikedLookVote;
  at?: string;
}): LikedLook | null {
  if (!voteKeepsHistory(input.vote)) return null;
  const pieces = (input.look.pieces ?? []).map(slimPiece).filter((piece): piece is StylistPieceV1 => Boolean(piece));
  const levelUp = (input.look.levelUp ?? [])
    .map(slimPiece)
    .filter((piece): piece is StylistPieceV1 => Boolean(piece));
  return {
    id: likedLookId(input.requestId, input.look.id),
    requestId: input.requestId,
    lookId: input.look.id,
    title: input.look.title,
    formula: input.look.formula,
    hook: input.look.hook,
    why: input.look.why,
    fittingUrl: lookFittingUrl(input.look),
    pieces,
    levelUp: levelUp.length ? levelUp : undefined,
    vote: input.vote === "like" ? "wear" : input.vote,
    likedAt: input.at ?? new Date().toISOString(),
  };
}

export function loadLikedLooks(): LikedLook[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LIKED_LOOKS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLikedLook);
  } catch {
    return [];
  }
}

function isLikedLook(value: unknown): value is LikedLook {
  if (!value || typeof value !== "object") return false;
  const rec = value as LikedLook;
  return typeof rec.id === "string" && typeof rec.lookId === "string" && typeof rec.title === "string" && Array.isArray(rec.pieces);
}

export function saveLikedLooks(items: LikedLook[]) {
  if (typeof window === "undefined") return;
  const cap = likedLookSaveCap();
  window.localStorage.setItem(LIKED_LOOKS_KEY, JSON.stringify(items.slice(0, cap)));
  window.dispatchEvent(new Event(LIKED_LOOKS_EVENT));
}

export function upsertLikedLook(look: LikedLook): LikedLook[] | { ok: false; reason: "cap" } {
  const current = loadLikedLooks();
  if (!canSaveLikedLook(current, look.id)) {
    return { ok: false, reason: "cap" };
  }
  const next = [look, ...current.filter((item) => item.id !== look.id)].slice(0, likedLookSaveCap());
  saveLikedLooks(next);
  return next;
}

export function removeLikedLook(requestId: string, lookId: string) {
  const id = likedLookId(requestId, lookId);
  const next = loadLikedLooks().filter((item) => item.id !== id && !(item.requestId === requestId && item.lookId === lookId));
  saveLikedLooks(next);
  return next;
}

export function applyLookVoteToHistory(input: {
  requestId: string;
  look: Pick<StylistLookV1, "id" | "title" | "hook" | "formula" | "why" | "heroImage" | "fittingImage" | "pieces" | "levelUp">;
  vote: LikedLookVote;
}): LikedLook[] {
  upsertLookVote({ requestId: input.requestId, lookId: input.look.id, vote: input.vote });
  if (!voteKeepsHistory(input.vote)) {
    return removeLikedLook(input.requestId, input.look.id);
  }
  const saved = likedLookFromVote(input);
  if (!saved) return loadLikedLooks();
  const next = upsertLikedLook(saved);
  if (Array.isArray(next)) return next;
  return loadLikedLooks();
}

export function subscribeLikedLooks(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener("storage", handler);
  window.addEventListener(LIKED_LOOKS_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(LIKED_LOOKS_EVENT, handler);
  };
}
