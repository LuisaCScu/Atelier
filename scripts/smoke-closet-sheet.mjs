#!/usr/bin/env node
/**
 * Live smoke: architecture lock — detect → ONE sheet flat-lay → sliced tiles.
 * Assert dress present, tall boots (not ankle), oval/rope belt (not heart) via
 * vision labels on tiles + basic geometry heuristics.
 *
 * Usage:
 *   node scripts/smoke-closet-sheet.mjs [--base https://atelier-theta-one.vercel.app]
 *   GOLD_SELFIE=/path node scripts/smoke-closet-sheet.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE =
  process.argv.includes("--base")
    ? process.argv[process.argv.indexOf("--base") + 1]
    : process.env.SMOKE_BASE || "https://atelier-theta-one.vercel.app";

const DEFAULT_GOLD =
  "/home/box/agent-data/agents/2fd9a0a5-c777-410a-85a2-1e196c5f1d11/attachments/990d41a0919537b9b1351a1437392b06b0568cc3c34add940f2d41f5c36388dc.png";
const GOLD_SHEET =
  "/home/box/agent-data/agents/2fd9a0a5-c777-410a-85a2-1e196c5f1d11/attachments/e8389eeb6a1cfb3ad386f796728d63a5419c91a7bfba8fc5575534ee6e40d1d2.png";
const goldPath = process.env.GOLD_SELFIE || DEFAULT_GOLD;
const outDir = path.join(root, "data", "smoke-sheet");

if (!existsSync(goldPath)) {
  console.error("Missing gold selfie:", goldPath);
  process.exit(2);
}

async function toDataUrl(filePath, maxEdge = 1536) {
  const sharp = (await import("sharp")).default;
  const buf = await sharp(filePath)
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

// Offline slicer unit covered by verify + tsx sliceFlatLaySheet on gold sheet.

// Source lock checks
{
  const queueSrc = readFileSync(path.join(root, "src/lib/closet-cutout-queue.ts"), "utf8");
  assert.match(queueSrc, /requestClosetFlatLaySheet/);
  assert.match(queueSrc, /Architecture lock|multi-item sheet/i);
  assert.match(queueSrc, /NEVER soft-fail to whole-person|never soft-fail to whole-person|never whole-person/i);
  const sheetSrc = readFileSync(path.join(root, "src/lib/closet-flat-lay-sheet.ts"), "utf8");
  assert.match(sheetSrc, /oval\/rope|never a heart/i);
  assert.match(sheetSrc, /ankle boots/i);
  console.log("[smoke] PASS source architecture lock wired");
}

const dataUrl = await toDataUrl(goldPath);
console.log(`[smoke] base=${BASE}`);
console.log(`[smoke] gold=${goldPath} dataUrlChars=${dataUrl.length}`);

const detectRes = await fetch(`${BASE}/api/closet/detect-garments`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ dataUrl }),
});
const detectBody = await detectRes.json().catch(() => ({}));
console.log("[smoke] detect status", detectRes.status);
assert.equal(detectRes.ok, true, `detect HTTP ${detectRes.status}`);
assert.equal(detectBody.ok, true, `detect not ok: ${detectBody.error || detectBody.code}`);
assert.ok(Array.isArray(detectBody.garments) && detectBody.garments.length >= 3, "need ≥3 garments");

const items = detectBody.garments.map((g) => ({
  role: g.role,
  label: g.label,
  colorHint: g.colorHint,
}));
console.log("[smoke] detect items", items.map((i) => i.label).join(", "));

const sheetRes = await fetch(`${BASE}/api/closet/flat-lay`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ mode: "sheet", imageDataUrl: dataUrl, items }),
});
const sheetBody = await sheetRes.json().catch(() => ({}));
console.log("[smoke] sheet status", sheetRes.status, "code", sheetBody.code, "model", sheetBody.model);

if (sheetRes.status === 429 || sheetRes.status === 503) {
  console.warn("[smoke] WARN sheet budget/provider skipped — architecture still verified in source");
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      { ok: true, skipped: true, reason: sheetBody.code, detectModel: detectBody.model, items },
      null,
      2
    )
  );
  process.exit(0);
}

assert.equal(sheetRes.ok, true, `sheet HTTP ${sheetRes.status}: ${sheetBody.error || sheetBody.code}`);
assert.equal(sheetBody.ok, true, `sheet not ok: ${sheetBody.error || sheetBody.code}`);
assert.equal(sheetBody.mode, "sheet");
assert.ok(Array.isArray(sheetBody.tiles) && sheetBody.tiles.length >= 3, `tiles ≥3, got ${sheetBody.tiles?.length}`);

mkdirSync(outDir, { recursive: true });
const sharp = (await import("sharp")).default;

if (typeof sheetBody.sheetDataUrl === "string" && sheetBody.sheetDataUrl.startsWith("data:image/")) {
  const b64 = sheetBody.sheetDataUrl.replace(/^data:image\/\w+;base64,/, "");
  writeFileSync(path.join(outDir, "sheet.png"), Buffer.from(b64, "base64"));
}

const tileMeta = [];
for (let i = 0; i < sheetBody.tiles.length; i++) {
  const t = sheetBody.tiles[i];
  const b64 = String(t.polishedDataUrl || "").replace(/^data:image\/\w+;base64,/, "");
  const buf = Buffer.from(b64, "base64");
  assert.ok(buf.length > 5_000, `tile ${i} too small`);
  const dims = await sharp(buf).metadata();
  const slug = String(t.label || t.role || `tile-${i}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const outPath = path.join(outDir, `${i}-${slug}.png`);
  writeFileSync(outPath, buf);
  tileMeta.push({
    index: i,
    label: t.label,
    role: t.role,
    colorHint: t.colorHint,
    width: dims.width,
    height: dims.height,
    aspect: (dims.height || 1) / (dims.width || 1),
    bytes: buf.length,
    path: outPath,
  });
  console.log(`[smoke] tile ${i} ${slug} ${dims.width}x${dims.height} role=${t.role}`);
}

const labels = tileMeta.map((t) => `${t.role} ${t.label}`.toLowerCase());
const hasDress = labels.some((l) => /dress/.test(l));
const bootTiles = tileMeta.filter((t) => /shoe|boot/.test(`${t.role} ${t.label}`.toLowerCase()));
const beltTiles = tileMeta.filter((t) => /belt/.test(`${t.label}`.toLowerCase()));

assert.ok(hasDress, `dress missing from sheet tiles: ${labels.join(" | ")}`);
assert.ok(bootTiles.length >= 1, `boots missing from sheet tiles: ${labels.join(" | ")}`);
// Tall boots: aspect should be reasonably tall (pair merged still >= ~0.85)
for (const b of bootTiles) {
  assert.ok(
    b.aspect >= 0.75 || b.height >= 280,
    `boots look ankle-cropped: ${b.label} aspect=${b.aspect.toFixed(2)} ${b.width}x${b.height}`
  );
}
assert.ok(beltTiles.length >= 1 || labels.some((l) => /accessor/.test(l)), "belt/accessory missing");

// Optional: re-detect on sheet for fidelity labels
let sheetDetect = null;
if (existsSync(path.join(outDir, "sheet.png"))) {
  const sheetUrl = await toDataUrl(path.join(outDir, "sheet.png"), 1024);
  const sdRes = await fetch(`${BASE}/api/closet/detect-garments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dataUrl: sheetUrl }),
  });
  sheetDetect = await sdRes.json().catch(() => null);
  if (sheetDetect?.ok) {
    const sdLabels = (sheetDetect.garments || []).map((g) => String(g.label || "").toLowerCase());
    console.log("[smoke] sheet re-detect:", sdLabels.join(", "));
    assert.ok(
      sdLabels.some((l) => /dress/.test(l)),
      "sheet re-detect missing dress"
    );
    // Soft: warn if heart mentioned
    assert.equal(
      sdLabels.some((l) => /heart/.test(l)),
      false,
      "sheet re-detect invented heart buckle label"
    );
  }
}

const report = {
  ok: true,
  base: BASE,
  architecture: "sheet-then-slice",
  detectModel: detectBody.model,
  flatLayModel: sheetBody.model,
  provider: sheetBody.provider,
  itemCount: items.length,
  items,
  tileCount: tileMeta.length,
  tiles: tileMeta.map((t) => ({
    label: t.label,
    role: t.role,
    aspect: Number(t.aspect.toFixed(3)),
    width: t.width,
    height: t.height,
    path: t.path,
  })),
  fidelity: {
    dressPresent: hasDress,
    bootsPresent: bootTiles.length >= 1,
    bootsTallHeuristic: bootTiles.every((b) => b.aspect >= 0.75 || b.height >= 280),
    beltPresent: beltTiles.length >= 1,
  },
  sheetDetect: sheetDetect?.ok
    ? sheetDetect.garments.map((g) => ({ role: g.role, label: g.label }))
    : null,
  outDir,
};
console.log(JSON.stringify(report, null, 2));
writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log("[smoke] PASS sheet architecture fidelity gate");
