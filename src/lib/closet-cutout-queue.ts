/**
 * Persistent Photo-add cutout queue.
 *
 * - Sequential ML (one job at a time) so phones don’t choke.
 * - Survives leaving /closet/add/photo — ClosetPersist runs the worker app-wide.
 * - Meta in localStorage; source + cutout blobs in IndexedDB.
 * - Hard batch / pending cap: 10. Also respects free closet remaining slots.
 */

import { cutoutPhoto } from "./closet-cutout";
import {
  blobToDetectDataUrl,
  cropGarmentBlob,
  requestDetectGarments,
  shouldSplitOutfit,
  type DetectedGarmentPiece,
} from "./closet-outfit-split";
import {
  fetchClosetFlatLayBudget,
  POLISH_BUDGET_EXHAUSTED_MSG,
  requestClosetFlatLayPolish,
  requestClosetFlatLaySheet,
} from "./closet-flat-lay-client";
import { roleFromCutoutHints, suggestedClosetName, type CutoutSilhouetteHint } from "./closet-roles";
import { closetRemainingSlots, hydrateCloset, loadCloset } from "./closet-store";
import {
  CLOSET_FREE_CAP,
  type ClosetFlatLayStatus,
  type ClosetRole,
  type ColorId,
} from "./types";

export const CUTOUT_QUEUE_KEY = "atelier.closetCutoutQueue.v1";
export const CUTOUT_BATCH_HARD_MAX = 10;

const IDB_NAME = "atelier-closet-cutout-v1";
const IDB_STORE = "jobs";
const EVENT = "atelier:closet-cutout-queue";

export type CutoutQueueStatus = "queued" | "processing" | "ready" | "error" | "saved" | "discarded";

export type CutoutQueueJob = {
  id: string;
  fileName: string;
  fileHint: string;
  status: CutoutQueueStatus;
  error?: string;
  cornersBusy?: boolean;
  dominantColor?: ColorId | "other";
  /** Draft fields for one-by-one confirm (editable). */
  name?: string;
  role?: ClosetRole;
  color?: ColorId | "other";
  nameTouched?: boolean;
  createdAt: number;
  /** Vision outfit-split already attempted (success or soft-fail). */
  splitChecked?: boolean;
  /** This job is a crop from a multi-garment outfit photo — skip re-detect. */
  fromSplit?: boolean;
  /** Parent outfit job id when fromSplit. */
  splitParentId?: string;
  /** Generative flat-lay status for confirm (ready only when gpt-image succeeded). */
  flatLayStatus?: ClosetFlatLayStatus;
};

type QueueState = { jobs: CutoutQueueJob[] };

type JobBlobs = {
  source: Blob;
  /** Confirm + save tile — generative flat-lay when polish succeeded. */
  cutoutDataUrl?: string;
  /** Optional rembg/internal ref only — never shown as confirm when polish ready. */
  rawCutoutDataUrl?: string;
};

/** Session-scoped blob store when IndexedDB put/open fails (e.g. Safari Private). */
const blobMemory = new Map<string, JobBlobs>();
let blobsUsingMemoryOnly = false;

let memory: QueueState | null = null;
let pumping = false;
let started = false;

/** True after any successful memory fallback for job blobs this session. */
export function closetBlobsUsingMemoryOnly(): boolean {
  return blobsUsingMemoryOnly;
}

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

function emptyState(): QueueState {
  return { jobs: [] };
}

function readState(): QueueState {
  if (typeof window === "undefined") return emptyState();
  if (memory) return memory;
  try {
    const raw = window.localStorage.getItem(CUTOUT_QUEUE_KEY);
    if (!raw) {
      memory = emptyState();
      return memory;
    }
    const parsed = JSON.parse(raw) as QueueState;
    memory = {
      jobs: Array.isArray(parsed?.jobs)
        ? parsed.jobs.filter((j) => j && typeof j.id === "string" && typeof j.status === "string")
        : [],
    };
    return memory;
  } catch {
    memory = emptyState();
    return memory;
  }
}

function writeState(next: QueueState) {
  memory = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUTOUT_QUEUE_KEY, JSON.stringify(next));
  } catch {
    // Quota — keep memory copy so the in-session worker can continue.
  }
  emit();
}

function openDb(): Promise<IDBDatabase> {
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

async function idbPut(id: string, value: JobBlobs): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IDB put failed"));
    });
  } finally {
    db.close();
  }
}

async function idbGet(id: string): Promise<JobBlobs | undefined> {
  const db = await openDb();
  try {
    return await new Promise<JobBlobs | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve(req.result as JobBlobs | undefined);
      req.onerror = () => reject(req.error ?? new Error("IDB get failed"));
    });
  } finally {
    db.close();
  }
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
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

/** Try IDB put; on any failure, keep blobs in session memory and succeed. */
async function putBlobs(id: string, value: JobBlobs): Promise<void> {
  try {
    await idbPut(id, value);
    blobMemory.set(id, value);
  } catch {
    blobMemory.set(id, value);
    blobsUsingMemoryOnly = true;
  }
}

/** Memory first, then IndexedDB. */
async function getBlobs(id: string): Promise<JobBlobs | undefined> {
  const cached = blobMemory.get(id);
  if (cached) return cached;
  try {
    const fromIdb = await idbGet(id);
    if (fromIdb) blobMemory.set(id, fromIdb);
    return fromIdb;
  } catch {
    return undefined;
  }
}

/** Clear both memory and IndexedDB. */
async function deleteBlobs(id: string): Promise<void> {
  blobMemory.delete(id);
  try {
    await idbDelete(id);
  } catch {
    /* ignore */
  }
}

function stemHint(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return stem && stem.toLowerCase() !== "image" ? stem : "";
}

/** Jobs that still need cutout work or user confirm (count against free slots). */
export function activeQueueJobs(jobs = getCutoutQueue()): CutoutQueueJob[] {
  return jobs.filter((j) => j.status === "queued" || j.status === "processing" || j.status === "ready");
}

export function getCutoutQueue(): CutoutQueueJob[] {
  return readState().jobs;
}

export function subscribeCutoutQueue(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function cutoutQueueStats(jobs = getCutoutQueue()) {
  const active = activeQueueJobs(jobs);
  const queued = jobs.filter((j) => j.status === "queued").length;
  const processing = jobs.filter((j) => j.status === "processing").length;
  const ready = jobs.filter((j) => j.status === "ready").length;
  const error = jobs.filter((j) => j.status === "error").length;
  const saved = jobs.filter((j) => j.status === "saved").length;
  // Keep saved in the batch denominator so "Cutting 3 of 8" stays stable while user confirms early ready items.
  const batch = jobs.filter((j) => j.status !== "discarded");
  const totalWork = batch.length;
  const doneCutouts = jobs.filter((j) => j.status === "ready" || j.status === "saved" || j.status === "error").length;
  const cutProgressIndex = Math.min(doneCutouts + (processing ? 1 : 0), Math.max(totalWork, 1));
  return {
    active: active.length,
    queued,
    processing,
    ready,
    error,
    saved,
    totalWork,
    /** 1-based index for "Cutting 3 of 8…" */
    cuttingOf: totalWork > 0 && (queued > 0 || processing > 0) ? cutProgressIndex : 0,
    cuttingTotal: totalWork,
    isCutting: queued > 0 || processing > 0,
    hasReady: ready > 0,
  };
}

/** How many new photos may still be enqueued (closet remaining − already in-flight). */
export function cutoutEnqueueBudget(closetCount?: number): number {
  if (typeof window === "undefined") return 0;
  const items = closetCount == null ? loadCloset() : undefined;
  const remaining = closetCount == null ? closetRemainingSlots(items) : Math.max(0, CLOSET_FREE_CAP - closetCount);
  const inFlight = activeQueueJobs().length;
  return Math.max(0, Math.min(CUTOUT_BATCH_HARD_MAX, remaining - inFlight));
}


const NORMALIZE_MAX_EDGE = 1600;
const READ_PHOTO_ERROR = "Couldn’t read that photo — try JPEG or PNG.";

/** Decode (incl. iOS HEIC) → JPEG File so ML/canvas/IDB always get a browser-friendly blob. */
async function normalizeSourceFile(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(READ_PHOTO_ERROR);
  }
  try {
    const scale = Math.min(1, NORMALIZE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(READ_PHOTO_ERROR);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error(READ_PHOTO_ERROR))),
        "image/jpeg",
        0.92
      );
    });
    const base = (file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

export async function enqueueCutoutFiles(files: File[]): Promise<{ enqueued: number; skipped: number }> {
  if (typeof window === "undefined") return { enqueued: 0, skipped: files.length };
  hydrateCloset();
  const budget = cutoutEnqueueBudget();
  const accepted = files.slice(0, budget);
  const skipped = files.length - accepted.length;
  if (!accepted.length) return { enqueued: 0, skipped };

  const state = readState();
  const added: CutoutQueueJob[] = [];
  let lastError = "";
  for (const file of accepted) {
    const id = `cut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      // Normalize HEIC/HEIF (and any decodable image) to JPEG so cutout/ML never see HEIC.
      const source = await normalizeSourceFile(file);
      const displayName = source.name || file.name || "photo.jpg";
      const job: CutoutQueueJob = {
        id,
        fileName: displayName,
        fileHint: stemHint(file.name || displayName),
        status: "queued",
        role: "other",
        color: "other",
        nameTouched: false,
        createdAt: Date.now(),
      };
      await putBlobs(id, { source });
      added.push(job);
    } catch (err) {
      lastError =
        err instanceof Error && err.message ? err.message : READ_PHOTO_ERROR;
      // Do not write a queued job without a successful putBlobs — avoids half-enqueued ghosts.
    }
  }
  if (added.length) {
    writeState({ jobs: [...state.jobs, ...added] });
    void pumpCutoutQueue();
  }
  if (!added.length && lastError) {
    throw new Error(lastError);
  }
  return { enqueued: added.length, skipped: skipped + (accepted.length - added.length) };
}

export function updateCutoutJob(id: string, patch: Partial<Omit<CutoutQueueJob, "id" | "createdAt">>) {
  const state = readState();
  const jobs = state.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job));
  writeState({ jobs });
}

const CUTOUT_EXPIRED = "Cutout expired — re-add the photo";

export type CutoutPreviewResult = {
  url: string;
  /** ok = have url; requeued = source present, cutout re-running; expired = both gone; missing = not ready yet */
  status: "ok" | "requeued" | "expired" | "missing";
  error?: string;
};

/**
 * Return cutout data URL, or heal orphan `ready` jobs whose IDB/session blobs vanished
 * (Safari Private, tab kill). Re-queues when source remains; errors when both are gone.
 */
export async function ensureCutoutPreview(id: string): Promise<CutoutPreviewResult> {
  const job = getCutoutQueue().find((j) => j.id === id);
  if (!job) return { url: "", status: "missing", error: "Job not found" };

  const blobs = await getBlobs(id);
  if (blobs?.cutoutDataUrl) return { url: blobs.cutoutDataUrl, status: "ok" };

  if (job.status === "ready") {
    if (blobs?.source) {
      updateCutoutJob(id, { status: "queued", error: undefined });
      void pumpCutoutQueue();
      return { url: "", status: "requeued" };
    }
    updateCutoutJob(id, { status: "error", error: CUTOUT_EXPIRED });
    return { url: "", status: "expired", error: CUTOUT_EXPIRED };
  }

  return { url: "", status: "missing" };
}

/** Preview URL only — heals orphan ready jobs (re-queue or error) instead of returning "" forever. */
export async function getCutoutJobPreview(id: string): Promise<string> {
  const result = await ensureCutoutPreview(id);
  return result.url;
}

/** Optional rembg/internal ref — never used as confirm preview when polish succeeded. */
export async function getCutoutJobRaw(id: string): Promise<string | undefined> {
  const blobs = await getBlobs(id);
  return blobs?.rawCutoutDataUrl;
}

/** On worker start: ready meta without cutout blob → re-queue or expire. */
async function healOrphanReadyJobs() {
  const jobs = getCutoutQueue();
  for (const job of jobs) {
    if (job.status !== "ready") continue;
    const blobs = await getBlobs(job.id);
    if (blobs?.cutoutDataUrl) continue;
    if (blobs?.source) {
      updateCutoutJob(job.id, { status: "queued", error: undefined });
    } else {
      updateCutoutJob(job.id, { status: "error", error: CUTOUT_EXPIRED });
    }
  }
}

export async function discardCutoutJob(id: string) {
  updateCutoutJob(id, { status: "discarded" });
  await deleteBlobs(id);
  pruneTerminalJobs();
}

/** Re-run cutout/polish for a failed job when source blob still exists. */
export async function requeueCutoutJob(id: string): Promise<boolean> {
  const job = getCutoutQueue().find((j) => j.id === id);
  if (!job) return false;
  const blobs = await getBlobs(id);
  if (!blobs?.source) return false;
  updateCutoutJob(id, {
    status: "queued",
    error: undefined,
    flatLayStatus: undefined,
    // Crops keep splitChecked; whole photos may re-detect.
    splitChecked: job.fromSplit ? true : false,
  });
  void pumpCutoutQueue();
  return true;
}

export async function markCutoutJobSaved(id: string) {
  updateCutoutJob(id, { status: "saved" });
  await deleteBlobs(id);
  // Hold saved rows until the batch is idle so progress copy stays stable.
  const jobs = getCutoutQueue();
  if (!jobs.some((j) => j.status === "queued" || j.status === "processing" || j.status === "ready")) {
    pruneTerminalJobs();
  }
}

function pruneTerminalJobs() {
  const state = readState();
  const live = state.jobs.filter(
    (j) => j.status === "queued" || j.status === "processing" || j.status === "ready"
  );
  if (live.length) return;
  const errors = state.jobs.filter((j) => j.status === "error").slice(-3);
  const next = errors;
  if (next.length !== state.jobs.length) writeState({ jobs: next });
}

export function firstReadyCutoutJob(jobs = getCutoutQueue()): CutoutQueueJob | null {
  return jobs.find((j) => j.status === "ready") ?? null;
}

/** Start the background sequential worker (idempotent). Call from ClosetPersist. */
export function startCutoutQueueWorker() {
  if (typeof window === "undefined" || started) return;
  started = true;
  // Resume any stuck "processing" after a refresh.
  const state = readState();
  const fixed = state.jobs.map((job) => (job.status === "processing" ? { ...job, status: "queued" as const } : job));
  if (fixed.some((j, i) => j.status !== state.jobs[i].status)) writeState({ jobs: fixed });
  // Heal orphan ready (localStorage ready, IndexedDB/session cutout gone).
  void healOrphanReadyJobs().then(() => {
    void pumpCutoutQueue();
  });
  subscribeCutoutQueue(() => {
    void pumpCutoutQueue();
  });
}

/**
 * How many piece jobs we may create when replacing one outfit photo.
 * Reclaims the current processing job’s slot.
 */
function splitPieceBudget(currentJobId: string): number {
  hydrateCloset();
  const remaining = closetRemainingSlots();
  const otherActive = activeQueueJobs().filter((j) => j.id !== currentJobId).length;
  return Math.max(1, Math.min(CUTOUT_BATCH_HARD_MAX, remaining - otherActive));
}

function pieceFileName(parentName: string, piece: DetectedGarmentPiece, index: number): string {
  const stem = (parentName || "photo").replace(/\.jpg$/i, "").replace(/\.jpeg$/i, "");
  const slug = (piece.label || piece.role || `piece-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${stem}-${slug || `piece-${index + 1}`}.jpg`;
}

/**
 * Vision detect → crop ≥2 garments into separate queue jobs.
 * Returns true when the parent was handled (replaced with pieces OR errored) —
 * caller must NOT rembg whole-person afterward.
 * Soft-fail to rembg whole ONLY when detect errors or returns <2 garments
 * (single product shots may stay 1 rembg). When detect returns ≥2, never ship whole-person.
 */
async function trySplitOutfitIntoJobs(
  parent: CutoutQueueJob,
  source: Blob
): Promise<boolean> {
  if (parent.fromSplit || parent.splitChecked) return false;

  let detected;
  try {
    detected = await requestDetectGarments(source);
  } catch {
    updateCutoutJob(parent.id, { splitChecked: true });
    return false;
  }

  if (!shouldSplitOutfit(detected)) {
    const patch: Partial<Omit<CutoutQueueJob, "id" | "createdAt">> = { splitChecked: true };
    if (detected.ok && detected.garments.length === 1) {
      const g = detected.garments[0]!;
      if (!parent.nameTouched) {
        patch.role = g.role !== "other" ? g.role : parent.role;
        patch.color = g.colorHint !== "other" ? g.colorHint : parent.color;
        patch.fileHint = g.label || parent.fileHint;
        patch.name = g.label || parent.name;
      }
    }
    updateCutoutJob(parent.id, patch);
    return false;
  }

  const slotBudget = splitPieceBudget(parent.id);
  // Sheet path burns ONE polish unit for the whole outfit (not N).
  let polishRemaining = 0;
  try {
    const snap = await fetchClosetFlatLayBudget();
    if (!snap.providerAvailable) {
      updateCutoutJob(parent.id, {
        splitChecked: true,
        status: "error",
        error: "Closet polish isn’t available right now. Try again in a bit.",
        flatLayStatus: "skipped",
      });
      return true;
    }
    if (snap.polish.exhausted || snap.polish.remaining <= 0) {
      updateCutoutJob(parent.id, {
        splitChecked: true,
        status: "error",
        error: POLISH_BUDGET_EXHAUSTED_MSG,
        flatLayStatus: "skipped",
      });
      return true;
    }
    polishRemaining = snap.polish.remaining;
  } catch {
    updateCutoutJob(parent.id, {
      splitChecked: true,
      status: "error",
      error: "Couldn’t check polish budget. Try again.",
      flatLayStatus: "failed",
    });
    return true;
  }

  if (polishRemaining < 1 || slotBudget < 1) {
    updateCutoutJob(parent.id, {
      splitChecked: true,
      status: "error",
      error:
        polishRemaining < 1
          ? POLISH_BUDGET_EXHAUSTED_MSG
          : "Couldn't split that outfit into separate pieces. Free a closet slot or try a clearer shot.",
      flatLayStatus: polishRemaining < 1 ? "skipped" : "failed",
    });
    return true;
  }

  const pieceCap = Math.min(slotBudget, detected.garments.length, 8);
  const pieces = detected.garments.slice(0, pieceCap);
  if (pieces.length < 2) {
    // Closet nearly full — keep best single piece crop rather than whole-body.
    const g = detected.garments[0]!;
    try {
      const crop = await cropGarmentBlob(source, g.box);
      const file = new File([crop], pieceFileName(parent.fileName, g, 0), {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      await putBlobs(parent.id, { source: file });
      updateCutoutJob(parent.id, {
        splitChecked: true,
        fromSplit: true,
        fileName: file.name,
        fileHint: g.label || parent.fileHint,
        role: g.role !== "other" ? g.role : "other",
        color: g.colorHint !== "other" ? g.colorHint : parent.color,
        name: parent.nameTouched ? parent.name : g.label || parent.name,
      });
      return false; // rembg+tile polish the crop (not whole person)
    } catch {
      updateCutoutJob(parent.id, {
        splitChecked: true,
        status: "error",
        error:
          "Couldn't split that outfit into separate pieces. Free a closet slot or try a clearer shot.",
      });
      return true;
    }
  }

  // Architecture lock: ONE gpt-image multi-item sheet → slice tiles (not per-crop regenerate).
  let sheetImageDataUrl: string;
  try {
    sheetImageDataUrl = await blobToDetectDataUrl(source, 1536);
  } catch {
    updateCutoutJob(parent.id, {
      splitChecked: true,
      status: "error",
      error: "Couldn't read that outfit photo for flat-lay. Try JPEG or PNG.",
      flatLayStatus: "failed",
    });
    return true;
  }

  const sheet = await requestClosetFlatLaySheet({
    imageDataUrl: sheetImageDataUrl,
    items: pieces.map((p) => ({
      role: p.role,
      label: p.label,
      colorHint: p.colorHint,
    })),
  });

  if (!sheet.ok || sheet.tiles.length < 2) {
    updateCutoutJob(parent.id, {
      splitChecked: true,
      status: "error",
      error:
        sheet.ok === false &&
        (sheet.flatLayStatus === "skipped" || sheet.code === "budget_exhausted")
          ? sheet.error || POLISH_BUDGET_EXHAUSTED_MSG
          : sheet.ok === false
            ? sheet.error ||
              "Couldn't polish that outfit into a flat-lay sheet. Try a clearer full-body shot."
            : "Couldn't slice that outfit sheet into separate pieces. Try a clearer shot.",
      flatLayStatus: sheet.ok === false ? sheet.flatLayStatus : "failed",
    });
    return true; // handled — NEVER soft-fail to whole-person rembg; never per-crop regenerate as primary
  }

  const added: CutoutQueueJob[] = [];
  for (let i = 0; i < sheet.tiles.length; i++) {
    const tile = sheet.tiles[i]!;
    const role: ClosetRole =
      typeof tile.role === "string" && tile.role !== "other"
        ? (tile.role as ClosetRole)
        : pieces[i]?.role && pieces[i]!.role !== "other"
          ? pieces[i]!.role
          : "other";
    const color: ColorId | "other" =
      tile.colorHint && tile.colorHint !== "other"
        ? (tile.colorHint as ColorId | "other")
        : pieces[i]?.colorHint && pieces[i]!.colorHint !== "other"
          ? pieces[i]!.colorHint
          : "other";
    const label =
      (typeof tile.label === "string" && tile.label.trim()) ||
      pieces[i]?.label ||
      suggestedClosetName(color === "other" ? "other" : color, role === "other" ? "top" : role);
    const id = `cut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fileName = pieceFileName(parent.fileName, { role, label, colorHint: color, box: pieces[i]?.box || { x: 0, y: 0, w: 1, h: 1 } }, i);
    const job: CutoutQueueJob = {
      id,
      fileName,
      fileHint: label,
      status: "ready",
      role,
      color,
      name: label,
      nameTouched: false,
      createdAt: Date.now(),
      splitChecked: true,
      fromSplit: true,
      splitParentId: parent.id,
      flatLayStatus: "ready",
      cornersBusy: false,
      dominantColor: color,
    };
    // Persist sliced sheet tile as the confirm/save cutout (already generative flat-lay).
    const tileBlob = await (await fetch(tile.polishedDataUrl)).blob();
    await putBlobs(id, {
      source: tileBlob,
      cutoutDataUrl: tile.polishedDataUrl,
    });
    added.push(job);
  }

  if (added.length < 2) {
    for (const job of added) {
      await deleteBlobs(job.id);
    }
    updateCutoutJob(parent.id, {
      splitChecked: true,
      status: "error",
      error:
        "Couldn't split that outfit into separate pieces. Try a clearer full-body shot with items visible.",
      flatLayStatus: "failed",
    });
    return true; // handled — pump must not rembg whole person
  }

  // Replace parent: never leave whole-body as a closet piece when sheet split worked.
  await deleteBlobs(parent.id);
  const withoutParent = readState().jobs.filter((j) => j.id !== parent.id);
  writeState({ jobs: [...withoutParent, ...added] });
  return true;
}

async function pumpCutoutQueue() {
  if (typeof window === "undefined" || pumping) return;
  pumping = true;
  try {
    while (true) {
      const next = getCutoutQueue().find((j) => j.status === "queued");
      if (!next) break;
      updateCutoutJob(next.id, { status: "processing" });
      try {
        const blobs = await getBlobs(next.id);
        if (!blobs?.source) throw new Error("Missing source image");

        // Outfit split BEFORE rembg — never rembg whole person into one piece when ≥2 garments.
        const splitAway = await trySplitOutfitIntoJobs(next, blobs.source);
        if (splitAway) {
          // Parent replaced with piece jobs, or errored (multi-item split failed) — do not rembg whole.
          continue;
        }

        // Re-read job/source in case single-piece crop + vision hints replaced them.
        const livePre = getCutoutQueue().find((j) => j.id === next.id) ?? next;
        const sourceBlobs = await getBlobs(next.id);
        const source = sourceBlobs?.source ?? blobs.source;

        // Optional rembg as polish *input* only. Outfit-split crops skip bottoms refine
        // (waist mash). Confirm never shows rembg — gpt-image flat-lay owns the tile.
        let rawCutoutDataUrl: string | undefined;
        let rembgWidth = 0;
        let rembgHeight = 0;
        let rembgSilhouette: CutoutSilhouetteHint = "unknown";
        let cornersBusy = false;
        let dominantColor: ColorId | "other" = livePre.color && livePre.color !== "other" ? livePre.color : "other";

        try {
          const result = await cutoutPhoto(source, {
            fileHint: livePre.fileHint,
            roleHint: livePre.role,
            skipRefineBottoms: Boolean(livePre.fromSplit),
          });
          rawCutoutDataUrl = result.dataUrl;
          rembgWidth = result.width;
          rembgHeight = result.height;
          rembgSilhouette = result.silhouette;
          cornersBusy = result.cornersBusy;
          dominantColor = result.dominantColor;
        } catch {
          // rembg optional — polish can use the crop / source directly.
        }

        const live = getCutoutQueue().find((j) => j.id === next.id) ?? livePre;
        const hinted: ClosetRole = roleFromCutoutHints(
          live.fileHint || "",
          rembgWidth,
          rembgHeight,
          live.role && live.role !== "other" ? live.role : "other",
          rembgSilhouette
        );
        const role: ClosetRole =
          live.role && live.role !== "other"
            ? live.role
            : hinted === "other"
              ? "top"
              : hinted;
        const color: ColorId | "other" =
          live.color && live.color !== "other" ? live.color : dominantColor;
        const suggested =
          live.fromSplit && live.name && !live.nameTouched
            ? live.name
            : suggestedClosetName(color, role);

        // Budget gate before polish — never present rembg as the confirm piece.
        const budgetSnap = await fetchClosetFlatLayBudget();
        if (!budgetSnap.providerAvailable) {
          updateCutoutJob(next.id, {
            status: "error",
            error: "Closet polish isn’t available right now. Try again in a bit.",
            flatLayStatus: "skipped",
            role,
            color,
            name: live.nameTouched ? live.name : suggested || live.fileHint || live.name,
            nameTouched: live.nameTouched ?? false,
            splitChecked: true,
          });
          continue;
        }
        if (budgetSnap.polish.exhausted || budgetSnap.polish.remaining <= 0) {
          updateCutoutJob(next.id, {
            status: "error",
            error: POLISH_BUDGET_EXHAUSTED_MSG,
            flatLayStatus: "skipped",
            role,
            color,
            name: live.nameTouched ? live.name : suggested || live.fileHint || live.name,
            nameTouched: live.nameTouched ?? false,
            splitChecked: true,
          });
          continue;
        }

        // Prefer rembg plate when available; else crop/source JPEG for gpt-image.
        const polishInput =
          rawCutoutDataUrl && rawCutoutDataUrl.startsWith("data:image/")
            ? rawCutoutDataUrl
            : await blobToDataUrl(source);

        const labelForPolish = `${live.name || ""} ${live.fileHint || ""}`.toLowerCase();
        let polishRole: ClosetRole | string = role;
        if (/fedora|hat|beanie|cap|scrunchie|belt/.test(labelForPolish)) polishRole = "accessory";
        else if (/boot|shoe|sandal|sneaker/.test(labelForPolish)) polishRole = "shoes";
        else if (/dress|romper/.test(labelForPolish)) polishRole = "dress";

        const polish = await requestClosetFlatLayPolish({
          imageDataUrl: polishInput,
          roleHint: polishRole,
          colorHint: color,
          labelHint: live.name || live.fileHint || undefined,
        });

        if (!polish.ok) {
          updateCutoutJob(next.id, {
            status: "error",
            error:
              polish.flatLayStatus === "skipped" || polish.code === "budget_exhausted"
                ? polish.error || POLISH_BUDGET_EXHAUSTED_MSG
                : polish.error || POLISH_FAILED_MSG,
            flatLayStatus: polish.flatLayStatus,
            role,
            color,
            name: live.nameTouched ? live.name : suggested || live.fileHint || live.name,
            nameTouched: live.nameTouched ?? false,
            splitChecked: true,
          });
          continue;
        }

        await putBlobs(next.id, {
          source,
          cutoutDataUrl: polish.polishedDataUrl,
          rawCutoutDataUrl,
        });
        updateCutoutJob(next.id, {
          status: "ready",
          cornersBusy,
          dominantColor: color,
          color,
          role,
          name: live.nameTouched ? live.name : suggested || live.fileHint || live.name,
          nameTouched: live.nameTouched ?? false,
          splitChecked: true,
          flatLayStatus: "ready",
        });
      } catch (err) {
        const raw = err instanceof Error ? err.message : "";
        const message =
          /Couldn’t read that photo/i.test(raw)
            ? raw
            : /Missing source/i.test(raw)
              ? CUTOUT_EXPIRED
              : "We couldn’t polish that piece. Skip and retry, or try a clearer shot.";
        updateCutoutJob(next.id, {
          status: "error",
          error: message,
        });
      }
    }
  } finally {
    pumping = false;
  }
  // Enqueue may have landed while the last job finished — pick up without waiting for another event.
  if (getCutoutQueue().some((j) => j.status === "queued")) {
    void pumpCutoutQueue();
  }
}

export const CUTOUT_WAIT_COPY =
  "Detecting pieces and polishing one flat-lay sheet… you can keep styling while your closet loads.";

export const POLISH_FAILED_MSG =
  "Couldn't polish that piece into a flat tile. Skip and try a clearer crop, or retry.";

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string" && result.startsWith("data:")) resolve(result);
      else reject(new Error("Could not read image"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}
