import { ATELIER_PUBLIC_ORIGIN } from "./contact";
import { inboxResponse, listPendingRequests, readInbox } from "./stylist-inbox";
import {
  parseStylistResponse,
  type StylistLookV1,
  type StylistRequestV1,
  type StylistResponseV1,
} from "./stylist-contract";

/** Known ready lookbooks on the lasting host. Public index still requires live shop URLs. */
export const SHOWCASE_REQUEST_IDS = [
  "srq_mttjzq0v_1632a4d0",
  "srq_mttfjkm3_c8499e9a",
  "srq_zara_pilot_mttu",
] as const;

export type PublicLookbook = {
  requestId: string;
  updatedAt: string;
  request: StylistRequestV1 | null;
  response: StylistResponseV1;
};

function isReady(response: StylistResponseV1 | null): response is StylistResponseV1 {
  return Boolean(response?.looks?.length);
}

export function isLiveShopUrl(url?: string | null): boolean {
  if (!url) return false;
  const value = url.trim();
  if (!value || value.startsWith("#")) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function wornPieces(looks: StylistLookV1[]) {
  return looks.flatMap((look) => look.pieces ?? []);
}

/** Public showcase: majority of worn pieces must have a real http(s) shop URL. */
export function lookbookHasLiveShopUrls(response: StylistResponseV1): boolean {
  const pieces = wornPieces(response.looks);
  if (!pieces.length) return false;
  const live = pieces.filter((piece) => isLiveShopUrl(piece.shopUrl)).length;
  return live >= Math.ceil(pieces.length / 2);
}

function asPublic(book: PublicLookbook | null): PublicLookbook | null {
  if (!book || !lookbookHasLiveShopUrls(book.response)) return null;
  return book;
}

async function fetchRemoteLookbook(requestId: string): Promise<PublicLookbook | null> {
  const origin = process.env.ATELIER_LOOKS_ORIGIN || ATELIER_PUBLIC_ORIGIN;
  try {
    const res = await fetch(`${origin}/api/stylist/looks?requestId=${encodeURIComponent(requestId)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { status?: string; request?: StylistRequestV1 | null; response?: unknown };
    const response = parseStylistResponse(body.response);
    if (!isReady(response)) return null;
    return {
      requestId: response.requestId,
      updatedAt: new Date().toISOString(),
      request: body.request ?? null,
      response,
    };
  } catch {
    return null;
  }
}

async function loadOne(requestId: string): Promise<PublicLookbook | null> {
  try {
    const record = await readInbox(requestId);
    const response = inboxResponse(record);
    if (isReady(response)) {
      return {
        requestId: response.requestId,
        updatedAt: record?.updatedAt ?? new Date().toISOString(),
        request: record?.request ?? null,
        response,
      };
    }
  } catch {
    /* fall through to remote */
  }
  return fetchRemoteLookbook(requestId);
}

export async function listPublicLookbooks(): Promise<PublicLookbook[]> {
  const found = new Map<string, PublicLookbook>();

  const inbox = await listPendingRequests().catch(() => []);
  for (const record of inbox) {
    const response = inboxResponse(record);
    if (!isReady(response)) continue;
    const book = asPublic({
      requestId: response.requestId,
      updatedAt: record.updatedAt,
      request: record.request,
      response,
    });
    if (book) found.set(book.requestId, book);
  }

  const missing = SHOWCASE_REQUEST_IDS.filter((id) => !found.has(id));
  if (missing.length) {
    const extras = await Promise.all(missing.map((id) => loadOne(id).catch(() => null)));
    for (const book of extras) {
      const live = asPublic(book);
      if (live) found.set(live.requestId, live);
    }
  }

  return [...found.values()].sort((a, b) => {
    const aSeed = SHOWCASE_REQUEST_IDS.indexOf(a.requestId as (typeof SHOWCASE_REQUEST_IDS)[number]);
    const bSeed = SHOWCASE_REQUEST_IDS.indexOf(b.requestId as (typeof SHOWCASE_REQUEST_IDS)[number]);
    if (aSeed >= 0 || bSeed >= 0) {
      return (aSeed < 0 ? 99 : aSeed) - (bSeed < 0 ? 99 : bSeed);
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export async function loadPublicLookbook(requestId: string): Promise<PublicLookbook | null> {
  try {
    return asPublic(await loadOne(requestId));
  } catch {
    return null;
  }
}
