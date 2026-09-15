import { parseStylistResponse, type StylistResponseV1 } from "./stylist-contract";

export const STYLIST_CLIENT_KEY = "atelier.stylist.response.v1";
export const STYLIST_LOOKS_PREFIX = "atelier.stylist.looks.";
export const STYLIST_RECENT_KEY = "atelier.stylist.recentIds";
const MAX_RECENT = 8;

function canUseStorage() {
  return typeof window !== "undefined";
}

export function readRecentLookIds(): string[] {
  if (!canUseStorage()) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(STYLIST_RECENT_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function rememberLookRequestId(requestId: string | undefined | null) {
  if (!canUseStorage() || !requestId) return;
  const ids = [requestId, ...readRecentLookIds().filter((id) => id !== requestId)].slice(0, MAX_RECENT);
  localStorage.setItem(STYLIST_RECENT_KEY, JSON.stringify(ids));
}

export function writeCachedLooks(response: StylistResponseV1) {
  if (!canUseStorage()) return;
  const parsed = parseStylistResponse(response);
  if (!parsed?.looks.length) return;
  const raw = JSON.stringify(parsed);
  localStorage.setItem(`${STYLIST_LOOKS_PREFIX}${parsed.requestId}`, raw);
  sessionStorage.setItem(STYLIST_CLIENT_KEY, raw);
  rememberLookRequestId(parsed.requestId);
}

/** @deprecated use writeCachedLooks */
export function writeClientLooks(response: StylistResponseV1) {
  writeCachedLooks(response);
}

export function readCachedLooks(requestId: string | undefined | null): StylistResponseV1 | null {
  if (!canUseStorage() || !requestId) return null;
  try {
    const fromKey = parseStylistResponse(JSON.parse(localStorage.getItem(`${STYLIST_LOOKS_PREFIX}${requestId}`) ?? ""));
    if (fromKey?.looks.length) return fromKey;
  } catch {
    /* try session fallback */
  }
  try {
    const session = parseStylistResponse(JSON.parse(sessionStorage.getItem(STYLIST_CLIENT_KEY) ?? ""));
    if (session?.looks.length && session.requestId === requestId) return session;
  } catch {
    return null;
  }
  return null;
}

export function findCachedLooks(requestIds: string[] = []): StylistResponseV1 | null {
  const explicit = [...new Set(requestIds.filter(Boolean))];
  if (explicit.length) {
    for (const id of explicit) {
      const found = readCachedLooks(id);
      if (found?.looks.length && found.requestId === id) return found;
    }
    return null;
  }
  const ids = [...new Set(readRecentLookIds())];
  for (const id of ids) {
    const found = readCachedLooks(id);
    if (found?.looks.length) return found;
  }
  try {
    const session = parseStylistResponse(JSON.parse(sessionStorage.getItem(STYLIST_CLIENT_KEY) ?? ""));
    if (session?.looks.length) return session;
  } catch {
    /* none */
  }
  return null;
}

export function readClientLooks(): StylistResponseV1 | null {
  return findCachedLooks();
}

export function clearClientLooks() {
  if (!canUseStorage()) return;
  sessionStorage.removeItem(STYLIST_CLIENT_KEY);
}
