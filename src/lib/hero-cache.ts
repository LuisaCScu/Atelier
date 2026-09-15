import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { redisCommand, redisConfigured, stylistStoreDriver } from "./stylist-inbox";

export const HERO_CACHE_NAMESPACE = "hero-cache:v1";
export const HERO_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

const ALLOWED_HERO_HOSTS = new Set(["atelier-assets.vercel.app", "atelier-theta-one.vercel.app"]);

export type HeroCacheRecord = {
  key: string;
  heroImageUrl: string;
  requestId?: string;
  lookId?: string;
  updatedAt: string;
};

/** `appearanceFingerprint__sortedPieceIds` — no PNG bytes, URL mapping only. */
export function parseHeroCacheKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  if (key.length < 5 || key.length > 400) return null;
  const sep = key.indexOf("__");
  if (sep < 2 || sep > key.length - 3) return null;
  if (!/^[A-Za-z0-9._:-]+__[A-Za-z0-9._,-]+$/.test(key)) return null;
  return key;
}

/** Lasting https only. Reject data URLs / raw bytes. */
export function parseHeroImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 500) return null;
  if (value.startsWith("data:") || value.startsWith("blob:")) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (!ALLOWED_HERO_HOSTS.has(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function redisHeroKey(key: string): string {
  return `${HERO_CACHE_NAMESPACE}:${key}`;
}

function dataDir() {
  if (process.env.STYLIST_DATA_DIR) return path.join(process.env.STYLIST_DATA_DIR, "hero-cache");
  return path.join(process.cwd(), ".data/hero-cache");
}

function fileFor(key: string) {
  const safe = key.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 180);
  return path.join(dataDir(), `${safe}.json`);
}

async function readRedis(key: string): Promise<HeroCacheRecord | null> {
  const raw = await redisCommand<string>(["GET", redisHeroKey(key)]);
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as HeroCacheRecord;
    return parsed?.heroImageUrl ? parsed : null;
  } catch {
    return null;
  }
}

async function writeRedis(record: HeroCacheRecord) {
  await redisCommand(["SET", redisHeroKey(record.key), JSON.stringify(record), "EX", HERO_CACHE_TTL_SECONDS]);
}

async function readFs(key: string): Promise<HeroCacheRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(fileFor(key), "utf8")) as HeroCacheRecord;
    return parsed?.key === key && parsed.heroImageUrl ? parsed : null;
  } catch {
    return null;
  }
}

async function writeFs(record: HeroCacheRecord) {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(fileFor(record.key), JSON.stringify(record), "utf8");
}

export function heroCacheDriver(): "redis" | "fs" {
  return stylistStoreDriver();
}

export async function readHeroCache(key: string): Promise<HeroCacheRecord | null> {
  if (redisConfigured()) return readRedis(key);
  return readFs(key);
}

export async function writeHeroCache(input: {
  key: string;
  heroImageUrl: string;
  requestId?: string;
  lookId?: string;
}): Promise<HeroCacheRecord> {
  const record: HeroCacheRecord = {
    key: input.key,
    heroImageUrl: input.heroImageUrl,
    requestId: input.requestId,
    lookId: input.lookId,
    updatedAt: new Date().toISOString(),
  };
  if (redisConfigured()) await writeRedis(record);
  else await writeFs(record);
  return record;
}
