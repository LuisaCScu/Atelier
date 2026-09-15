import { closetPacketOptionsForMode, closetToStylistPacket } from "./closet-packet";
import { ensureClosetImagesHydrated, hydrateCloset, loadCloset } from "./closet-store";
import type { StylistResponseV1 } from "./stylist-contract";

/** Per-piece How to style it cache — requestId + dismissed looks (Luisa product lock). */
export const PIECE_STYLE_CACHE_KEY = "atelier.pieceStyle.v1";
export const PIECE_STYLE_EVENT = "atelier:pieceStyle";

/** Target visible looks on a piece page (matches styleThisPiece lookCount). */
export const PIECE_STYLE_LOOK_TARGET = 3;

export type PieceStyleEntry = {
  pieceId: string;
  /** Last / active styleThisPiece requestId for this piece. */
  requestId: string;
  status: "pending" | "ready";
  /** Look ids last known ready on this piece (optional; stylist-client holds full payload). */
  lookIds?: string[];
  /** Disliked looks eliminated from this piece’s cached set. */
  dismissedLookIds?: string[];
  /** In-flight refill request after a dislike (optional). */
  pendingRefillRequestId?: string;
  updatedAt: string;
};

type PieceStyleStore = Record<string, PieceStyleEntry>;

function canUseStorage() {
  return typeof window !== "undefined";
}

function readStore(): PieceStyleStore {
  if (!canUseStorage()) return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PIECE_STYLE_CACHE_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as PieceStyleStore;
  } catch {
    return {};
  }
}

function writeStore(store: PieceStyleStore) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PIECE_STYLE_CACHE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(PIECE_STYLE_EVENT));
}

export function readPieceStyleEntry(pieceId: string): PieceStyleEntry | null {
  const id = pieceId.trim();
  if (!id) return null;
  const entry = readStore()[id];
  if (!entry || typeof entry.requestId !== "string" || !entry.requestId) return null;
  return entry;
}

export function writePieceStyleEntry(entry: PieceStyleEntry) {
  const id = entry.pieceId.trim();
  if (!id || !entry.requestId) return;
  const store = readStore();
  store[id] = {
    ...entry,
    pieceId: id,
    dismissedLookIds: [...new Set(entry.dismissedLookIds ?? [])].slice(0, 40),
    lookIds: entry.lookIds?.slice(0, 12),
    updatedAt: entry.updatedAt || new Date().toISOString(),
  };
  writeStore(store);
}

export function markPieceStylePending(pieceId: string, requestId: string, opts?: { refill?: boolean }) {
  const id = pieceId.trim();
  if (!id || !requestId) return;
  const prev = readPieceStyleEntry(id);
  writePieceStyleEntry({
    pieceId: id,
    requestId: opts?.refill && prev?.requestId ? prev.requestId : requestId,
    status: prev?.status === "ready" && opts?.refill ? "ready" : "pending",
    lookIds: prev?.lookIds,
    dismissedLookIds: prev?.dismissedLookIds,
    pendingRefillRequestId: opts?.refill ? requestId : undefined,
    updatedAt: new Date().toISOString(),
  });
}

export function markPieceStyleReady(
  pieceId: string,
  response: Pick<StylistResponseV1, "requestId" | "looks">,
  opts?: { mergeLookIds?: boolean }
) {
  const id = pieceId.trim();
  if (!id || !response.requestId || !response.looks?.length) return;
  const prev = readPieceStyleEntry(id);
  const dismissed = new Set(prev?.dismissedLookIds ?? []);
  const incomingIds = response.looks.map((look) => look.id).filter((lookId) => !dismissed.has(lookId));
  const lookIds = opts?.mergeLookIds
    ? [...new Set([...(prev?.lookIds ?? []).filter((lookId) => !dismissed.has(lookId)), ...incomingIds])].slice(
        0,
        PIECE_STYLE_LOOK_TARGET
      )
    : incomingIds.slice(0, PIECE_STYLE_LOOK_TARGET);
  writePieceStyleEntry({
    pieceId: id,
    requestId: response.requestId,
    status: "ready",
    lookIds,
    dismissedLookIds: prev?.dismissedLookIds,
    pendingRefillRequestId: undefined,
    updatedAt: new Date().toISOString(),
  });
}

export function dismissPieceStyleLook(pieceId: string, lookId: string): PieceStyleEntry | null {
  const id = pieceId.trim();
  const lid = lookId.trim();
  if (!id || !lid) return null;
  const prev = readPieceStyleEntry(id);
  if (!prev) return null;
  const dismissedLookIds = [...new Set([...(prev.dismissedLookIds ?? []), lid])].slice(0, 40);
  const lookIds = (prev.lookIds ?? []).filter((x) => x !== lid);
  const next: PieceStyleEntry = {
    ...prev,
    dismissedLookIds,
    lookIds,
    updatedAt: new Date().toISOString(),
  };
  writePieceStyleEntry(next);
  return next;
}

export function pieceStyleDismissedSet(pieceId: string): Set<string> {
  const entry = readPieceStyleEntry(pieceId);
  return new Set(entry?.dismissedLookIds ?? []);
}

export function subscribePieceStyleCache(onChange: () => void) {
  if (!canUseStorage()) return () => {};
  const handler = () => onChange();
  window.addEventListener("storage", handler);
  window.addEventListener(PIECE_STYLE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(PIECE_STYLE_EVENT, handler);
  };
}

export type StyleThisPieceEnqueueResult =
  | { ok: true; requestId: string; status?: string }
  | { ok: false; error: string; quotaExhausted?: boolean; premiumRequired?: boolean };

/**
 * Same generate path as StyleThisPieceCta / OnceForm → styleThisPiece, via JSON API
 * so piece detail can auto-start and refill without a full form navigation.
 */
export async function enqueueStyleThisPiece(pieceId: string): Promise<StyleThisPieceEnqueueResult> {
  const id = pieceId.trim();
  if (!id) return { ok: false, error: "Missing piece." };
  try {
    hydrateCloset();
    await ensureClosetImagesHydrated();
    const loaded = loadCloset();
    const packetOpts = closetPacketOptionsForMode("styleThisPiece", {
      closetPieceId: id,
      closetLength: loaded.length,
    });
    const closet = closetToStylistPacket(loaded, packetOpts);
    const res = await fetch("/api/stylist/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        generateMode: "styleThisPiece",
        closetPieceId: id,
        closet,
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

/**
 * Fire-and-forget How to style it enqueue after a piece with a photo is saved.
 * Skips when already pending or ready (no spam). Swallows quota/errors quietly.
 */
export function preheatPieceStyle(pieceId: string): void {
  const id = pieceId.trim();
  if (!id) return;
  const cached = readPieceStyleEntry(id);
  if (cached?.status === "ready" || cached?.status === "pending") return;
  void enqueueStyleThisPiece(id).then((result) => {
    if (result.ok) markPieceStylePending(id, result.requestId);
  });
}
