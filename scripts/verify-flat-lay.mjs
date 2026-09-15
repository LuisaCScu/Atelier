import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

/** Strip block + line comments so docstrings mentioning a symbol don't fail asserts. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const route = read("src/app/api/closet/flat-lay/route.ts");
const routeCode = stripComments(route);
const budget = read("src/lib/closet-flat-lay-budget.ts");
const budgetCode = stripComments(budget);
const adapter = read("src/lib/closet-flat-lay-adapter.ts");
const adapterCode = stripComments(adapter);
const pipeline = read("src/lib/closet-flat-lay.ts");
const client = read("src/lib/closet-flat-lay-client.ts");
const photoAdd = read("src/components/closet/photo-add.tsx");
const pkg = JSON.parse(read("package.json"));

// Route must never import or call stylist generate budget increment (comments OK).
assert.equal(
  /incrementGenerateBudget/.test(routeCode),
  false,
  "flat-lay route must not import/call incrementGenerateBudget"
);
assert.equal(
  /stylist-budget/.test(routeCode),
  false,
  "flat-lay route must not import stylist-budget"
);
assert.match(routeCode, /incrementClosetFlatLayBudget/);
assert.match(routeCode, /polishCutoutToFlatLay/);
assert.match(route, /NEVER imports or calls incrementGenerateBudget/);

assert.equal(
  /incrementGenerateBudget/.test(budgetCode),
  false,
  "closet-flat-lay-budget must not call incrementGenerateBudget"
);

assert.equal(
  /incrementGenerateBudget/.test(adapterCode),
  false,
  "adapter must not call incrementGenerateBudget"
);

// Pipeline: no /s regex flag (tsc target ES2017).
assert.equal(
  /\/[gimy]*s[gimy]*\.exec/.test(pipeline) || pipeline.includes("/s.exec"),
  false,
  "closet-flat-lay.ts must not use regex /s flag"
);
assert.ok(pipeline.includes('indexOf(",")'), "dataUrlToPngBuffer should split on first comma");

assert.match(client, /credentials:\s*["']same-origin["']/);
assert.match(client, /\/api\/closet\/flat-lay/);
assert.match(client, /fetchClosetFlatLayBudget/);
assert.match(client, /POLISH_BUDGET_EXHAUSTED_MSG/);
assert.match(photoAdd, /rawCutoutUrl/);
assert.match(photoAdd, /getCutoutJobRaw/);

assert.ok(pkg.dependencies?.ai, "package.json missing ai");
assert.ok(pkg.dependencies?.sharp, "package.json missing sharp");

// Outfit split: detect-garments + queue wiring (never whole-body when ≥2 garments).
const detectRoute = read("src/app/api/closet/detect-garments/route.ts");
const detectCode = stripComments(detectRoute);
const splitLib = read("src/lib/closet-outfit-split.ts");
const queue = read("src/lib/closet-cutout-queue.ts");
const queueCode = stripComments(queue);

assert.match(detectCode, /generateObject/);
assert.match(detectCode, /gpt-4o-mini|CLOSET_DETECT_MODEL|APPEARANCE_VISION_MODEL/);
assert.equal(/incrementGenerateBudget/.test(detectCode), false, "detect must not touch userGenerate");
assert.match(splitLib, /requestDetectGarments/);
assert.match(splitLib, /cropGarmentBlob/);
assert.match(splitLib, /shouldSplitOutfit/);
assert.match(queueCode, /trySplitOutfitIntoJobs|requestDetectGarments/);
assert.match(queueCode, /fromSplit/);
assert.match(queue, /never leave whole-body|Never leave whole-body|never rembg whole person/i);
// Prompt lock + pairs rule + no whole-person soft-fail when ≥2 detected
assert.match(detectRoute, /PROMPT LOCK/);
assert.match(detectRoute, /paired item|ONE tile for the pair|never left\/right/i);
assert.match(pipeline, /PROMPT LOCK/);
assert.match(pipeline, /one tile for the pair|never left\/right/i);
assert.match(queueCode, /Couldn't split that outfit/);
assert.match(queue, /NEVER soft-fail to whole-person|never soft-fail to whole-person/i);

// Polish-before-confirm lock
assert.match(queueCode, /requestClosetFlatLayPolish/);
assert.match(queueCode, /requestClosetFlatLaySheet/);
assert.match(queue, /Architecture lock|multi-item sheet|flat-lay sheet/i);
const sheetLib = read("src/lib/closet-flat-lay-sheet.ts");
assert.match(sheetLib, /buildMultiItemSheetPrompt/);
assert.match(sheetLib, /sliceFlatLaySheet/);
assert.match(sheetLib, /polishOutfitToFlatLaySheet/);
assert.match(sheetLib, /PROMPT LOCK/);
assert.match(routeCode, /mode.*sheet|sheetMode/);
assert.match(client, /requestClosetFlatLaySheet/);
assert.match(queueCode, /fetchClosetFlatLayBudget/);
assert.match(queueCode, /skipRefineBottoms/);
assert.match(queueCode, /POLISH_BUDGET_EXHAUSTED_MSG/);
assert.match(queueCode, /flatLayStatus:\s*"ready"/);
const photoCode = stripComments(photoAdd);
assert.match(photoCode, /flatLayStatus:\s*"ready"/);
assert.equal(/requestClosetFlatLayPolish/.test(photoCode), false, "photo-add must not polish after Save");
assert.equal(/enqueueStyleThisPiece/.test(photoCode), false, "photo-add must not fire Style Creates on Save");
assert.equal(/flatLayStatus:\s*"pending"/.test(photoCode), false, "confirm save must not mark polish pending");
const cutoutSrc = read("src/lib/closet-cutout.ts");
assert.match(cutoutSrc, /skipRefineBottoms/);

console.log("flat-lay + outfit-split verify ok");

