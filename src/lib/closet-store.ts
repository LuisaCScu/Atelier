import { normalizeClosetItem, slimClosetItem } from "./closet-roles";
import { CLOSET_COOKIE, CLOSET_FREE_CAP, CLOSET_KEY, type ClosetItem } from "./types";

/** IndexedDB for large cutout data URLs — localStorage holds slim metadata only. */
const IDB_NAME = "atelier-closet-blobs-v1";
const IDB_STORE = "cutouts";

/** In-memory cutout cache keyed by closet item id. */
const cutoutMemory = new Map<string, string>();

/** rembg backup when polish replaces cutoutUrl — IDB key `${id}__raw`. */
const rawCutoutMemory = new Map<string, string>();

function rawCutoutIdbKey(id: string): string {
  return `${id}__raw`;
}

/** Set when an IDB put failed and we kept the cutout in memory for this session. */
let cutoutsUsingMemoryOnly = false;

let imagesHydrateInFlight: Promise<void> | null = null;

/** True after any successful memory fallback for closet cutouts this session. */
export function closetCutoutsUsingMemoryOnly(): boolean {
  return cutoutsUsingMemoryOnly;
}

export type ClosetWriteReason = "cap" | "storage" | "unknown";

export type ClosetWriteResult =
  | { ok: true }
  | { ok: false; reason: ClosetWriteReason; message: string };

const CAP_MESSAGE = "Free closet is full on this device.";
const STORAGE_MESSAGE =
  "This device is out of storage space for your closet. Remove a piece or free browser storage, then try again.";
const UNKNOWN_MESSAGE = "Couldn’t save to this device. Try again.";

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return /quota/i.test(String(err));
  const rec = err as { name?: unknown; code?: unknown; message?: unknown };
  if (rec.name === "QuotaExceededError") return true;
  if (rec.code === 22 || rec.code === 1014) return true;
  return /quota/i.test(String(rec.message ?? err));
}

function writeFailure(err: unknown): ClosetWriteResult {
  if (isQuotaError(err)) {
    return { ok: false, reason: "storage", message: STORAGE_MESSAGE };
  }
  return { ok: false, reason: "unknown", message: UNKNOWN_MESSAGE };
}

function openBlobDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
}

async function idbPutCutout(id: string, dataUrl: string): Promise<void> {
  const db = await openBlobDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(dataUrl, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IDB put failed"));
    });
  } finally {
    db.close();
  }
}

async function idbGetCutout(id: string): Promise<string | undefined> {
  const db = await openBlobDb();
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => {
        const value = req.result;
        resolve(typeof value === "string" && value ? value : undefined);
      };
      req.onerror = () => reject(req.error ?? new Error("IDB get failed"));
    });
  } finally {
    db.close();
  }
}

async function idbDeleteCutout(id: string): Promise<void> {
  const db = await openBlobDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IDB delete failed"));
    });
  } finally {
    db.close();
  }
}

/** Try IDB put; on failure keep cutout in session memory and succeed. */
async function putCutout(id: string, dataUrl: string): Promise<void> {
  cutoutMemory.set(id, dataUrl);
  try {
    await idbPutCutout(id, dataUrl);
  } catch {
    cutoutsUsingMemoryOnly = true;
  }
}

function pickCutout(item: ClosetItem): string | undefined {
  const url = item.cutoutUrl || item.imageDataUrl;
  return typeof url === "string" && url ? url : undefined;
}

function withMemoryCutouts(items: ClosetItem[]): ClosetItem[] {
  return items.map((item) => {
    const rawCached = rawCutoutMemory.get(item.id) || item.rawCutoutUrl;
    const cached = cutoutMemory.get(item.id);
    if (cached) {
      return {
        ...item,
        cutoutUrl: cached,
        imageDataUrl: cached,
        ...(rawCached ? { rawCutoutUrl: rawCached } : {}),
      };
    }
    const inline = pickCutout(item);
    if (inline) {
      cutoutMemory.set(item.id, inline);
      return {
        ...item,
        cutoutUrl: inline,
        imageDataUrl: inline,
        ...(rawCached ? { rawCutoutUrl: rawCached } : {}),
      };
    }
    const { cutoutUrl: _c, imageDataUrl: _i, ...rest } = item;
    return rawCached ? { ...rest, rawCutoutUrl: rawCached } : rest;
  });
}

function readRawCloset(): ClosetItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLOSET_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeClosetItem).filter((item): item is ClosetItem => Boolean(item));
  } catch {
    return [];
  }
}

function writeSlimLocalStorage(items: ClosetItem[]) {
  const slim = items.map(slimClosetItem);
  window.localStorage.setItem(CLOSET_KEY, JSON.stringify(slim));
}

function emitCloset() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("atelier:closet"));
}

/** Sync read — metadata from localStorage, cutouts from in-memory cache (or legacy inline). */
export function loadCloset(): ClosetItem[] {
  return withMemoryCutouts(readRawCloset());
}

/**
 * Persist closet. Large cutout/imageDataUrl blobs go to IndexedDB;
 * localStorage + cookie keep slim metadata only (same fields as slimClosetItem).
 */
export async function saveCloset(items: ClosetItem[]): Promise<ClosetWriteResult> {
  if (typeof window === "undefined") return { ok: true };
  const normalized = items
    .map(normalizeClosetItem)
    .filter((item): item is ClosetItem => Boolean(item));

  try {
    const keep = new Set(normalized.map((item) => item.id));
    const previousIds = new Set(readRawCloset().map((item) => item.id));

    for (const item of normalized) {
      const url = pickCutout(item) || cutoutMemory.get(item.id);
      if (url) {
        // putCutout always keeps memory; IDB failure is session-ok (Safari Private).
        await putCutout(item.id, url);
      }
      const raw = item.rawCutoutUrl || rawCutoutMemory.get(item.id);
      if (raw) {
        rawCutoutMemory.set(item.id, raw);
        try {
          await idbPutCutout(rawCutoutIdbKey(item.id), raw);
        } catch {
          cutoutsUsingMemoryOnly = true;
        }
      }
      // Missing url on a kept item is not a delete — cutout may still be hydrating from IDB.
    }

    // Drop blobs only for ids removed from the closet.
    for (const id of previousIds) {
      if (keep.has(id)) continue;
      cutoutMemory.delete(id);
      rawCutoutMemory.delete(id);
      try {
        await idbDeleteCutout(id);
      } catch {
        /* ignore */
      }
      try {
        await idbDeleteCutout(rawCutoutIdbKey(id));
      } catch {
        /* ignore */
      }
    }
    for (const id of [...cutoutMemory.keys()]) {
      if (!keep.has(id)) cutoutMemory.delete(id);
    }
    for (const id of [...rawCutoutMemory.keys()]) {
      if (!keep.has(id)) rawCutoutMemory.delete(id);
    }

    writeSlimLocalStorage(normalized);
    writeClosetCookie(normalized);
    emitCloset();
    return { ok: true };
  } catch (err) {
    return writeFailure(err);
  }
}

export function closetIsFull(items = typeof window === "undefined" ? [] : loadCloset()): boolean {
  return items.length >= CLOSET_FREE_CAP;
}

/** Free slots left under the device cap (0 when full). */
export function closetRemainingSlots(items = typeof window === "undefined" ? [] : loadCloset()): number {
  return Math.max(0, CLOSET_FREE_CAP - items.length);
}

export async function addClosetItems(items: ClosetItem[]): Promise<ClosetWriteResult> {
  const current = loadCloset();
  if (current.length + items.length > CLOSET_FREE_CAP) {
    return { ok: false, reason: "cap", message: CAP_MESSAGE };
  }
  const incoming = items
    .map(normalizeClosetItem)
    .filter((item): item is ClosetItem => Boolean(item));
  return saveCloset([...incoming, ...current]);
}

export function getClosetItem(id: string): ClosetItem | null {
  return loadCloset().find((item) => item.id === id) ?? null;
}

/** Load one cutout from memory or IndexedDB (for tiles / edit). */
export async function loadClosetCutout(id: string): Promise<string> {
  const cached = cutoutMemory.get(id);
  if (cached) return cached;
  if (typeof window === "undefined" || !window.indexedDB) return "";
  try {
    const url = await idbGetCutout(id);
    if (url) {
      cutoutMemory.set(id, url);
      return url;
    }
  } catch {
    /* ignore */
  }
  return "";
}

export async function updateClosetItem(
  id: string,
  patch: Partial<Omit<ClosetItem, "id" | "gender">>
): Promise<ClosetItem | null> {
  const current = loadCloset();
  const index = current.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next = normalizeClosetItem({ ...current[index], ...patch, id, gender: "female" });
  if (!next) return null;
  const items = [...current];
  items[index] = next;
  const result = await saveCloset(items);
  if (!result.ok) return null;
  return next;
}

export async function removeClosetItem(id: string): Promise<ClosetWriteResult> {
  return saveCloset(loadCloset().filter((item) => item.id !== id));
}

export function subscribeCloset(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener("storage", handler);
  window.addEventListener("atelier:closet", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("atelier:closet", handler);
  };
}

export function readClosetCookie(): ClosetItem[] {
  if (typeof document === "undefined") return [];
  const match = document.cookie.match(/(?:^|; )atelier\.closet\.v2=([^;]*)/);
  if (!match?.[1]) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeClosetItem).filter((item): item is ClosetItem => Boolean(item));
  } catch {
    return [];
  }
}

export function writeClosetCookie(items: ClosetItem[]) {
  if (typeof document === "undefined") return;
  const slim = items.map(slimClosetItem);
  document.cookie = `${CLOSET_COOKIE}=${encodeURIComponent(JSON.stringify(slim))}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

/**
 * Migrate legacy localStorage rows that still embed huge data URLs into IndexedDB,
 * then rewrite localStorage as slim metadata (frees quota).
 */
async function migrateLegacyInlineBlobs(items: ClosetItem[]): Promise<void> {
  let migrated = false;
  for (const item of items) {
    const inline = pickCutout(item);
    if (!inline || inline.length < 256) continue;
    if (!cutoutMemory.has(item.id) || cutoutMemory.get(item.id) !== inline) {
      cutoutMemory.set(item.id, inline);
    }
    await putCutout(item.id, inline);
    migrated = true;
  }
  if (!migrated && !items.some((item) => (pickCutout(item)?.length ?? 0) >= 256)) return;
  try {
    writeSlimLocalStorage(items);
    writeClosetCookie(items);
  } catch {
    // If slim write still fails, leave legacy blob LS alone for this session.
  }
}

/**
 * Pull cutouts from IndexedDB into memory and re-emit so tiles refresh.
 * Safe to call repeatedly; coalesces concurrent runs.
 */
export async function ensureClosetImagesHydrated(): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  if (imagesHydrateInFlight) return imagesHydrateInFlight;

  imagesHydrateInFlight = (async () => {
    const meta = readRawCloset();
    let changed = false;
    for (const item of meta) {
      if (!rawCutoutMemory.has(item.id)) {
        try {
          const raw = await idbGetCutout(rawCutoutIdbKey(item.id));
          if (raw) {
            rawCutoutMemory.set(item.id, raw);
            changed = true;
          }
        } catch {
          /* ignore */
        }
      }
      if (cutoutMemory.has(item.id)) continue;
      const inline = pickCutout(item);
      if (inline) {
        cutoutMemory.set(item.id, inline);
        changed = true;
        continue;
      }
      try {
        const url = await idbGetCutout(item.id);
        if (url) {
          cutoutMemory.set(item.id, url);
          changed = true;
        }
      } catch {
        /* ignore per-item */
      }
    }
    if (changed) emitCloset();
  })().finally(() => {
    imagesHydrateInFlight = null;
  });

  return imagesHydrateInFlight;
}

/** localStorage is slim metadata source of truth; cutouts live in IndexedDB + memory. Cookie holds slim metadata. */
export function hydrateCloset(): ClosetItem[] {
  const stored = readRawCloset();
  if (stored.length) {
    const hasInlineBlobs = stored.some((item) => (pickCutout(item)?.length ?? 0) >= 256);
    if (hasInlineBlobs) {
      void migrateLegacyInlineBlobs(stored).then(() => ensureClosetImagesHydrated());
    } else {
      void ensureClosetImagesHydrated();
    }
    writeClosetCookie(stored);
    return withMemoryCutouts(stored);
  }
  const fromCookie = readClosetCookie();
  if (fromCookie.length) {
    try {
      writeSlimLocalStorage(fromCookie);
      emitCloset();
    } catch {
      /* ignore */
    }
    void ensureClosetImagesHydrated();
  }
  return withMemoryCutouts(fromCookie);
}
