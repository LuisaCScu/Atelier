import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { FITTINGS_PARKED, type StylistGenerateModeV1, type StylistResponseV1 } from "./stylist-contract";
import { redisCommand, redisConfigured, stylistStoreDriver } from "./stylist-inbox";
import type { ProfileSession } from "./types";

/** Versioned so hero-dependent / pre-park entries never poison tiles-only hits. */
export const LOOK_CACHE_NAMESPACE = "look-cache:v3-tiles";
export const LOOK_CACHE_TTL_SECONDS = 60 * 60 * 24 * 14;

export type LookCacheRecord = {
  key: string;
  fingerprint: string;
  generateMode: StylistGenerateModeV1;
  /** Always tiles-only while fittings parked — never serve worn heroes from cache. */
  tilesOnly: true;
  response: StylistResponseV1;
  updatedAt: string;
};

export type LookFingerprintInput = {
  session: ProfileSession;
  generateMode: StylistGenerateModeV1;
  closetPieceIds?: string[];
  focusPieceId?: string | null;
};

/** Stable hash of profile + generateMode + closet + per-user vote/avoid history.
 * Vote/dislike history MUST be in the key so cached prior boards are never remapped
 * onto a fresh Create after No / wrong-shoes / avoid.pieceIds change.
 */
export function buildLookFingerprint(input: LookFingerprintInput): string {
  const s = input.session;
  const pieceIds = [...new Set((input.closetPieceIds ?? []).map((id) => id.trim()).filter(Boolean))].sort();
  const focus = (input.focusPieceId || "").trim();
  const avoid = s.styleSignals?.avoid;
  const feedback = s.styleSignals?.feedback;
  const lookVotes = (s.lookFeedback ?? [])
    .map((v) => `${v.lookId}:${v.vote}:${[...(v.reasons ?? [])].map(String).sort().join(",")}`)
    .sort();
  const payload = {
    v: 3,
    tiles: true,
    mode: input.generateMode,
    focus: focus || null,
    pieces: pieceIds,
    season: s.season ?? null,
    undertone: s.undertone ?? null,
    value: s.value ?? null,
    chroma: s.chroma ?? null,
    shape: s.shape ?? null,
    torso: s.torso ?? null,
    size: s.size ?? null,
    budgetMin: s.budgetMin ?? null,
    budgetMax: s.budgetMax ?? null,
    priorities: [...(s.priorities ?? [])].sort(),
    occasions: [...(s.occasions ?? [])].sort(),
    ...(typeof s.styleBrief === "string" && s.styleBrief.trim()
      ? { styleBrief: s.styleBrief.trim().slice(0, 280) }
      : {}),
    liked: [...(s.likedStyleIds ?? [])].sort(),
    disliked: [...(s.dislikedStyleIds ?? [])].sort(),
    fav: (s.favColors ?? []).map((c) => `${c.name}:${c.hex}`).sort(),
    lookAge: s.lookAge ?? null,
    appearance: s.appearance
      ? [
          s.appearance.hairColor,
          s.appearance.hairLength,
          s.appearance.eyes,
          s.appearance.skinToneBand,
        ].join("|")
      : null,
    // Per-user only — never a global SKU ban key.
    avoidPieces: [...(avoid?.pieceIds ?? [])].map(String).sort(),
    avoidClasses: [...(avoid?.classes ?? [])].map(String).sort(),
    avoidLooks: [...(avoid?.lookIds ?? [])].map(String).sort(),
    feedbackVotes: feedback?.lookVotes ?? 0,
    feedbackLast: feedback?.lastLookId ?? null,
    feedbackReasons: [...(feedback?.lastReasons ?? [])].map(String).sort(),
    lookVotes,
    coreHashes: [...(s.styleSignals?.recentServedCoreHashes ?? [])].map(String).sort(),
    // Bust remapping prior boards onto a new Create requestId.
    priorRequestId: s.stylistRequestId ?? null,
    priorRequestCount: (s.stylistRequestIds ?? []).length,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
}

export function redisLookCacheKey(fingerprint: string): string {
  return `${LOOK_CACHE_NAMESPACE}:${fingerprint}`;
}

function dataDir() {
  if (process.env.STYLIST_DATA_DIR) return path.join(process.env.STYLIST_DATA_DIR, "look-cache");
  return path.join(process.cwd(), ".data/look-cache");
}

function fileFor(fingerprint: string) {
  const safe = fingerprint.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
  return path.join(dataDir(), `${safe}.json`);
}

function tilesOnlyResponse(response: StylistResponseV1): StylistResponseV1 | null {
  if (!response?.looks?.length) return null;
  // Refuse to cache / serve anything that still expects live heroes while parked.
  if (!FITTINGS_PARKED) {
    const needsHero = response.looks.some((look) => look.fittingLocked !== true);
    if (needsHero) return null;
  }
  return {
    ...response,
    looks: response.looks.map((look) => ({
      ...look,
      fittingLocked: true,
      // Drop hero URLs from cache payload — tiles-only product lock.
      heroImage: "",
      fittingImage: undefined,
    })),
  };
}

async function readRedis(fingerprint: string): Promise<LookCacheRecord | null> {
  const raw = await redisCommand<string>(["GET", redisLookCacheKey(fingerprint)]);
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as LookCacheRecord;
    if (!parsed?.tilesOnly || !parsed.response?.looks?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeRedis(record: LookCacheRecord) {
  await redisCommand(["SET", redisLookCacheKey(record.fingerprint), JSON.stringify(record), "EX", LOOK_CACHE_TTL_SECONDS]);
}

async function readFs(fingerprint: string): Promise<LookCacheRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(fileFor(fingerprint), "utf8")) as LookCacheRecord;
    if (!parsed?.tilesOnly || parsed.fingerprint !== fingerprint || !parsed.response?.looks?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeFs(record: LookCacheRecord) {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(fileFor(record.fingerprint), JSON.stringify(record), "utf8");
}

export function lookCacheDriver(): "redis" | "fs" {
  return stylistStoreDriver();
}

export async function readLookCache(fingerprint: string): Promise<LookCacheRecord | null> {
  if (!fingerprint) return null;
  if (redisConfigured()) return readRedis(fingerprint);
  return readFs(fingerprint);
}

export async function writeLookCache(input: {
  fingerprint: string;
  generateMode: StylistGenerateModeV1;
  response: StylistResponseV1;
}): Promise<LookCacheRecord | null> {
  const slim = tilesOnlyResponse(input.response);
  if (!slim) return null;
  const record: LookCacheRecord = {
    key: redisLookCacheKey(input.fingerprint),
    fingerprint: input.fingerprint,
    generateMode: input.generateMode,
    tilesOnly: true,
    response: slim,
    updatedAt: new Date().toISOString(),
  };
  if (redisConfigured()) await writeRedis(record);
  else await writeFs(record);
  return record;
}

/** Remap a cached board onto a fresh requestId for immediate ready. */
export function responseFromLookCache(
  cached: LookCacheRecord,
  requestId: string
): StylistResponseV1 | null {
  const slim = tilesOnlyResponse(cached.response);
  if (!slim) return null;
  return {
    ...slim,
    requestId,
    looks: slim.looks.map((look, index) => ({
      ...look,
      // Always mint fresh ids per requestId so prior Wear/No votes cannot clear the new board.
      id: `cached-${requestId.slice(-8)}-${index + 1}`,
      fittingLocked: true,
      heroImage: "",
      fittingImage: undefined,
    })),
  };
}
