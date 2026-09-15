import { normalizeClosetItem } from "./closet-roles";
import { CLOSET_FREE_CAP, type ClosetItem } from "./types";
import {
  parseClosetPieceId,
  parseGenerateMode,
  type StylistClosetPieceV1,
  type StylistGenerateModeV1,
  type StylistPieceRoleV1,
} from "./stylist-contract";

/** Keep inbox/Redis payloads small. Metadata is always sent; images only when they fit — unless forced. */
const MAX_IMAGE_CHARS = 90_000;
const MAX_TOTAL_IMAGE_CHARS = 550_000;

export type ClosetPacketOptions = {
  focusPieceId?: string;
  /** Bypass MAX_IMAGE_CHARS / total budget for every closet piece image (closetFirst lock). */
  forceAllImages?: boolean;
  /**
   * After server-side hostClosetImagesForStylist: only lasting https images.
   * Never forward data: URLs to Stylist (forceAllImages still includes every piece, but only as https).
   */
  httpsOnly?: boolean;
};

/** Closet modes must never strip piece images; storeFirst/styleThisPiece same when closet is non-empty. */
export function shouldForceAllClosetImages(
  mode: StylistGenerateModeV1,
  closetLength: number
): boolean {
  if (mode === "closetFirst") return true;
  return closetLength > 0 && (mode === "storeFirst" || mode === "styleThisPiece");
}

export function closetPacketOptionsForMode(
  mode: StylistGenerateModeV1,
  opts?: { closetPieceId?: string; closetLength?: number }
): ClosetPacketOptions {
  const focusPieceId =
    mode === "styleThisPiece" && opts?.closetPieceId?.trim()
      ? opts.closetPieceId.trim()
      : undefined;
  const forceAllImages = shouldForceAllClosetImages(mode, opts?.closetLength ?? 0);
  return {
    ...(focusPieceId ? { focusPieceId } : {}),
    ...(forceAllImages ? { forceAllImages: true } : {}),
  };
}

export function closetToStylistPacket(
  items: ClosetItem[],
  options?: ClosetPacketOptions
): StylistClosetPieceV1[] {
  const focusId = options?.focusPieceId?.trim() || "";
  const forceAll = Boolean(options?.forceAllImages);
  const httpsOnly = Boolean(options?.httpsOnly);
  const slice = items.slice(0, CLOSET_FREE_CAP);
  // Process focus piece first so it always wins budget when not force-all (styleThisPiece lock).
  const ordered = focusId
    ? [...slice.filter((item) => item.id === focusId), ...slice.filter((item) => item.id !== focusId)]
    : slice;

  const out: StylistClosetPieceV1[] = [];
  let imageBudget = 0;
  for (const item of ordered) {
    const normalized = normalizeClosetItem(item);
    if (!normalized) continue;
    const isFocus = Boolean(focusId && normalized.id === focusId);
    const image = pickPacketImage(normalized.cutoutUrl || normalized.imageDataUrl, imageBudget, {
      force: forceAll || isFocus,
      httpsOnly,
    });
    if (image) imageBudget += image.length;
    const piece: StylistClosetPieceV1 = {
      id: normalized.id,
      role: normalized.role as StylistPieceRoleV1,
      gender: "female",
      source: normalized.source === "video" ? "video" : normalized.source,
    };
    if (normalized.name) piece.name = normalized.name;
    if (normalized.color && normalized.color !== "other") piece.color = normalized.color;
    if (normalized.colorNote) piece.colorNote = normalized.colorNote;
    if (image) piece.image = image;
    out.push(piece);
  }
  return out;
}

function pickPacketImage(
  url: string | undefined,
  used: number,
  opts?: { force?: boolean; httpsOnly?: boolean }
): string | undefined {
  if (!url) return undefined;
  if (/^https:\/\//i.test(url)) return url;
  // Stylist path: never send data:/http: — host first via hostClosetImagesForStylist.
  if (opts?.httpsOnly) return undefined;
  if (!url.startsWith("data:") && /^http:\/\//i.test(url)) return undefined;
  // Client→Atelier transfer may still carry data URLs; server hosts before Redis/Stylist.
  if (opts?.force) return url;
  if (url.length > MAX_IMAGE_CHARS) return undefined;
  if (used + url.length > MAX_TOTAL_IMAGE_CHARS) return undefined;
  return url;
}

export function parseClosetPacket(
  raw: unknown,
  options?: ClosetPacketOptions
): StylistClosetPieceV1[] | undefined {
  const list = coerceList(raw);
  if (!list) return undefined;
  const items = list
    .map((entry) => normalizeClosetItem(entry))
    .filter((item): item is ClosetItem => Boolean(item));
  const packet = closetToStylistPacket(items, options);
  return packet.length ? packet : undefined;
}

/** Parse closet with generateMode-aware forceAllImages (server must never strip closetFirst images). */
export function parseClosetPacketForMode(
  raw: unknown,
  mode: StylistGenerateModeV1,
  closetPieceId?: string
): StylistClosetPieceV1[] | undefined {
  const list = coerceList(raw);
  if (!list) return undefined;
  const items = list
    .map((entry) => normalizeClosetItem(entry))
    .filter((item): item is ClosetItem => Boolean(item));
  if (!items.length) return undefined;
  const packet = closetToStylistPacket(
    items,
    closetPacketOptionsForMode(mode, {
      closetPieceId,
      closetLength: items.length,
    })
  );
  return packet.length ? packet : undefined;
}

export async function closetFromRequest(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        closet?: unknown;
        closetJson?: unknown;
        generateMode?: unknown;
        closetPieceId?: unknown;
      };
      const generateMode = parseGenerateMode(body.generateMode);
      const closetPieceId = parseClosetPieceId(body.closetPieceId);
      return parseClosetPacketForMode(body.closet ?? body.closetJson, generateMode, closetPieceId);
    }
    if (contentType.includes("form")) {
      const data = await request.formData();
      const generateMode = parseGenerateMode(data.get("generateMode"));
      const closetPieceId = parseClosetPieceId(data.get("closetPieceId"));
      return parseClosetPacketForMode(data.get("closetJson"), generateMode, closetPieceId);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** Closet + generateMode (+ closetPieceId) from generate/regenerate API (JSON or form). Body is consumed once. */
export async function stylistGenerateOptionsFromRequest(request: Request): Promise<{
  closet?: StylistClosetPieceV1[];
  generateMode: StylistGenerateModeV1;
  closetPieceId?: string;
}> {
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        closet?: unknown;
        closetJson?: unknown;
        generateMode?: unknown;
        closetPieceId?: unknown;
      };
      const generateMode = parseGenerateMode(body.generateMode);
      const closetPieceId = parseClosetPieceId(body.closetPieceId);
      return {
        closet: parseClosetPacketForMode(body.closet ?? body.closetJson, generateMode, closetPieceId),
        generateMode,
        ...(generateMode === "styleThisPiece" && closetPieceId ? { closetPieceId } : {}),
      };
    }
    if (contentType.includes("form")) {
      const data = await request.formData();
      const generateMode = parseGenerateMode(data.get("generateMode"));
      const closetPieceId = parseClosetPieceId(data.get("closetPieceId"));
      return {
        closet: parseClosetPacketForMode(data.get("closetJson"), generateMode, closetPieceId),
        generateMode,
        ...(generateMode === "styleThisPiece" && closetPieceId ? { closetPieceId } : {}),
      };
    }
  } catch {
    return { generateMode: "storeFirst" };
  }
  return { generateMode: "storeFirst" };
}

function coerceList(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
