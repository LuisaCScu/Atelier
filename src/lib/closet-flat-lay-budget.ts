/**
 * Closet flat-lay polish budget — SEPARATE from stylist userGenerate.
 * Never import or call incrementGenerateBudget / readStylistBudget here.
 *
 * Redis key: atelier:closet-polish:v1:{userOrDevice}:{utcDay}
 * File fallback: .data/closet/flat-lay-budget.json
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { redisCommand, redisConfigured } from "./stylist-inbox";
import { utcDayKey, type BudgetBucket } from "./stylist-budget";

export const CLOSET_FLATLAY_DEFAULT_DAILY_LIMIT = 10;
export const CLOSET_DEVICE_COOKIE = "atelier.closetDevice.v1";

/** ~gpt-image-1 low-res edit estimate (USD) — logged, not billed here. */
export const CLOSET_FLATLAY_EST_COST_USD = 0.04;

type FlatLayBudgetFile = {
  days: Record<string, Record<string, number>>;
};

const FILE = path.join(process.cwd(), ".data", "closet", "flat-lay-budget.json");
const TTL_SECONDS = 60 * 60 * 72;

export function closetFlatLayDailyLimit(): number {
  const raw = Number(process.env.CLOSET_FLATLAY_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : CLOSET_FLATLAY_DEFAULT_DAILY_LIMIT;
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

function redisKey(userOrDevice: string, day: string) {
  return `atelier:closet-polish:v1:${userOrDevice}:${day}`;
}

async function readFileStore(): Promise<FlatLayBudgetFile> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as FlatLayBudgetFile;
  } catch {
    return { days: {} };
  }
}

async function writeFileStore(store: FlatLayBudgetFile) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(store), "utf8");
}

async function redisGetNumber(key: string): Promise<number> {
  const value = await redisCommand<string | number | null>(["GET", key]);
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export type ClosetFlatLayBudgetSnapshot = {
  ok: true;
  polish: BudgetBucket;
  day: string;
  estCostUsdPerCall: number;
};

export async function readClosetFlatLayBudget(userOrDevice: string): Promise<ClosetFlatLayBudgetSnapshot> {
  const day = utcDayKey();
  const limit = closetFlatLayDailyLimit();
  const key = userOrDevice.trim() || "anon";

  if (redisConfigured()) {
    try {
      const used = await redisGetNumber(redisKey(key, day));
      return {
        ok: true,
        polish: bucket(used, limit),
        day,
        estCostUsdPerCall: CLOSET_FLATLAY_EST_COST_USD,
      };
    } catch {
      /* fall through */
    }
  }

  const store = await readFileStore();
  const used = store.days[day]?.[key] ?? 0;
  return {
    ok: true,
    polish: bucket(used, limit),
    day,
    estCostUsdPerCall: CLOSET_FLATLAY_EST_COST_USD,
  };
}

/** INCR polish budget only — never touches stylist userGenerate / globalDaily. */
export async function incrementClosetFlatLayBudget(userOrDevice: string): Promise<ClosetFlatLayBudgetSnapshot> {
  const day = utcDayKey();
  const limit = closetFlatLayDailyLimit();
  const key = userOrDevice.trim() || "anon";

  if (redisConfigured()) {
    try {
      const used = await redisCommand<number>(["INCR", redisKey(key, day)]);
      if (used == null) throw new Error("redis incr missed");
      await redisCommand(["EXPIRE", redisKey(key, day), TTL_SECONDS]);
      return {
        ok: true,
        polish: bucket(Number(used) || 0, limit),
        day,
        estCostUsdPerCall: CLOSET_FLATLAY_EST_COST_USD,
      };
    } catch {
      /* fall through */
    }
  }

  const store = await readFileStore();
  const dayRow = store.days[day] ?? {};
  dayRow[key] = (dayRow[key] ?? 0) + 1;
  store.days[day] = dayRow;
  try {
    await writeFileStore(store);
  } catch {
    /* local/dev */
  }
  return {
    ok: true,
    polish: bucket(dayRow[key] ?? 0, limit),
    day,
    estCostUsdPerCall: CLOSET_FLATLAY_EST_COST_USD,
  };
}


/** Refund one polish unit after reserve when the model call fails (config/billing). */
export async function decrementClosetFlatLayBudget(userOrDevice: string): Promise<ClosetFlatLayBudgetSnapshot> {
  const day = utcDayKey();
  const limit = closetFlatLayDailyLimit();
  const key = userOrDevice.trim() || "anon";

  if (redisConfigured()) {
    try {
      const used = await redisCommand<number>(["DECR", redisKey(key, day)]);
      if (used == null) throw new Error("redis decr missed");
      const safe = Math.max(0, Number(used) || 0);
      if (safe === 0) await redisCommand(["EXPIRE", redisKey(key, day), TTL_SECONDS]);
      // Prevent negative: bump back if we went under 0
      if (Number(used) < 0) {
        await redisCommand(["SET", redisKey(key, day), "0", "EX", TTL_SECONDS]);
        return { ok: true, polish: bucket(0, limit), day, estCostUsdPerCall: CLOSET_FLATLAY_EST_COST_USD };
      }
      return {
        ok: true,
        polish: bucket(safe, limit),
        day,
        estCostUsdPerCall: CLOSET_FLATLAY_EST_COST_USD,
      };
    } catch {
      /* fall through */
    }
  }

  const store = await readFileStore();
  const dayRow = store.days[day] ?? {};
  dayRow[key] = Math.max(0, (dayRow[key] ?? 0) - 1);
  store.days[day] = dayRow;
  try {
    await writeFileStore(store);
  } catch {
    /* local/dev */
  }
  return {
    ok: true,
    polish: bucket(dayRow[key] ?? 0, limit),
    day,
    estCostUsdPerCall: CLOSET_FLATLAY_EST_COST_USD,
  };
}

export function newClosetDeviceKey(): string {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
