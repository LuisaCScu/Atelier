import assert from "node:assert/strict";
import { closetToStylistPacket, parseClosetPacket } from "../src/lib/closet-packet.ts";
import { COLOR_SWATCH } from "../src/lib/catalog.ts";
import {
  categoryFromRole,
  CLOSET_COLOR_CHIPS,
  CLOSET_ROLE_BUCKETS,
  CLOSET_ROLES,
  normalizeClosetItem,
  parseClosetColor,
  roleFromCategory,
  roleFromCutoutHints,
  suggestedClosetName,
} from "../src/lib/closet-roles.ts";
import { hueChromaSpread, nearestColorId } from "../src/lib/closet-cutout.ts";
import { CLOSET_FREE_CAP } from "../src/lib/types.ts";

assert.equal(CLOSET_FREE_CAP, 10);
assert.equal(roleFromCategory("trousers"), "bottom");
assert.equal(roleFromCategory("tee"), "top");
assert.equal(categoryFromRole("dress"), "other");
assert.equal(categoryFromRole("bag"), "accessory");
assert.equal(categoryFromRole("sweater"), "knit");
assert.equal(categoryFromRole("cardigan"), "knit");

assert.ok(CLOSET_ROLES.some((r) => r.id === "sweater"));
assert.ok(CLOSET_ROLES.some((r) => r.id === "cardigan"));
assert.equal(suggestedClosetName("cream", "sweater"), "cream sweater");
assert.equal(suggestedClosetName("navy", "top"), "navy top");

const bucketIds = CLOSET_ROLE_BUCKETS.map((b) => b.id);
assert.deepEqual(bucketIds, [
  "dresses",
  "tops",
  "sweaters",
  "cardigans",
  "bottoms",
  "outerwear",
  "shoes",
  "bags",
  "accessories",
  "other",
]);

const legacy = normalizeClosetItem({
  id: "manual-1",
  name: "Black trousers",
  category: "trousers",
  color: "black",
  source: "manual",
});
assert.equal(legacy?.role, "bottom");
assert.equal(legacy?.gender, "female");

const sweater = normalizeClosetItem({
  id: "photo-sweater",
  name: "cream sweater",
  role: "sweater",
  color: "cream",
  source: "photo",
});
assert.equal(sweater?.role, "sweater");
assert.equal(sweater?.category, "knit");

const packet = closetToStylistPacket([
  {
    id: "photo-1",
    name: "Cream top",
    role: "top",
    category: "tee",
    color: "cream",
    cutoutUrl: "https://example.com/cutout.png",
    source: "photo",
    gender: "female",
  },
]);
assert.equal(packet.length, 1);
assert.equal(packet[0].role, "top");
assert.equal(packet[0].image, "https://example.com/cutout.png");
assert.equal(packet[0].gender, "female");

const huge = `data:image/png;base64,${"A".repeat(100_000)}`;
const stripped = closetToStylistPacket([
  { ...legacy, id: "photo-2", cutoutUrl: huge, imageDataUrl: huge, source: "photo" },
]);
assert.equal(stripped[0].image, undefined);
assert.equal(stripped[0].id, "photo-2");

assert.equal(parseClosetPacket("[]"), undefined);
assert.equal(parseClosetPacket(packet)?.length, 1);

const fromImageField = parseClosetPacket([
  {
    id: "photo-roundtrip",
    role: "dress",
    name: "Black slip",
    color: "black",
    image: "https://example.com/slip.png",
    source: "manual",
    gender: "female",
  },
]);
assert.equal(fromImageField?.[0].image, "https://example.com/slip.png");

const capped = closetToStylistPacket(
  Array.from({ length: 12 }, (_, i) => ({
    id: `p-${i}`,
    name: `Piece ${i}`,
    role: "top",
    category: "tee",
    color: "black",
    source: "manual",
    gender: "female",
  }))
);
assert.equal(capped.length, 10);

assert.equal(suggestedClosetName("cream", "sweater"), "cream sweater");
assert.equal(suggestedClosetName("multi", "bottom"), "multicolor bottom");
assert.equal(parseClosetColor("multi"), "multi");
assert.ok(CLOSET_COLOR_CHIPS.includes("multi"));
assert.ok("multi" in COLOR_SWATCH);

// Wide-leg pants (Missoni-like): tall + moderate width → bottom, not dress.
assert.equal(roleFromCutoutHints("", 250, 400), "bottom"); // 1.60 tall, 0.63 wide
assert.equal(roleFromCutoutHints("", 200, 280), "bottom"); // 1.40 tall, 0.71 wide
assert.equal(roleFromCutoutHints("", 220, 400), "bottom"); // 1.82 tall, 0.55 wide
// Very tall skinny column → dress.
assert.equal(roleFromCutoutHints("", 140, 380), "dress");
assert.equal(roleFromCutoutHints("", 160, 400), "dress");
// Sweater-ish / shoes.
assert.equal(roleFromCutoutHints("", 220, 200), "top");
assert.equal(roleFromCutoutHints("", 300, 180), "shoes");
// Name + mask silhouette win over skinny aspect.
assert.equal(roleFromCutoutHints("missoni pants", 140, 380), "bottom");
assert.equal(roleFromCutoutHints("", 140, 380, "other", "bottom"), "bottom");

function repeatRgb(rgb, n) {
  const rs = [];
  const gs = [];
  const bs = [];
  for (let i = 0; i < n; i++) {
    rs.push(rgb[0]);
    gs.push(rgb[1]);
    bs.push(rgb[2]);
  }
  return { rs, gs, bs };
}
function concatRgb(...parts) {
  const rs = [];
  const gs = [];
  const bs = [];
  for (const p of parts) {
    rs.push(...p.rs);
    gs.push(...p.gs);
    bs.push(...p.bs);
  }
  return { rs, gs, bs };
}

const navy = repeatRgb([30, 42, 90], 80);
const navySpread = hueChromaSpread(navy.rs, navy.gs, navy.bs);
assert.equal(navySpread.multiHue, false);
assert.equal(nearestColorId(30, 42, 90, navySpread), "navy");

// Zigzag / Missoni: rust + mustard + teal + pink.
const zigzag = concatRgb(
  repeatRgb([196, 72, 36], 50),
  repeatRgb([214, 176, 42], 50),
  repeatRgb([36, 128, 138], 50),
  repeatRgb([216, 96, 142], 50)
);
const zigSpread = hueChromaSpread(zigzag.rs, zigzag.gs, zigzag.bs);
assert.equal(zigSpread.multiHue, true);
assert.equal(nearestColorId(160, 120, 90, zigSpread), "multi");

console.log("closet packet + cap + sweater/cardigan + auto-name + pants/multi checks ok");
