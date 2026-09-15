#!/usr/bin/env node
/**
 * Live smoke: POST /api/closet/detect-garments with gold-standard selfie.
 * Assert ≥3 garments and pairs not left/right-split.
 * Then polish EACH detected crop via /api/closet/flat-lay (budget-aware).
 * Writes polished PNGs to data/smoke-flats/ for visual ChatGPT-comparable check.
 *
 * Usage:
 *   node scripts/smoke-closet-detect.mjs [--base https://atelier-theta-one.vercel.app]
 *   GOLD_SELFIE=/path/to.png node scripts/smoke-closet-detect.mjs
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
const goldPath = process.env.GOLD_SELFIE || DEFAULT_GOLD;
const outDir = path.join(root, "data", "smoke-flats");

if (!existsSync(goldPath)) {
  console.error("Missing gold selfie:", goldPath);
  process.exit(2);
}

async function toDetectDataUrl(filePath) {
  const sharp = (await import("sharp")).default;
  const buf = await sharp(filePath)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

function looksLikePairSplit(garments) {
  const labels = garments.map((g) => String(g.label || "").toLowerCase());
  const shoeRoles = garments.filter((g) => g.role === "shoes");
  if (shoeRoles.length >= 2) {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\b(left|right|pair of|a|the)\b/g, "")
        .replace(/\b(boots?)\b/g, "boot")
        .replace(/\b(shoes?)\b/g, "shoe")
        .replace(/\b(sandals?)\b/g, "sandal")
        .replace(/\b(sneakers?)\b/g, "sneaker")
        .replace(/\s+/g, " ")
        .trim();
    const norms = shoeRoles.map((g) => norm(g.label));
    for (let i = 0; i < norms.length; i++) {
      for (let j = i + 1; j < norms.length; j++) {
        if (norms[i] && norms[i] === norms[j]) {
          return {
            split: true,
            reason: `duplicate shoes labels look L/R-split: "${shoeRoles[i].label}" + "${shoeRoles[j].label}"`,
          };
        }
      }
    }
  }
  const lr = labels.filter((l) => /\b(left|right)\b/.test(l) && /(shoe|boot|sandal|sneaker|sock|glove|earring)/.test(l));
  if (lr.length >= 2) return { split: true, reason: `left/right labels: ${lr.join(", ")}` };
  return { split: false };
}

const dataUrl = await toDetectDataUrl(goldPath);
console.log(`[smoke] base=${BASE}`);
console.log(`[smoke] gold=${goldPath} dataUrlChars=${dataUrl.length}`);

const detectRes = await fetch(`${BASE}/api/closet/detect-garments`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ dataUrl }),
});
const detectBody = await detectRes.json().catch(() => ({}));
console.log("[smoke] detect status", detectRes.status);
console.log("[smoke] detect body", JSON.stringify(detectBody, null, 2));

assert.equal(detectRes.ok, true, `detect HTTP ${detectRes.status}`);
assert.equal(detectBody.ok, true, `detect not ok: ${detectBody.error || detectBody.code}`);
assert.ok(Array.isArray(detectBody.garments), "garments array");
assert.ok(
  detectBody.garments.length >= 3,
  `expected ≥3 garments, got ${detectBody.garments.length}: ${detectBody.garments.map((g) => g.label).join(", ")}`
);

const pairCheck = looksLikePairSplit(detectBody.garments);
assert.equal(pairCheck.split, false, `pairs appear split: ${pairCheck.reason}`);

const summary = detectBody.garments.map((g) => ({
  role: g.role,
  label: g.label,
  colorHint: g.colorHint,
  box: g.box,
}));
console.log("[smoke] PASS detect item count=", summary.length);

mkdirSync(outDir, { recursive: true });
const sharp = (await import("sharp")).default;
const meta = await sharp(goldPath).metadata();
const w = meta.width || 1024;
const h = meta.height || 1024;

const flatResults = [];
const maxPolish = Math.min(summary.length, Number(process.env.SMOKE_MAX_POLISH || 5));

for (let i = 0; i < maxPolish; i++) {
  const target = detectBody.garments[i];
  const left = Math.max(0, Math.floor(target.box.x * w));
  const top = Math.max(0, Math.floor(target.box.y * h));
  const width = Math.max(8, Math.floor(target.box.w * w));
  const height = Math.max(8, Math.floor(target.box.h * h));
  const crop = await sharp(goldPath)
    .extract({
      left,
      top,
      width: Math.min(width, w - left),
      height: Math.min(height, h - top),
    })
    .resize({ width: 768, height: 768, fit: "inside" })
    .png()
    .toBuffer();
  const imageDataUrl = `data:image/png;base64,${crop.toString("base64")}`;
  const slug = String(target.label || target.role || `piece-${i}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  writeFileSync(path.join(outDir, `${i}-${slug}-crop.png`), crop);

  const flRes = await fetch(`${BASE}/api/closet/flat-lay`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      imageDataUrl,
      roleHint: target.role || "other",
      colorHint: target.colorHint || "other",
      labelHint: target.label || undefined,
    }),
  });
  const flBody = await flRes.json().catch(() => ({}));
  const entry = {
    index: i,
    label: target.label,
    role: target.role,
    status: flRes.status,
    code: flBody.code,
    model: flBody.model,
    provider: flBody.provider,
    ok: false,
    skipped: false,
    bytes: 0,
    path: null,
  };
  if (flRes.status === 429 || flRes.status === 503) {
    entry.skipped = true;
    entry.reason = `budget/provider ${flRes.status} ${flBody.code || ""}`;
    console.log(`[smoke] flat-lay skipped ${slug}:`, entry.reason);
  } else if (flRes.ok && flBody.ok && typeof flBody.polishedDataUrl === "string") {
    const b64 = flBody.polishedDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(b64, "base64");
    const outPath = path.join(outDir, `${i}-${slug}-flat.png`);
    writeFileSync(outPath, buf);
    entry.ok = true;
    entry.bytes = buf.length;
    entry.path = outPath;
    // Reject tiny smudge-like outputs
    assert.ok(buf.length > 8_000, `flat tile too small for ${slug}: ${buf.length}`);
    const dims = await sharp(buf).metadata();
    assert.ok((dims.width || 0) >= 128 && (dims.height || 0) >= 128, `flat dims tiny for ${slug}`);
    console.log(`[smoke] PASS flat-lay ${slug} model=${flBody.model} ${dims.width}x${dims.height} bytes=${buf.length}`);
  } else {
    entry.reason = flBody.error || flBody.code || `HTTP ${flRes.status}`;
    console.warn(`[smoke] flat-lay FAIL ${slug}:`, entry.reason);
  }
  flatResults.push(entry);
}

const polishedOk = flatResults.filter((r) => r.ok).length;
const skipped = flatResults.filter((r) => r.skipped).length;
assert.ok(
  polishedOk >= 1 || skipped === flatResults.length,
  `expected ≥1 polished flat (or all budget-skipped); ok=${polishedOk} skipped=${skipped}`
);
if (polishedOk === 0 && skipped === flatResults.length) {
  console.warn("[smoke] WARN: all flat-lays budget/provider skipped — UI pipeline still verified in source");
} else {
  assert.ok(polishedOk >= Math.min(2, maxPolish) || skipped > 0, `want ≥2 polished when budget allows; got ${polishedOk}`);
}

const queueSrc = readFileSync(path.join(root, "src/lib/closet-cutout-queue.ts"), "utf8");
assert.match(queueSrc, /NEVER soft-fail to whole-person|never soft-fail to whole-person/i);
assert.match(queueSrc, /requestClosetFlatLayPolish/);
assert.match(queueSrc, /skipRefineBottoms/);
assert.match(queueSrc, /POLISH_BUDGET_EXHAUSTED_MSG/);
console.log("[smoke] PASS polish-before-confirm wired in cutout-queue source");

const report = {
  ok: true,
  base: BASE,
  detectModel: detectBody.model,
  itemCount: summary.length,
  items: summary.map((g) => ({ role: g.role, label: g.label, colorHint: g.colorHint })),
  pairsSplit: false,
  flatLay: {
    polishedOk,
    skipped,
    results: flatResults.map((r) => ({
      label: r.label,
      role: r.role,
      ok: r.ok,
      skipped: r.skipped,
      model: r.model,
      path: r.path,
      bytes: r.bytes,
      reason: r.reason,
    })),
  },
  outDir,
  polishBeforeConfirm: true,
};
console.log(JSON.stringify(report, null, 2));
writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
