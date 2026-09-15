import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FITTINGS_PARKED } from "../src/lib/stylist-contract.ts";
import { isTilesOnlyHeroSkip, requiredFittingUrls } from "../src/lib/hero-ready.ts";
import { buildLookFingerprint, LOOK_CACHE_NAMESPACE, redisLookCacheKey } from "../src/lib/look-cache.ts";
import { defaultSession } from "../src/lib/generate.ts";

assert.equal(FITTINGS_PARKED, true);

const tilesResponse = {
  kind: "atelier.stylistResponse.v1",
  requestId: "srq_test",
  looks: [
    {
      id: "look-1",
      title: "Test",
      pieces: [],
      why: "because",
      fittingLocked: true,
    },
  ],
};

assert.equal(isTilesOnlyHeroSkip(tilesResponse, { tilesOnly: true }), true);
assert.deepEqual(requiredFittingUrls(tilesResponse), []);

const unlocked = {
  ...tilesResponse,
  looks: [{ ...tilesResponse.looks[0], fittingLocked: false, heroImage: "https://example.com/x.png" }],
};
// While parked, still skip.
assert.equal(isTilesOnlyHeroSkip(unlocked), true);
assert.deepEqual(requiredFittingUrls(unlocked), []);

const session = defaultSession({ name: "Luisa", likedStyleIds: ["sc-1"] });
const fp = buildLookFingerprint({
  session,
  generateMode: "storeFirst",
  closetPieceIds: ["photo-a", "photo-b"],
  focusPieceId: null,
});
assert.equal(typeof fp, "string");
assert.equal(fp.length, 32);
assert.equal(LOOK_CACHE_NAMESPACE, "look-cache:v3-tiles");
assert.equal(redisLookCacheKey(fp), `look-cache:v3-tiles:${fp}`);

const fp2 = buildLookFingerprint({
  session,
  generateMode: "closetFirst",
  closetPieceIds: ["photo-a", "photo-b"],
});
assert.notEqual(fp, fp2);

// Vote / avoid history must bust fingerprint (never remap prior board as new Create).
const afterVote = {
  ...session,
  lookFeedback: [
    {
      requestId: "srq_old",
      lookId: "look-1",
      vote: "dislike",
      reasons: ["wrong-shoes"],
      at: new Date().toISOString(),
      look: { pieces: [{ id: "shoe-bad", role: "shoes", name: "Chunky sneaker" }] },
    },
  ],
  styleSignals: {
    kind: "atelier.styleSignals.v1",
    source: "swipe-quiz+look-feedback",
    swipe: { shown: 0, liked: 0, disliked: 0 },
    lean: {},
    leanScale: {},
    tags: { liked: [], disliked: [] },
    feedback: { lookVotes: 1, lastLookId: "look-1", lastVote: "dislike", lastReasons: ["wrong-shoes"] },
    avoid: { pieceIds: ["shoe-bad"], classes: [], lookIds: ["look-1"] },
  },
};
const fp3 = buildLookFingerprint({ session: afterVote, generateMode: "storeFirst", closetPieceIds: ["photo-a", "photo-b"] });
assert.notEqual(fp, fp3, "fp after dislike must change");

// No user-facing "couple minutes" in components.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/components");
const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full);
    else if (/\.(tsx|ts|jsx|js)$/.test(name.name)) {
      const text = readFileSync(full, "utf8");
      if (/couple minutes/i.test(text) || /usually ready in about 2 minutes/i.test(text)) {
        hits.push(path.relative(root, full));
      }
    }
  }
}
walk(root);
assert.deepEqual(hits, [], `forbidden minute copy still in: ${hits.join(", ")}`);

console.log("tiles-ready + look-cache + copy checks ok");
