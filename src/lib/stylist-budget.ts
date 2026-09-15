import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { FREE_DAILY_GENERATE_LIMIT } from "./freemium";
import { redisCommand, redisConfigured } from "./stylist-inbox";
import type { StylistRequestV1 } from "./stylist-contract";

/**
 * Friend beta default for hero GenerateImage (fitting) boards only.
 * Tiles-only creates (`fittingCount === 0` / `styleThisPiece`) do not check or increment this bucket.
 * Override with STYLIST_USER_DAILY_LIMIT or STYLIST_USER_GENERATE_LIMIT.
 */
export const USER_GENERATE_DAILY_LIMIT = 5;

/** Re-export so budget UI/tests share the product lock (1 free Style generate / UTC day). */
export { FREE_DAILY_GENERATE_LIMIT };

/** True when a create should meter userGenerate + global daily COGS (hero fittings). */
export function countsTowardUserGenerate(
  request: Pick<StylistRequestV1, "fittingCount" | "generateMode">
): boolean {
  if (request.generateMode === "styleThisPiece") return false;
  return (request.fittingCount ?? 0) > 0;
}

export function userDailyLimit(): number {
  const raw = Number(process.env.STYLIST_USER_DAILY_LIMIT || process.env.STYLIST_USER_GENERATE_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : USER_GENERATE_DAILY_LIMIT;
}

export type BudgetBucket = {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
};

export type StylistBudgetSnapshot = {
  ok: true;
  globalDaily: BudgetBucket;
  userGenerate: BudgetBucket | null;
  /** Free 4-look generates this UTC day (limit 1). Null when no userKey. Premium does not increment. */
  freeGenerate: BudgetBucket | null;
};

type BudgetFile = {
  days: Record<string, { global: number; users: Record<string, number>; freeUsers?: Record<string, number> }>;
  requests: Record<string, string>;
  inflight?: Record<string, { requestId: string; at: number }>;
};

const FILE = path.join(process.cwd(), ".data", "stylist", "budget.json");
const TTL_SECONDS = 60 * 60 * 72;

export function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function globalDailyLimit(): number {
  const raw = Number(process.env.STYLIST_GLOBAL_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 20;
}

function bucket(used: number, limit: number): BudgetBucket {
  const safeUsed = Math.max(0, Math.floor(used));
  const remaining = Math.max(0, limit - safeUsed);
  return {
    used: safeUsed,
    limit,
    remaining,
    exhausted: safeUsed >= limit,
  };
}

function emptyFile(): BudgetFile {
  return { days: {}, requests: {} };
}

async function readFileStore(): Promise<BudgetFile> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as BudgetFile;
  } catch {
    return emptyFile();
  }
}

async function writeFileStore(store: BudgetFile) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(store), "utf8");
}

function globalKey(day: string) {
  return `atelier:budget:v1:global:${day}`;
}

function userKeyName(userKey: string, day: string) {
  return `atelier:budget:v1:user:${userKey}:${day}`;
}

function freeGenerateKey(userKey: string, day: string) {
  return `atelier:budget:v1:free-gen:${userKey}:${day}`;
}

function requestMapKey(requestId: string) {
  return `atelier:budget:v1:req:${requestId}`;
}

function inflightKey(userKey: string) {
  return `atelier:budget:v1:inflight:${userKey}`;
}

const INFLIGHT_TTL_SECONDS = 120;

/** Mapped user for a request — null if unknown (does not fall back to the request id). */
export async function mappedUserKeyForRequest(requestId: string | null | undefined): Promise<string | null> {
  const id = requestId?.trim();
  if (!id) return null;
  if (redisConfigured()) {
    const mapped = await redisCommand<string | null>(["GET", requestMapKey(id)]);
    return mapped?.trim() || null;
  }
  const store = await readFileStore();
  return store.requests[id] ?? null;
}

export async function readInflightRequestId(userKey: string): Promise<string | null> {
  const key = userKey.trim();
  if (!key) return null;
  if (redisConfigured()) {
    const id = await redisCommand<string | null>(["GET", inflightKey(key)]);
    return id?.trim() || null;
  }
  const store = await readFileStore();
  const row = store.inflight?.[key];
  if (!row?.requestId) return null;
  if (Date.now() - row.at > INFLIGHT_TTL_SECONDS * 1000) return null;
  return row.requestId;
}

export async function writeInflightRequestId(userKey: string, requestId: string): Promise<void> {
  const key = userKey.trim();
  const id = requestId.trim();
  if (!key || !id) return;
  if (redisConfigured()) {
    await redisCommand(["SET", inflightKey(key), id, "EX", INFLIGHT_TTL_SECONDS]);
    return;
  }
  const store = await readFileStore();
  store.inflight = { ...(store.inflight ?? {}), [key]: { requestId: id, at: Date.now() } };
  try {
    await writeFileStore(store);
  } catch {
    /* local/dev only */
  }
}

async function redisGetNumber(key: string): Promise<number | null> {
  const value = await redisCommand<string | number | null>(["GET", key]);
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function resolveBudgetUserKey(params: {
  userKey?: string | null;
  requestId?: string | null;
}): Promise<string | null> {
  const direct = params.userKey?.trim();
  if (direct) return direct;
  const requestId = params.requestId?.trim();
  if (!requestId) return null;
  if (redisConfigured()) {
    try {
      const mapped = await redisCommand<string | null>(["GET", requestMapKey(requestId)]);
      if (mapped?.trim()) return mapped.trim();
    } catch {
      /* requestId itself still yields a userGenerate object */
    }
  } else {
    const store = await readFileStore();
    if (store.requests[requestId]) return store.requests[requestId];
  }
  return requestId;
}

export async function readStylistBudget(params: {
  userKey?: string | null;
  requestId?: string | null;
} = {}): Promise<StylistBudgetSnapshot> {
  const day = utcDayKey();
  const limit = globalDailyLimit();
  const wantsUser = Boolean(params.userKey?.trim() || params.requestId?.trim());
  const resolvedUser = wantsUser ? await resolveBudgetUserKey(params) : null;

  if (redisConfigured()) {
    try {
      const used = (await redisGetNumber(globalKey(day))) ?? 0;
      let userGenerate: BudgetBucket | null = null;
      let freeGenerate: BudgetBucket | null = null;
      if (resolvedUser) {
        const userUsed = (await redisGetNumber(userKeyName(resolvedUser, day))) ?? 0;
        userGenerate = bucket(userUsed, userDailyLimit());
        const freeUsed = (await redisGetNumber(freeGenerateKey(resolvedUser, day))) ?? 0;
        freeGenerate = bucket(freeUsed, FREE_DAILY_GENERATE_LIMIT);
      }
      return { ok: true, globalDaily: bucket(used, limit), userGenerate, freeGenerate };
    } catch {
      /* fall through to file — do not block generate on a Redis read miss */
    }
  }

  const store = await readFileStore();
  const dayRow = store.days[day] ?? { global: 0, users: {} };
  const userGenerate = resolvedUser
    ? bucket(dayRow.users[resolvedUser] ?? 0, userDailyLimit())
    : null;
  const freeGenerate = resolvedUser
    ? bucket(dayRow.freeUsers?.[resolvedUser] ?? 0, FREE_DAILY_GENERATE_LIMIT)
    : null;
  return { ok: true, globalDaily: bucket(dayRow.global, limit), userGenerate, freeGenerate };
}

/** Map requestId → userKey (+ inflight) without INCR — for tiles-only creates. */
export async function recordBudgetRequestMapping(params: {
  userKey: string;
  requestId: string;
}): Promise<void> {
  const userKey = params.userKey.trim();
  const requestId = params.requestId.trim();
  if (!userKey || !requestId) return;

  if (redisConfigured()) {
    try {
      await Promise.all([
        redisCommand(["SET", requestMapKey(requestId), userKey, "EX", 60 * 60 * 24 * 7]),
        redisCommand(["SET", inflightKey(userKey), requestId, "EX", INFLIGHT_TTL_SECONDS]),
      ]);
      return;
    } catch {
      /* fall through to file */
    }
  }

  const store = await readFileStore();
  store.requests[requestId] = userKey;
  store.inflight = { ...(store.inflight ?? {}), [userKey]: { requestId, at: Date.now() } };
  try {
    await writeFileStore(store);
  } catch {
    /* local/dev only */
  }
}

/** INCR user + global buckets and map request → user. Fitting boards only. */
export async function incrementGenerateBudget(params: {
  userKey: string;
  requestId: string;
}): Promise<StylistBudgetSnapshot> {
  const day = utcDayKey();
  const limit = globalDailyLimit();
  const userKey = params.userKey.trim();

  if (redisConfigured()) {
    try {
      const [globalUsed, userUsed] = await Promise.all([
        redisCommand<number>(["INCR", globalKey(day)]),
        redisCommand<number>(["INCR", userKeyName(userKey, day)]),
      ]);
      if (globalUsed == null || userUsed == null) throw new Error("redis incr missed");
      await Promise.all([
        redisCommand(["EXPIRE", globalKey(day), TTL_SECONDS]),
        redisCommand(["EXPIRE", userKeyName(userKey, day), TTL_SECONDS]),
      ]);
      await recordBudgetRequestMapping({ userKey, requestId: params.requestId });
      return {
        ok: true,
        globalDaily: bucket(Number(globalUsed) || 0, limit),
        userGenerate: bucket(Number(userUsed) || 0, userDailyLimit()),
        freeGenerate: bucket(
          (await redisGetNumber(freeGenerateKey(userKey, day))) ?? 0,
          FREE_DAILY_GENERATE_LIMIT
        ),
      };
    } catch {
      /* fall through */
    }
  }

  const store = await readFileStore();
  const dayRow = store.days[day] ?? { global: 0, users: {} };
  dayRow.global += 1;
  dayRow.users[userKey] = (dayRow.users[userKey] ?? 0) + 1;
  store.days[day] = dayRow;
  store.requests[params.requestId] = userKey;
  store.inflight = { ...(store.inflight ?? {}), [userKey]: { requestId: params.requestId, at: Date.now() } };
  try {
    await writeFileStore(store);
  } catch {
    /* local/dev only; Vercel without Redis cannot persist the file */
  }
  return {
    ok: true,
    globalDaily: bucket(dayRow.global, limit),
    userGenerate: bucket(dayRow.users[userKey], userDailyLimit()),
    freeGenerate: bucket(dayRow.freeUsers?.[userKey] ?? 0, FREE_DAILY_GENERATE_LIMIT),
  };
}

/** INCR the free 1-generate/day bucket. Does not touch fitting COGS (userGenerate / global). */
export async function incrementFreeDailyGenerate(params: {
  userKey: string;
  requestId: string;
}): Promise<StylistBudgetSnapshot> {
  const day = utcDayKey();
  const userKey = params.userKey.trim();
  const after = await readStylistBudget({ userKey, requestId: params.requestId });
  if (!userKey) return after;

  if (redisConfigured()) {
    try {
      const used = await redisCommand<number>(["INCR", freeGenerateKey(userKey, day)]);
      if (used == null) throw new Error("redis incr missed");
      await redisCommand(["EXPIRE", freeGenerateKey(userKey, day), TTL_SECONDS]);
      await recordBudgetRequestMapping({ userKey, requestId: params.requestId });
      const live = await readStylistBudget({ userKey, requestId: params.requestId });
      return { ...live, freeGenerate: bucket(Number(used) || 0, FREE_DAILY_GENERATE_LIMIT) };
    } catch {
      /* fall through */
    }
  }

  const store = await readFileStore();
  const dayRow = store.days[day] ?? { global: 0, users: {} };
  dayRow.freeUsers = { ...(dayRow.freeUsers ?? {}) };
  dayRow.freeUsers[userKey] = (dayRow.freeUsers[userKey] ?? 0) + 1;
  store.days[day] = dayRow;
  store.requests[params.requestId] = userKey;
  store.inflight = { ...(store.inflight ?? {}), [userKey]: { requestId: params.requestId, at: Date.now() } };
  try {
    await writeFileStore(store);
  } catch {
    /* local/dev only */
  }
  return {
    ok: true,
    globalDaily: bucket(dayRow.global, globalDailyLimit()),
    userGenerate: bucket(dayRow.users[userKey] ?? 0, userDailyLimit()),
    freeGenerate: bucket(dayRow.freeUsers[userKey], FREE_DAILY_GENERATE_LIMIT),
  };
}

export function budgetExhausted(snapshot: StylistBudgetSnapshot): boolean {
  if (snapshot.globalDaily.exhausted) return true;
  return Boolean(snapshot.userGenerate?.exhausted);
}

/** Free 1/day Style generate — session day stamp OR persisted freeGenerate bucket. */
export function freeDailyGenerateExhausted(input: {
  session?: Pick<import("./types").ProfileSession, "lastFreeGenerateDay" | "hasPremium"> | null;
  budget?: StylistBudgetSnapshot | null;
  today?: string;
}): boolean {
  if (input.session?.hasPremium) return false;
  const day = input.today ?? utcDayKey();
  if (input.session?.lastFreeGenerateDay === day) return true;
  return Boolean(input.budget?.freeGenerate?.exhausted);
}

export function newGenerateUserKey(): string {
  return `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
