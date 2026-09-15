import { mkdir, readdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { parseStylistResponse, type StylistRequestV1, type StylistResponseV1 } from "./stylist-contract";
import { LEAN_SCALE, STYLE_SIGNALS_KIND } from "./style-signals";

export type StylistInboxRecord = {
  request: StylistRequestV1;
  response: StylistResponseV1 | null;
  updatedAt: string;
};

const INDEX_KEY = "atelier:stylist:index";
const RECORD_PREFIX = "atelier:stylist:record:";
const TTL_SECONDS = 60 * 60 * 24 * 30;

export function redisConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function stylistStoreDriver(): "redis" | "fs" {
  return redisConfigured() ? "redis" : "fs";
}

function dataDir() {
  if (process.env.STYLIST_DATA_DIR) return process.env.STYLIST_DATA_DIR;
  if (process.env.VERCEL) return "/tmp/atelier-stylist";
  return path.join(process.cwd(), ".data/stylist");
}

function safeId(requestId: string): string | null {
  if (!/^[A-Za-z0-9._-]{4,80}$/.test(requestId)) return null;
  return requestId;
}

function fileFor(requestId: string) {
  return path.join(dataDir(), `${requestId}.json`);
}

function emptyRequest(requestId: string, lookCount: number): StylistRequestV1 {
  return {
    kind: "atelier.stylistRequest.v1",
    requestId,
    gender: "female",
    path: "quick",
    size: null,
    shape: null,
    torso: null,
    measurements: {
      heightCm: null,
      chestCm: null,
      waistCm: null,
      hipsCm: null,
      inseamCm: null,
      shoulderCm: null,
      neckCm: null,
    },
    color: { season: null, undertone: null, value: null, chroma: null, swatches: [] },
    priorities: [],
    likedAesthetics: [],
    dislikedAesthetics: [],
    dislikedSilhouettes: [],
    styleSignals: {
      kind: STYLE_SIGNALS_KIND,
      source: "swipe-quiz",
      swipe: { shown: 0, liked: 0, disliked: 0 },
      lean: {},
      leanScale: { ...LEAN_SCALE },
      tags: { liked: [], disliked: [] },
      feedback: { lookVotes: 0, lastReasons: [] },
      avoid: { pieceIds: [], classes: [], lookIds: [] },
    },
    budget: { min: 80, max: 280, currency: "USD" },
    occasions: ["weekend"],
    lookCount,
    // Soft-default for synthetic/legacy inbox rows; Stylist also soft-defaults storeFirst.
    generateMode: "storeFirst",
  };
}

export async function redisCommand<T>(command: Array<string | number>): Promise<T | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as { result?: T };
  return payload.result ?? null;
}

async function readRedis(id: string): Promise<StylistInboxRecord | null> {
  const raw = await redisCommand<string>(["GET", `${RECORD_PREFIX}${id}`]);
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as StylistInboxRecord;
    return parsed?.request?.requestId ? parsed : null;
  } catch {
    return null;
  }
}

async function writeRedis(record: StylistInboxRecord) {
  const id = record.request.requestId;
  await redisCommand(["SET", `${RECORD_PREFIX}${id}`, JSON.stringify(record), "EX", TTL_SECONDS]);
  await redisCommand(["ZADD", INDEX_KEY, Date.now(), id]);
}

async function listRedis(): Promise<StylistInboxRecord[]> {
  const ids = (await redisCommand<string[]>(["ZREVRANGE", INDEX_KEY, 0, 49])) ?? [];
  const records: StylistInboxRecord[] = [];
  for (const id of ids) {
    const record = await readRedis(id);
    if (record) records.push(record);
  }
  return records;
}

async function ensureDir() {
  await mkdir(dataDir(), { recursive: true });
}

async function readFs(id: string): Promise<StylistInboxRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(fileFor(id), "utf8")) as StylistInboxRecord;
    return parsed?.request?.requestId ? parsed : null;
  } catch {
    return null;
  }
}

async function writeFs(record: StylistInboxRecord) {
  await ensureDir();
  await writeFile(fileFor(record.request.requestId), JSON.stringify(record), "utf8");
}

async function listFs(): Promise<StylistInboxRecord[]> {
  await ensureDir();
  const names = await readdir(/* turbopackIgnore: true */ dataDir()).catch(() => [] as string[]);
  const records: StylistInboxRecord[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const record = await readFs(name.replace(/\.json$/, ""));
    if (record) records.push(record);
  }
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readInbox(requestId: string | undefined | null): Promise<StylistInboxRecord | null> {
  const id = requestId ? safeId(requestId) : null;
  if (!id) return null;
  if (redisConfigured()) return readRedis(id);
  return readFs(id);
}

export async function writeInboxRequest(request: StylistRequestV1): Promise<StylistInboxRecord> {
  const existing = await readInbox(request.requestId);
  const record: StylistInboxRecord = {
    request,
    response: existing?.response ?? null,
    updatedAt: new Date().toISOString(),
  };
  if (redisConfigured()) await writeRedis(record);
  else await writeFs(record);
  return record;
}

export async function writeInboxResponse(response: StylistResponseV1): Promise<StylistInboxRecord> {
  const existing = await readInbox(response.requestId);
  const record: StylistInboxRecord = {
    request: existing?.request ?? emptyRequest(response.requestId, response.looks.length || 4),
    response,
    updatedAt: new Date().toISOString(),
  };
  if (redisConfigured()) await writeRedis(record);
  else await writeFs(record);
  return record;
}

export async function listPendingRequests(): Promise<StylistInboxRecord[]> {
  const records = redisConfigured() ? await listRedis() : await listFs();
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Remove a pending/ready inbox record (Redis DEL+ZREM or FS unlink). */
export async function deleteInbox(requestId: string): Promise<boolean> {
  const id = safeId(requestId);
  if (!id) return false;
  if (redisConfigured()) {
    const existing = await readRedis(id);
    if (!existing) return false;
    await redisCommand(["DEL", `${RECORD_PREFIX}${id}`]);
    await redisCommand(["ZREM", INDEX_KEY, id]);
    return true;
  }
  try {
    await unlink(fileFor(id));
    return true;
  } catch {
    return false;
  }
}

export function inboxResponse(record: StylistInboxRecord | null): StylistResponseV1 | null {
  if (!record?.response) return null;
  return parseStylistResponse(record.response);
}
