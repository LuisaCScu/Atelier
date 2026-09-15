/**
 * Photo → durable PNG cutout for closet tiles / Stylist collage.
 *
 * Primary path: client-side ML via `@imgly/background-removal` (WASM/ONNX in the
 * browser — dynamic import so Next SSR never loads it). Flood-fill against
 * sampled corner color in this file remains the fallback when ML fails.
 *
 * No server rembg / remove.bg / Stripe — cutouts never leave the device.
 * After either path: trim transparent + max 512px edge (same as before).
 */

import { COLOR_SWATCH } from "./catalog";
import type { CutoutSilhouetteHint } from "./closet-roles";
import type { ClosetRole, ColorId } from "./types";

const MAX_EDGE = 512;

export type CutoutMethod = "ml" | "flood";

export type CutoutHints = {
  fileHint?: string;
  roleHint?: ClosetRole;
  /** Outfit-split crops: never run waist/bottoms heuristic (causes waist mash). */
  skipRefineBottoms?: boolean;
};

export type CutoutResult = {
  dataUrl: string;
  method: CutoutMethod;
  /** Soft QA: corners still opaque after cutout — backdrop likely leaked. */
  cornersBusy: boolean;
  dominantColor: ColorId | "other";
  /** Trimmed bitmap size — used for role aspect heuristics. */
  width: number;
  height: number;
  /** Mask/aspect silhouette after crop — not garment vision. */
  silhouette: CutoutSilhouetteHint;
};

/** Convenience wrapper used by older call sites. */
export async function stripBackgroundToCutout(file: File | Blob): Promise<string> {
  const result = await cutoutPhoto(file);
  return result.dataUrl;
}

export async function cutoutPhoto(file: File | Blob, hints?: CutoutHints): Promise<CutoutResult> {
  try {
    const mlBlob = await removeBackgroundMl(file);
    const bitmap = await createImageBitmap(mlBlob);
    try {
      return encodeCutout(bitmap, "ml", { flood: false, hints });
    } finally {
      bitmap.close();
    }
  } catch {
    // ML unavailable / failed — fall through to flood-fill.
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Couldn’t read that photo — try JPEG or PNG.");
  }
  try {
    return encodeCutout(bitmap, "flood", { flood: true, hints });
  } finally {
    bitmap.close();
  }
}

/** Soft ceiling so a hung WASM/ONNX session falls through to flood-fill. */
const ML_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function removeBackgroundMl(file: File | Blob): Promise<Blob> {
  // Client-only dynamic import — never static so SSR / RSC stay clean.
  const { removeBackground } = await import("@imgly/background-removal");
  const work = removeBackground(file, {
    model: "isnet_fp16",
    output: { format: "image/png", quality: 0.9 },
  });
  return withTimeout(work, ML_TIMEOUT_MS, "ML cutout timed out");
}

function encodeCutout(
  bitmap: ImageBitmap,
  method: CutoutMethod,
  opts: { flood: boolean; hints?: CutoutHints }
): CutoutResult {
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  if (opts.flood && !alreadyCutout(image)) {
    floodClearBackdrop(image);
    softenEdges(image);
  }
  let trimmed = trimTransparent(image, 8);
  stripCornerIslands(trimmed);
  let silhouette: CutoutSilhouetteHint = "unknown";
  if (opts.hints?.skipRefineBottoms) {
    // Vision already boxed this piece — bottoms waist heuristic mangles dresses/belts.
    silhouette = hintsSayDress(opts.hints) ? "dress" : hintsSayBottom(opts.hints) ? "bottom" : "unknown";
  } else {
    const refined = refineBottomsCrop(trimmed, opts.hints);
    trimmed = refined.image;
    silhouette = refined.silhouette;
  }
  const cornersBusy = cornersLookBusy(trimmed);
  const dominantColor = dominantFromImage(trimmed);
  canvas.width = trimmed.width;
  canvas.height = trimmed.height;
  ctx.putImageData(trimmed, 0, 0);
  return {
    dataUrl: canvas.toDataURL("image/png"),
    method,
    cornersBusy,
    dominantColor,
    width: trimmed.width,
    height: trimmed.height,
    silhouette,
  };
}

/**
 * TODO(classifyCutoutVision): after cutout, optionally call a small on-device or
 * API vision classifier for { role, color } — RGB nearest + aspect heuristics
 * cannot reliably "see" a green dress. Hook signature sketch:
 *   async function classifyCutoutVision(cutoutDataUrl: string): Promise<{
 *     role?: ClosetRole; color?: ColorId | "other"; confidence?: number;
 *   }>
 * Wire from pumpCutoutQueue when available; keep heuristics as fallback.
 */

/** Re-sample a stored cutout data URL (e.g. edit flow). */
export async function sampleDominantClosetColor(dataUrl: string): Promise<ColorId | "other"> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return "other";
      ctx.drawImage(bitmap, 0, 0);
      return dominantFromImage(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } finally {
      bitmap.close();
    }
  } catch {
    return "other";
  }
}

export async function cornersLookBusyFromDataUrl(dataUrl: string): Promise<boolean> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return false;
      ctx.drawImage(bitmap, 0, 0);
      return cornersLookBusy(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } finally {
      bitmap.close();
    }
  } catch {
    return false;
  }
}

/**
 * Sample garment color from opaque cutout pixels.
 * Heuristic only — not vision. Mean RGB was pulled toward chocolate by dark
 * low-sat shadows / floor / skin; median of opaque pixels + dropping near-black
 * low-chroma samples resists that bias. Still can misread prints/lighting.
 */
function dominantFromImage(image: ImageData): ColorId | "other" {
  const { data } = image;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  // Stride sampling for speed on large cutouts
  const stride = Math.max(4, Math.floor(data.length / 4 / 8000) * 4);
  for (let i = 0; i < data.length; i += stride) {
    if (data[i + 3] < 180) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const L = rgbLum(r, g, b);
    const sat = rgbSat(r, g, b);
    // Near-black / shadow pixels bias averages toward chocolate — skip them.
    if (L < 28) continue;
    if (L < 42 && sat < 0.2) continue;
    rs.push(r);
    gs.push(g);
    bs.push(b);
  }
  if (rs.length < 24) return "other";
  const spread = hueChromaSpread(rs, gs, bs);
  const median = (vals: number[]) => {
    const s = vals.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  };
  return nearestColorId(median(rs), median(gs), median(bs), spread);
}

function cornersLookBusy(image: ImageData): boolean {
  const { data, width, height } = image;
  const patch = Math.max(4, Math.min(12, Math.floor(Math.min(width, height) / 16)));
  const patches: [number, number][] = [
    [0, 0],
    [width - patch, 0],
    [0, height - patch],
    [width - patch, height - patch],
  ];
  let opaque = 0;
  let total = 0;
  for (const [sx, sy] of patches) {
    for (let y = sy; y < sy + patch && y < height; y++) {
      for (let x = sx; x < sx + patch && x < width; x++) {
        total += 1;
        if (data[(y * width + x) * 4 + 3] > 40) opaque += 1;
      }
    }
  }
  return total > 0 && opaque / total > 0.35;
}

function swatchRgb(id: ColorId): { r: number; g: number; b: number } {
  const hex = COLOR_SWATCH[id];
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbSat(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 8) return 0;
  return (max - min) / max;
}

function rgbLum(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgbHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 4) return -1;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

/**
 * High chroma variance / 2+ far hue families → multicolor print (zigzag).
 * Solid garments with lighting stay one family. Exported for verify-closet.
 */
export function hueChromaSpread(
  rs: number[],
  gs: number[],
  bs: number[]
): { hueSpread: number; chromaVar: number; multiHue: boolean } {
  const bins = new Array(12).fill(0) as number[];
  let chromatic = 0;
  let varAcc = 0;
  let nVar = 0;
  const meanR = rs.reduce((a, v) => a + v, 0) / Math.max(1, rs.length);
  const meanG = gs.reduce((a, v) => a + v, 0) / Math.max(1, gs.length);
  const meanB = bs.reduce((a, v) => a + v, 0) / Math.max(1, bs.length);
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]!;
    const g = gs[i]!;
    const b = bs[i]!;
    varAcc += (r - meanR) ** 2 + (g - meanG) ** 2 + (b - meanB) ** 2;
    nVar += 1;
    const sat = rgbSat(r, g, b);
    const L = rgbLum(r, g, b);
    if (sat < 0.2 || L < 32 || L > 235) continue;
    const hue = rgbHue(r, g, b);
    if (hue < 0) continue;
    bins[Math.floor(hue / 30) % 12] += 1;
    chromatic += 1;
  }
  const chromaVar = nVar ? varAcc / nVar : 0;
  if (chromatic < 36) {
    return { hueSpread: 0, chromaVar, multiHue: false };
  }
  const strongIdx: number[] = [];
  for (let i = 0; i < 12; i++) {
    if (bins[i]! / chromatic >= 0.12) strongIdx.push(i);
  }
  let farPairs = 0;
  let maxBinDist = 0;
  for (let a = 0; a < strongIdx.length; a++) {
    for (let b = a + 1; b < strongIdx.length; b++) {
      const d = Math.min(
        Math.abs(strongIdx[a]! - strongIdx[b]!),
        12 - Math.abs(strongIdx[a]! - strongIdx[b]!)
      );
      if (d > maxBinDist) maxBinDist = d;
      if (d >= 2) farPairs += 1;
    }
  }
  const hueSpread = maxBinDist * 30;
  const multiHue = farPairs >= 1 && strongIdx.length >= 2 && (hueSpread >= 60 || chromaVar >= 1400);
  return { hueSpread, chromaVar, multiHue };
}

const CHROMATIC_HUES: ColorId[] = ["red", "pink", "peach", "burgundy", "blue", "green"];
const NEUTRAL_IDS: ColorId[] = [
  "white",
  "cream",
  "grey",
  "black",
  "charcoal",
  "stone",
  "sand",
  "camel",
  "chocolate",
];

/**
 * Map sampled RGB → closet ColorId (shade-specific names). Heuristic only —
 * does NOT classify garments. When the sample set has high chroma variance /
 * multiple far-apart hues (zigzag, print), return `multi` instead of the
 * median dye (Missoni zigzags median as a muddy mix). Prefer peach over
 * pink/red for warm apricot; rust/wine → burgundy; chocolate only when dark
 * brown. Greenish samples must land green/olive, never chocolate.
 */
export function nearestColorId(
  r: number,
  g: number,
  b: number,
  spread?: { hueSpread: number; chromaVar: number; multiHue: boolean }
): ColorId | "other" {
  if (spread?.multiHue || (spread && spread.hueSpread >= 48 && spread.chromaVar >= 900)) {
    return "multi";
  }
  const sat = rgbSat(r, g, b);
  const L = rgbLum(r, g, b);
  const warm = r - b;
  const redish = r > g + 12 && r > b + 12 && warm > 20;
  const pinkish = r > 140 && b > g - 8 && r - g < 90 && sat > 0.12;
  // Warm apricot/coral — peach, not cool pink or tomato red.
  const peachy =
    r > 155 &&
    g > 105 &&
    g < r - 8 &&
    b < g + 25 &&
    warm > 35 &&
    L > 115 &&
    L < 205 &&
    sat > 0.14 &&
    sat < 0.55;
  // Muted dark warm reds — wine/rust → burgundy (keep true bright red separate).
  const winey =
    redish &&
    L < 85 &&
    sat > 0.15 &&
    sat < 0.55 &&
    g > b + 5 &&
    r - Math.max(g, b) < 90;
  const bluish = b > r + 10 && b >= g - 5;
  // Olive swatches are barely g>r; require g ahead of b and not red/brown-led.
  const greenish =
    g >= r - 2 &&
    g > b + 5 &&
    (g - Math.min(r, b) >= 8 || (g - b >= 10 && Math.abs(g - r) <= 22)) &&
    !(r > g + 12);

  // Green / olive hard-return before neutrals — lower sat than other chromatics
  // so muted leaf/khaki still wins over chocolate distance.
  if (greenish && sat > 0.1 && !redish) {
    if (sat > 0.2 && g > r + 12) return "green";
    if (L < 100 && sat < 0.34) return "olive";
    if (sat > 0.14) return L < 72 && sat < 0.28 ? "olive" : "green";
  }

  // Hard chromatic wins — don't let neutrals steal reds/pinks/peach.
  if (sat > 0.18) {
    if (peachy) return "peach";
    if (winey) return "burgundy";
    if (redish && L < 90 && (r - Math.max(g, b) > 40 || sat > 0.35)) {
      if (L < 58 && sat < 0.58) return "burgundy";
      // Mid muted rust (not high-chroma tomato) → burgundy
      if (L < 100 && sat < 0.48 && g > b + 12) return "burgundy";
      return "red";
    }
    if (pinkish && L > 110) {
      // Warm blush with yellow → peach; cooler rose → pink
      if (g > b + 12 && warm > 40 && sat < 0.5) return "peach";
      return "pink";
    }
    if (redish && L >= 90 && L <= 150 && sat > 0.18) {
      if (L > 125 && g > b + 15 && sat < 0.5) return "peach";
      return L > 130 ? "pink" : "red";
    }
    if (bluish && sat > 0.2) return L < 70 ? "navy" : "blue";
    if (greenish && sat > 0.14) return L < 75 && sat < 0.35 ? "olive" : "green";
  }

  let best: ColorId | "other" = "other";
  let bestDist = Infinity;
  for (const id of Object.keys(COLOR_SWATCH) as ColorId[]) {
    if (id === "multi") continue;
    const { r: cr, g: cg, b: cb } = swatchRgb(id);
    let dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;

    // Greenish samples: heavily penalize warm browns/creams that steal leaf tones.
    if (greenish) {
      if (id === "chocolate" || id === "camel" || id === "cream" || id === "sand") dist *= 3.2;
      if (id === "green") dist *= 0.4;
      if (id === "olive") dist *= 0.5;
    }

    if (sat > 0.2) {
      if (CHROMATIC_HUES.includes(id)) dist *= 0.5;
      if (NEUTRAL_IDS.includes(id) && id !== "chocolate") dist *= 1.85;
      // chocolate only if dark + warm; don't steal mid cream/peach
      if (id === "chocolate" && (L > 95 || sat > 0.4)) dist *= 2.0;
      if (id === "peach" && peachy) dist *= 0.55;
      if (id === "burgundy" && winey) dist *= 0.55;
      // Don't let generic pink steal peach samples
      if (id === "pink" && peachy) dist *= 1.8;
      if (id === "red" && (peachy || winey)) dist *= 1.6;
    } else {
      // Neutral / low-chroma: mid-brown ≠ chocolate if closer to cream
      if (id === "chocolate") {
        if (L > 110) dist *= 2.6;
        else if (L > 85) dist *= 1.7;
        else if (L > 70 && sat < 0.18) dist *= 1.25;
      }
      if ((id === "cream" || id === "camel" || id === "sand" || id === "stone") && L > 100 && sat < 0.28) {
        dist *= 0.72;
      }
      // Soft warm mid neutrals can still land peach when faintly chromatic
      if (id === "peach" && L > 120 && L < 190 && warm > 25 && sat > 0.1 && sat < 0.28) {
        dist *= 0.8;
      }
      // Don't let navy/blue steal dark greys when cool but unsaturated
      if ((id === "blue" || id === "green" || id === "red" || id === "pink" || id === "peach") && sat < 0.12) {
        dist *= 1.9;
      }
      // Soft greenish low-chroma → prefer olive over chocolate
      if (greenish && id === "olive") dist *= 0.65;
      if (greenish && id === "chocolate") dist *= 2.4;
    }

    if (dist < bestDist) {
      bestDist = dist;
      best = id;
    }
  }
  if (bestDist > 95 * 95) return "other";
  return best;
}

function alreadyCutout(image: ImageData): boolean {
  const { data, width, height } = image;
  let transparent = 0;
  const samples = 48;
  for (let i = 0; i < samples; i++) {
    const x = i % 2 === 0 ? 0 : width - 1;
    const y = Math.floor((i / samples) * height);
    if (data[(y * width + x) * 4 + 3] < 20) transparent += 1;
  }
  return transparent > samples * 0.45;
}

function sampleBackdrop(image: ImageData): [number, number, number] {
  const { data, width, height } = image;
  const patches = [
    [0, 0],
    [width - 8, 0],
    [0, height - 8],
    [width - 8, height - 8],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const [sx, sy] of patches) {
    for (let y = sy; y < sy + 8 && y < height; y++) {
      for (let x = sx; x < sx + 8 && x < width; x++) {
        const i = (y * width + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n += 1;
      }
    }
  }
  return [r / n, g / n, b / n];
}

function colorDist(r: number, g: number, b: number, bg: [number, number, number]): number {
  const dr = r - bg[0];
  const dg = g - bg[1];
  const db = b - bg[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function floodClearBackdrop(image: ImageData) {
  const { data, width, height } = image;
  const bg = sampleBackdrop(image);
  const threshold = 38;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    const dist = colorDist(data[i], data[i + 1], data[i + 2], bg);
    const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const lightEdge = luma > 232 && dist < 72;
    if (dist > threshold && !lightEdge) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queue.length) {
    const idx = queue.pop()!;
    const i = idx * 4;
    data[i + 3] = 0;
    const x = idx % width;
    const y = Math.floor(idx / width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }
}

function softenEdges(image: ImageData) {
  const { data, width, height } = image;
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      if (copy[i + 3] === 0) continue;
      let clear = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (copy[((y + dy) * width + (x + dx)) * 4 + 3] < 16) clear += 1;
        }
      }
      if (clear >= 3) data[i + 3] = Math.min(data[i + 3], Math.round(255 * (1 - clear / 12)));
    }
  }
}

type RowSpan = {
  count: number;
  minX: number;
  maxX: number;
  runs: number;
};

type SilhouetteStats = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  boxW: number;
  boxH: number;
  tall: number;
  wide: number;
  flared: boolean;
  legSplit: boolean;
  hasUpperPerson: boolean;
  hint: CutoutSilhouetteHint;
  rows: RowSpan[];
};

function measureSilhouette(image: ImageData): SilhouetteStats | null {
  const { data, width, height } = image;
  const rows: RowSpan[] = new Array(height);
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    let count = 0;
    let rowMin = width;
    let rowMax = 0;
    let runs = 0;
    let inRun = false;
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a < 18) {
        inRun = false;
        continue;
      }
      count += 1;
      if (x < rowMin) rowMin = x;
      if (x > rowMax) rowMax = x;
      if (!inRun) {
        runs += 1;
        inRun = true;
      }
    }
    rows[y] = { count, minX: rowMin, maxX: rowMax, runs };
    if (!count) continue;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (rowMin < minX) minX = rowMin;
    if (rowMax > maxX) maxX = rowMax;
  }
  if (maxX < minX || maxY < minY) return null;
  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  if (boxW < 12 || boxH < 16) return null;
  const tall = boxH / boxW;
  const wide = boxW / boxH;

  const meanSpan = (y0: number, y1: number) => {
    let sum = 0;
    let n = 0;
    const a = Math.max(minY, Math.floor(y0));
    const b = Math.min(maxY, Math.ceil(y1));
    for (let y = a; y <= b; y++) {
      const row = rows[y]!;
      if (!row.count) continue;
      sum += row.maxX - row.minX + 1;
      n += 1;
    }
    return n ? sum / n : 0;
  };

  const lowerSpan = meanSpan(minY + boxH * 0.58, maxY);
  const midSpan = meanSpan(minY + boxH * 0.34, minY + boxH * 0.55);
  const upperSpan = meanSpan(minY, minY + boxH * 0.26);
  const flared = lowerSpan > 8 && midSpan > 8 && lowerSpan > midSpan * 1.12;

  let splitRows = 0;
  const splitFrom = minY + Math.floor(boxH * 0.58);
  for (let y = splitFrom; y <= maxY; y++) {
    const row = rows[y]!;
    if (row.runs >= 2 && row.count > 6) splitRows += 1;
  }
  const splitBand = Math.max(1, maxY - splitFrom + 1);
  const legSplit = splitRows / splitBand >= 0.22 && splitRows >= 4;

  const upperCount = (() => {
    let n = 0;
    const y1 = minY + Math.floor(boxH * 0.26);
    for (let y = minY; y <= y1; y++) n += rows[y]!.count;
    return n;
  })();
  const totalCount = (() => {
    let n = 0;
    for (let y = minY; y <= maxY; y++) n += rows[y]!.count;
    return n;
  })();
  const hasUpperPerson =
    totalCount > 0 &&
    upperCount / totalCount >= 0.12 &&
    (upperSpan < midSpan * 0.86 || tall > 1.25);

  let hint: CutoutSilhouetteHint = "unknown";
  if (legSplit || (flared && tall > 1.12)) hint = "bottom";
  else if (tall >= 1.22 && wide >= 0.48) hint = "bottom";
  else if (tall >= 1.32 && wide >= 0.42 && hasUpperPerson) hint = "bottom";
  else if (tall >= 1.85 && wide <= 0.5 && !flared && !legSplit) hint = "dress";
  else if (tall >= 1.55 && wide <= 0.44 && !flared && !legSplit) hint = "dress";

  return {
    minX,
    minY,
    maxX,
    maxY,
    boxW,
    boxH,
    tall,
    wide,
    flared,
    legSplit,
    hasUpperPerson,
    hint,
    rows,
  };
}

function hintsSayBottom(hints?: CutoutHints): boolean {
  const role = hints?.roleHint;
  if (role === "bottom" || role === "trousers" || role === "shorts") return true;
  return /trouser|pants|jean|skirt|short/i.test(hints?.fileHint || "");
}

function hintsSayDress(hints?: CutoutHints): boolean {
  if (hints?.roleHint === "dress") return true;
  return /dress|gown/i.test(hints?.fileHint || "");
}

/**
 * After rembg, bottoms often keep torso / arm / bag. Crop to the lower garment
 * (waistband → hem) using the opaque mask. Heuristic — not vision. Name/role
 * "bottom" forces the crop; otherwise legs / flare / tall-moderate aspect.
 */
function refineBottomsCrop(
  image: ImageData,
  hints?: CutoutHints
): { image: ImageData; silhouette: CutoutSilhouetteHint } {
  const forceDress = hintsSayDress(hints) && !hintsSayBottom(hints);
  const forceBottom = hintsSayBottom(hints);
  const stats = measureSilhouette(image);
  if (!stats) return { image, silhouette: "unknown" };
  if (forceDress) return { image, silhouette: "dress" };
  // Vision / split already labeled a non-bottom piece — do not waist-crop it into a "bottom".
  const role = hints?.roleHint;
  if (
    role &&
    role !== "other" &&
    role !== "bottom" &&
    role !== "trousers" &&
    role !== "shorts"
  ) {
    return { image, silhouette: role === "dress" ? "dress" : "unknown" };
  }

  const shouldCrop =
    forceBottom ||
    stats.hint === "bottom" ||
    stats.legSplit ||
    stats.flared ||
    (stats.hasUpperPerson && stats.tall >= 1.2 && stats.wide >= 0.4);

  if (!shouldCrop) return { image, silhouette: stats.hint };

  const cropped = cropToLowerGarment(image, stats);
  const trimmed = trimTransparent(cropped, 6);
  const after = measureSilhouette(trimmed);
  const silhouette: CutoutSilhouetteHint =
    forceBottom || after?.hint === "bottom" || stats.hint === "bottom" ? "bottom" : after?.hint ?? "bottom";
  return { image: trimmed, silhouette };
}

function cropToLowerGarment(image: ImageData, stats: SilhouetteStats): ImageData {
  const { rows, minY, maxY, boxH, minX, maxX } = stats;
  const searchFrom = minY + Math.floor(boxH * 0.1);
  const searchTo = minY + Math.floor(boxH * 0.48);
  let maxLower = 1;
  for (let y = minY + Math.floor(boxH * 0.45); y <= maxY; y++) {
    if (rows[y]!.count > maxLower) maxLower = rows[y]!.count;
  }

  // Default: drop leftover head/torso. Aggressive when person leftover or legs.
  let waistY = minY + Math.floor(boxH * (stats.hasUpperPerson || stats.legSplit ? 0.28 : 0.16));

  let bestScore = Infinity;
  for (let y = searchFrom; y <= searchTo; y++) {
    const row = rows[y]!;
    if (row.count < maxLower * 0.28) continue;
    const span = row.maxX - row.minX + 1;
    const below = rows[Math.min(maxY, y + Math.floor(boxH * 0.12))]!;
    const belowSpan = below.count ? below.maxX - below.minX + 1 : span;
    // Waist = relatively narrow row that still has mass, with wider garment below.
    const score = span - belowSpan * 0.35 + Math.abs(y - (minY + boxH * 0.36)) * 0.15;
    if (score < bestScore && belowSpan >= span * 0.92) {
      bestScore = score;
      waistY = y;
    }
  }

  // Never keep more than ~90% (always strip a sliver of top junk) or drop > 46%.
  const minDrop = minY + Math.floor(boxH * 0.08);
  const maxDrop = minY + Math.floor(boxH * 0.46);
  waistY = Math.max(minDrop, Math.min(maxDrop, waistY));

  // Horizontal crop from the kept garment, not a bag sticking out above the waist.
  let gMinX = maxX;
  let gMaxX = minX;
  for (let y = waistY; y <= maxY; y++) {
    const row = rows[y]!;
    if (!row.count) continue;
    if (row.minX < gMinX) gMinX = row.minX;
    if (row.maxX > gMaxX) gMaxX = row.maxX;
  }
  if (gMaxX < gMinX) {
    gMinX = minX;
    gMaxX = maxX;
  }
  const pad = 4;
  return cropRect(
    image,
    Math.max(0, gMinX - pad),
    Math.max(0, waistY - pad),
    Math.min(image.width - 1, gMaxX + pad),
    Math.min(image.height - 1, maxY + pad)
  );
}

function cropRect(image: ImageData, minX: number, minY: number, maxX: number, maxY: number): ImageData {
  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  if (tw <= 0 || th <= 0) return image;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return image;
  ctx.putImageData(image, 0, 0);
  return ctx.getImageData(minX, minY, tw, th);
}

/**
 * Isolated corner blobs (bag, hand, lamp) after rembg. Flood from each corner;
 * if the component is small and stays near the corner, clear it.
 */
function stripCornerIslands(image: ImageData) {
  const { data, width, height } = image;
  const total = (() => {
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 18) n += 1;
    return n;
  })();
  if (total < 80) return;
  const cap = Math.max(40, Math.floor(total * 0.08));
  const patch = Math.max(10, Math.min(28, Math.floor(Math.min(width, height) * 0.16)));
  const starts: [number, number][] = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  const visited = new Uint8Array(width * height);
  for (const [sx, sy] of starts) {
    if (data[(sy * width + sx) * 4 + 3] < 18) {
      // Walk inward a few px to catch a blob that doesn't sit on the exact corner pixel.
      let found: number | null = null;
      const dx = sx === 0 ? 1 : -1;
      const dy = sy === 0 ? 1 : -1;
      outer: for (let i = 0; i < patch; i++) {
        for (let j = 0; j < patch; j++) {
          const x = sx + dx * i;
          const y = sy + dy * j;
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          if (data[(y * width + x) * 4 + 3] > 18) {
            found = y * width + x;
            break outer;
          }
        }
      }
      if (found == null) continue;
      floodClearIfSmall(image, visited, found, cap, patch, sx, sy);
    } else {
      floodClearIfSmall(image, visited, sy * width + sx, cap, patch, sx, sy);
    }
  }
}

function floodClearIfSmall(
  image: ImageData,
  visited: Uint8Array,
  start: number,
  cap: number,
  patch: number,
  cornerX: number,
  cornerY: number
) {
  const { data, width, height } = image;
  if (visited[start]) return;
  const stack = [start];
  const collected: number[] = [];
  let far = false;
  visited[start] = 1;
  while (stack.length) {
    const idx = stack.pop()!;
    collected.push(idx);
    if (collected.length > cap) {
      far = true;
      break;
    }
    const x = idx % width;
    const y = Math.floor(idx / width);
    if (Math.abs(x - cornerX) > patch * 1.8 || Math.abs(y - cornerY) > patch * 1.8) {
      far = true;
      break;
    }
    const nbs = [idx + 1, idx - 1, idx + width, idx - width];
    for (const n of nbs) {
      if (n < 0 || n >= width * height || visited[n]) continue;
      const nx = n % width;
      const ny = Math.floor(n / width);
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
      if (data[n * 4 + 3]! < 18) continue;
      visited[n] = 1;
      stack.push(n);
    }
  }
  if (far) return;
  for (const idx of collected) data[idx * 4 + 3] = 0;
}

function trimTransparent(image: ImageData, pad: number): ImageData {
  const { data, width, height } = image;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 12) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return image;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return image;
  ctx.putImageData(image, 0, 0);
  return ctx.getImageData(minX, minY, tw, th);
}
