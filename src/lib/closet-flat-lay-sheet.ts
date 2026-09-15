/**
 * Multi-item flat-lay SHEET pipeline (architecture lock):
 *   selfie + detect labels → ONE gpt-image sheet → blob-slice tiles → confirm.
 * Prefer this over per-crop gpt-image regenerate (invents wrong buckle/boots).
 * Budget: one sheet ≈ one polish unit.
 */
import sharp from "sharp";
import type { ClosetRole, ColorId } from "./types";
import {
  hasFlatLayImageProvider,
  runFlatLayImagePolish,
  type FlatLayProviderKind,
} from "./closet-flat-lay-adapter";
import { dataUrlToPngBuffer, FLATLAY_PLATE_RGB } from "./closet-flat-lay";

export type SheetItemHint = {
  role: ClosetRole | string;
  label: string;
  colorHint?: ColorId | "other" | string | null;
};

export type SheetTile = {
  polishedDataUrl: string;
  role: ClosetRole | string;
  label: string;
  colorHint: ColorId | "other" | string;
  index: number;
  /** Bounding box on the sheet, normalized 0–1. */
  box: { x: number; y: number; w: number; h: number };
};

export type SheetPolishOk = {
  ok: true;
  sheetDataUrl: string;
  tiles: SheetTile[];
  model: string;
  provider: FlatLayProviderKind;
  estCostUsd: number;
};

export type SheetPolishFail = {
  ok: false;
  code: "no_image_provider" | "polish_failed" | "invalid_image" | "slice_failed";
  error: string;
};

type BlobBox = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  area: number;
  w: number;
  h: number;
};

/** Order items for a stable reading-order layout in the sheet prompt. */
export function orderSheetItems(items: SheetItemHint[]): SheetItemHint[] {
  const rank = (it: SheetItemHint) => {
    const role = String(it.role || "");
    const label = String(it.label || "").toLowerCase();
    if (role === "dress" || /dress|romper|jumpsuit/.test(label)) return 0;
    if (role === "top" || role === "sweater" || role === "cardigan" || role === "outerwear") return 1;
    if (role === "bottom" || role === "trousers" || role === "shorts") return 2;
    if (role === "shoes" || /boot|shoe|sandal|sneaker|heel/.test(label)) return 3;
    if (role === "bag" || /bag|purse|tote/.test(label)) return 4;
    if (/belt/.test(label)) return 5;
    if (/hat|fedora|beanie|cap/.test(label)) return 6;
    return 7;
  };
  return [...items].sort((a, b) => rank(a) - rank(b) || String(a.label).localeCompare(String(b.label)));
}

export function buildMultiItemSheetPrompt(items: SheetItemHint[]): string {
  const ordered = orderSheetItems(items).slice(0, 8);
  const n = ordered.length;
  const list = ordered
    .map((it, i) => {
      const color = it.colorHint && it.colorHint !== "other" ? `${it.colorHint} ` : "";
      const name = (it.label || it.role || `item ${i + 1}`).trim();
      return `${i + 1}) ${color}${name} (role: ${it.role || "other"})`;
    })
    .join("; ");

  return [
    "PROMPT LOCK — Closet multi-item flat-lay SHEET (ChatGPT gold style):",
    `From the outfit / mirror selfie reference, extract EXACTLY these ${n} women's fashion items and lay EACH out as an isolated catalog flat-lay on one shared plain cream/white background sheet.`,
    `Items (place in this reading order — left-to-right, top-to-bottom, clearly separated so items do NOT touch): ${list}.`,
    "CRITICAL fidelity: preserve exact color, fabric, silhouette, hardware, buckle shape, boot HEIGHT, and construction from the selfie — do NOT invent a different buckle (oval/rope stays oval/rope — never a heart), do NOT shorten tall/knee boots into ankle boots, do NOT drop the main dress.",
    "Paired shoes/boots = ONE visual group: both boots must TOUCH or slightly overlap so they form a single connected region (never far-apart left/right islands). If a belt is in the item list (or worn on a dress), render the belt as its OWN separate flat tile with the exact buckle shape — never leave the belt only on the dress, and never invent a heart buckle.",
    "Each item isolated with generous white space between neighbors. Off-model product flats only — NO person, NO face, NO body, NO mannequin, NO hanger, NO floor, NO furniture, NO extra invented accessories.",
    "Do NOT add items that are not in the list. Do NOT omit any listed item. Soft even studio lighting. Clean e-commerce contact-sheet for a digital closet.",
  ].join(" ");
}

/**
 * Connected-component slice of a white/cream multi-item sheet into tiles.
 * Merges side-by-side pair halves (boots) that would otherwise split.
 */
export async function sliceFlatLaySheet(
  sheetPng: Buffer,
  expectedCount?: number
): Promise<{ tiles: { png: Buffer; box: BlobBox; norm: { x: number; y: number; w: number; h: number } }[]; width: number; height: number }> {
  const { data, info } = await sharp(sheetPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width || 1;
  const height = info.height || 1;
  const channels = info.channels || 4;
  const content = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3] ?? 255;
      const bg =
        a < 20 ||
        (r > 235 && g > 230 && b > 220 && Math.abs(r - g) < 20 && Math.abs(g - b) < 25);
      content[y * width + x] = bg ? 0 : 1;
    }
  }

  const visited = new Uint8Array(width * height);
  const comps: BlobBox[] = [];
  const dirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (!content[start] || visited[start]) continue;
      const stack = [start];
      visited[start] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      while (stack.length) {
        const idx = stack.pop()!;
        area += 1;
        const cx = idx % width;
        const cy = (idx / width) | 0;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (!content[n] || visited[n]) continue;
          visited[n] = 1;
          stack.push(n);
        }
      }
      comps.push({
        minX,
        maxX,
        minY,
        maxY,
        area,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
      });
    }
  }

  const minArea = width * height * 0.004;
  let kept = comps.filter((c) => c.area >= minArea && c.w > 20 && c.h > 20);
  kept = mergePairBlobs(kept);

  // Prefer largest blobs when we over-segment.
  kept.sort((a, b) => b.area - a.area);
  if (expectedCount && expectedCount > 0 && kept.length > expectedCount) {
    kept = kept.slice(0, expectedCount);
  }

  // Reading order: top-to-bottom, then left-to-right.
  kept.sort((a, b) => {
    const ay = (a.minY + a.maxY) / 2;
    const by = (b.minY + b.maxY) / 2;
    if (Math.abs(ay - by) > height * 0.12) return ay - by;
    return (a.minX + a.maxX) / 2 - (b.minX + b.maxX) / 2;
  });

  const tiles: { png: Buffer; box: BlobBox; norm: { x: number; y: number; w: number; h: number } }[] = [];
  const pad = Math.max(8, Math.round(Math.min(width, height) * 0.01));

  for (const c of kept) {
    const left = Math.max(0, c.minX - pad);
    const top = Math.max(0, c.minY - pad);
    const tw = Math.min(width - left, c.w + pad * 2);
    const th = Math.min(height - top, c.h + pad * 2);
    if (tw < 8 || th < 8) continue;

    const cropped = await sharp(sheetPng).extract({ left, top, width: tw, height: th }).png().toBuffer();
    // Composite onto cream plate so tiles match hang-rack.
    const plate = await sharp({
      create: {
        width: tw,
        height: th,
        channels: 3,
        background: FLATLAY_PLATE_RGB,
      },
    })
      .png()
      .toBuffer();
    const png = await sharp(plate)
      .composite([{ input: cropped, blend: "over" }])
      .png()
      .toBuffer();

    tiles.push({
      png,
      box: c,
      norm: {
        x: left / width,
        y: top / height,
        w: tw / width,
        h: th / height,
      },
    });
  }

  return { tiles, width, height };
}

function mergePairBlobs(kept: BlobBox[]): BlobBox[] {
  const iouY = (a: BlobBox, b: BlobBox) => {
    const y0 = Math.max(a.minY, b.minY);
    const y1 = Math.min(a.maxY, b.maxY);
    return Math.max(0, y1 - y0) / Math.min(a.h, b.h);
  };
  const gapX = (a: BlobBox, b: BlobBox) => {
    if (a.maxX < b.minX) return b.minX - a.maxX;
    if (b.maxX < a.minX) return a.minX - b.maxX;
    return 0;
  };

  let working = [...kept];
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < working.length; i++) {
      for (let j = i + 1; j < working.length; j++) {
        const a = working[i]!;
        const b = working[j]!;
        const areaRatio = Math.min(a.area, b.area) / Math.max(a.area, b.area);
        const wRatio = Math.min(a.w, b.w) / Math.max(a.w, b.w);
        const hRatio = Math.min(a.h, b.h) / Math.max(a.h, b.h);
        const bothTall = a.h > a.w * 1.15 && b.h > b.w * 1.15;
        if (
          areaRatio > 0.55 &&
          wRatio > 0.55 &&
          hRatio > 0.65 &&
          iouY(a, b) > 0.55 &&
          gapX(a, b) < Math.min(a.w, b.w) * 1.1 &&
          bothTall
        ) {
          const m: BlobBox = {
            minX: Math.min(a.minX, b.minX),
            maxX: Math.max(a.maxX, b.maxX),
            minY: Math.min(a.minY, b.minY),
            maxY: Math.max(a.maxY, b.maxY),
            area: a.area + b.area,
            w: 0,
            h: 0,
          };
          m.w = m.maxX - m.minX + 1;
          m.h = m.maxY - m.minY + 1;
          working = [...working.filter((_, k) => k !== i && k !== j), m];
          merged = true;
          break outer;
        }
      }
    }
  }
  return working;
}

/** Score how well a sliced tile matches an item hint (greedy assignment). */
export function scoreTileForItem(
  tile: { w: number; h: number; area: number },
  item: SheetItemHint
): number {
  const aspect = tile.h / Math.max(1, tile.w); // >1 tall
  const role = String(item.role || "");
  const label = String(item.label || "").toLowerCase();
  let score = 0;

  const isDress = role === "dress" || /dress|romper|jumpsuit/.test(label);
  const isShoes = role === "shoes" || /boot|shoe|sandal|sneaker|heel/.test(label);
  const isBelt = /belt/.test(label);
  const isHat = /hat|fedora|beanie|cap/.test(label);
  const isSmallAcc = /scrunchie|jewel|earring|bracelet|necklace/.test(label);

  if (isDress) {
    if (aspect > 1.15) score += 4;
    if (tile.area > 0) score += 2; // relative filled later
    if (aspect < 0.7) score -= 3;
  } else if (isShoes) {
    // Tall shaft / pair: prefer clearly taller-than-wide; avoid near-square hat discs.
    if (aspect >= 1.2) score += 5;
    else if (aspect >= 1.05) score += 3;
    else if (aspect >= 0.9) score += 1;
    if (aspect < 0.5) score -= 4; // belt-like
    if (aspect >= 0.85 && aspect <= 1.12) score -= 2; // top-down hat-like
  } else if (isBelt) {
    if (aspect < 0.55) score += 5;
    if (aspect > 1) score -= 4;
  } else if (isHat) {
    if (aspect > 0.85 && aspect < 1.2) score += 5; // top-down disc
    else if (aspect > 0.7 && aspect < 1.35) score += 2;
    if (aspect >= 1.35) score -= 3; // too tall — likely boots/dress
    if (aspect < 0.4) score -= 3;
  } else if (isSmallAcc) {
    if (tile.area > 0) score += 1;
    if (aspect > 0.6 && aspect < 1.4) score += 2;
  } else if (role === "accessory") {
    if (aspect < 0.55) score += 2;
    else score += 1;
  } else {
    score += 1;
  }
  return score;
}

export function assignTilesToItems<T extends { w: number; h: number; area: number }>(
  tiles: T[],
  items: SheetItemHint[]
): { tileIndex: number; item: SheetItemHint }[] {
  const orderedItems = orderSheetItems(items);
  const n = Math.min(tiles.length, orderedItems.length);
  if (n === 0) return [];

  // Relative area boost for dress vs small accessories.
  const areas = tiles.map((t) => t.area);
  const maxArea = Math.max(...areas, 1);

  const freeTiles = new Set(tiles.map((_, i) => i));
  const assignments: { tileIndex: number; item: SheetItemHint }[] = [];

  // Assign distinctive roles first (belt, dress, shoes), then the rest.
  const priority = [...orderedItems].sort((a, b) => {
    const pr = (it: SheetItemHint) => {
      const l = String(it.label || "").toLowerCase();
      const r = String(it.role || "");
      if (/belt/.test(l)) return 0;
      if (r === "dress" || /dress/.test(l)) return 1;
      if (r === "shoes" || /boot|shoe/.test(l)) return 2;
      if (/hat|fedora/.test(l)) return 3;
      return 4;
    };
    return pr(a) - pr(b);
  });

  for (const item of priority) {
    if (assignments.length >= n) break;
    let best = -1;
    let bestScore = -Infinity;
    for (const ti of freeTiles) {
      const tile = tiles[ti]!;
      let s = scoreTileForItem(tile, item);
      const isDress = item.role === "dress" || /dress/.test(String(item.label || "").toLowerCase());
      const isSmall = /scrunchie|jewel|earring/.test(String(item.label || "").toLowerCase());
      if (isDress) s += (tile.area / maxArea) * 3;
      if (isSmall) s += (1 - tile.area / maxArea) * 2;
      if (s > bestScore) {
        bestScore = s;
        best = ti;
      }
    }
    if (best >= 0) {
      freeTiles.delete(best);
      assignments.push({ tileIndex: best, item });
    }
  }

  return assignments;
}

/**
 * Full selfie → one multi-item sheet → sliced/mapped tiles.
 * Caller owns polish budget INCR (one unit).
 */
export async function polishOutfitToFlatLaySheet(params: {
  imageDataUrl: string;
  items: SheetItemHint[];
  estCostUsd?: number;
}): Promise<SheetPolishOk | SheetPolishFail> {
  if (!hasFlatLayImageProvider()) {
    return { ok: false, code: "no_image_provider", error: "No AI Gateway provider configured" };
  }
  const items = (params.items || []).filter((it) => it && (it.label || it.role));
  if (items.length < 2) {
    return { ok: false, code: "invalid_image", error: "Sheet polish needs ≥2 items" };
  }

  let refPng: Buffer;
  try {
    const raw = await dataUrlToPngBuffer(params.imageDataUrl);
    refPng = await sharp(raw)
      .rotate()
      .resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch (err) {
    return {
      ok: false,
      code: "invalid_image",
      error: err instanceof Error ? err.message : "Invalid image",
    };
  }

  const prompt = buildMultiItemSheetPrompt(items);
  const estCostUsd = params.estCostUsd ?? 0.04;
  const adapted = await runFlatLayImagePolish({ platePng: refPng, prompt });
  if (!adapted.ok) {
    return { ok: false, code: adapted.code, error: adapted.error };
  }

  const sheetPng = await sharp(adapted.png).png().toBuffer();
  const sheetDataUrl = `data:image/png;base64,${sheetPng.toString("base64")}`;

  let sliced: Awaited<ReturnType<typeof sliceFlatLaySheet>>;
  try {
    sliced = await sliceFlatLaySheet(sheetPng, items.length);
  } catch (err) {
    return {
      ok: false,
      code: "slice_failed",
      error: err instanceof Error ? err.message : "Sheet slice failed",
    };
  }

  if (sliced.tiles.length < 2) {
    return {
      ok: false,
      code: "slice_failed",
      error: `Sheet slice found ${sliced.tiles.length} tile(s); need ≥2`,
    };
  }

  const tileMetrics = sliced.tiles.map((t) => ({
    w: t.box.w,
    h: t.box.h,
    area: t.box.area,
  }));
  const assignments = assignTilesToItems(tileMetrics, items);

  // If assignment under-covered, fall back to reading-order zip with ordered items.
  const usedTile = new Set(assignments.map((a) => a.tileIndex));
  const usedItemLabels = new Set(assignments.map((a) => `${a.item.role}|${a.item.label}`));
  const ordered = orderSheetItems(items);
  if (assignments.length < Math.min(sliced.tiles.length, ordered.length)) {
    for (let i = 0; i < sliced.tiles.length && assignments.length < ordered.length; i++) {
      if (usedTile.has(i)) continue;
      const item = ordered.find((it) => !usedItemLabels.has(`${it.role}|${it.label}`));
      if (!item) break;
      assignments.push({ tileIndex: i, item });
      usedTile.add(i);
      usedItemLabels.add(`${item.role}|${item.label}`);
    }
  }

  const tiles: SheetTile[] = [];
  for (let ai = 0; ai < assignments.length; ai++) {
    const { tileIndex, item } = assignments[ai]!;
    const t = sliced.tiles[tileIndex]!;
    // Downscale huge tiles for closet storage.
    const resized = await sharp(t.png)
      .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    tiles.push({
      polishedDataUrl: `data:image/png;base64,${resized.toString("base64")}`,
      role: item.role || "other",
      label: item.label || String(item.role || "piece"),
      colorHint: item.colorHint || "other",
      index: ai,
      box: t.norm,
    });
  }

  console.info(
    `[closet-flat-lay-sheet] model=${adapted.model} provider=${adapted.provider} items=${items.length} tiles=${tiles.length} sheetBytes=${sheetPng.length}`
  );

  return {
    ok: true,
    sheetDataUrl,
    tiles,
    model: adapted.model,
    provider: adapted.provider,
    estCostUsd,
  };
}
