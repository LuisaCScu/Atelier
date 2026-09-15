import assert from "node:assert/strict";
import { applyFreeBoardFittings, generateAccess, isFreeFirstBoard, lookFittingLocked } from "../src/lib/freemium.ts";
import { defaultSession } from "../src/lib/generate.ts";
import { buildStylistRequest, FITTINGS_PARKED, parseStylistResponse, STYLIST_LOOK_COUNT } from "../src/lib/stylist-contract.ts";
import { countsTowardUserGenerate } from "../src/lib/stylist-budget.ts";

const first = defaultSession({ name: "Luisa", likedStyleIds: ["sc-1", "sc-2"] });
assert.equal(generateAccess(first), "free");
const freeReq = buildStylistRequest(first, { tier: "free", freeFirstBoard: true });
assert.equal(freeReq.lookCount, STYLIST_LOOK_COUNT);
assert.equal(freeReq.tier, "free");
assert.equal(freeReq.gender, "female");
if (FITTINGS_PARKED) {
  assert.equal(freeReq.fittingCount, 0);
  assert.equal(freeReq.freeFirstBoard, false);
  assert.equal(isFreeFirstBoard(freeReq), false);
} else {
  assert.equal(freeReq.freeFirstBoard, true);
  assert.equal(freeReq.fittingCount, 3);
  assert.equal(isFreeFirstBoard(freeReq), true);
}

// After first board without Premium: still free create — never gated.
const used = defaultSession({ hasUsedFreeBoard: true, hasPremium: false });
assert.equal(generateAccess(used), "free");
const laterFree = buildStylistRequest(used, { tier: "free", freeFirstBoard: false });
assert.equal(laterFree.freeFirstBoard, false);
assert.equal(laterFree.fittingCount, 0);
assert.equal(isFreeFirstBoard(laterFree), false);
// Later free boards: all looks fitting-locked (tiles-only).
assert.equal(lookFittingLocked({ id: "l1", title: "A", hook: "", formula: "", why: "", pieces: [] }, 0, laterFree), true);
assert.equal(lookFittingLocked({ id: "l2", title: "B", hook: "", formula: "", why: "", pieces: [] }, 3, laterFree), true);

const premium = defaultSession({ hasUsedFreeBoard: true, hasPremium: true });
assert.equal(generateAccess(premium), "premium");
const premReq = buildStylistRequest(premium, { tier: "premium", freeFirstBoard: false });
assert.equal(premReq.freeFirstBoard, false);
assert.equal(premReq.tier, "premium");
if (FITTINGS_PARKED) {
  assert.equal(premReq.fittingCount, 0);
  assert.equal(lookFittingLocked({ id: "l1", title: "A", hook: "", formula: "", why: "", pieces: [] }, 0, premReq), true);
} else {
  assert.equal(premReq.fittingCount, 4);
  assert.equal(lookFittingLocked({ id: "l1", title: "A", hook: "", formula: "", why: "", pieces: [] }, 0, premReq), false);
}

const piece = {
  id: "p1",
  role: "knit",
  brand: "Atelier Demo",
  name: "Crew",
  price: 88,
  currency: "USD",
  image: "https://example.com/tile.png",
  shopUrl: "https://example.com/shop",
};

const lockedLook = {
  id: "look-4",
  title: "Harbor",
  hook: "Weekend denim",
  formula: "Knit + jean + loafer",
  why: "Recipe stays shoppable without a fourth fitting.",
  pieces: [piece],
};

const parsed = parseStylistResponse({
  kind: "atelier.stylistResponse.v1",
  requestId: "srq_free_test",
  looks: [
    { ...lockedLook, id: "look-1", heroImage: "https://example.com/fitting-1.png" },
    { ...lockedLook, id: "look-2", heroImage: "https://example.com/fitting-2.png" },
    { ...lockedLook, id: "look-3", heroImage: "https://example.com/fitting-3.png" },
    lockedLook,
  ],
});
assert.ok(parsed);
assert.equal(parsed.looks.length, 4);
assert.equal(parsed.looks[3].heroImage, "");
assert.equal(parsed.looks[3].fittingLocked, false);

const withLock = applyFreeBoardFittings(parsed.looks, true);
assert.equal(withLock[3].fittingLocked, true);
if (FITTINGS_PARKED) {
  // Tiles-only: every look fitting-locked on free boards.
  assert.equal(lookFittingLocked(withLock[3], 3, freeReq), true);
  assert.equal(lookFittingLocked(withLock[0], 0, freeReq), true);
} else {
  assert.equal(withLock[0].fittingLocked, false);
  assert.equal(lookFittingLocked(withLock[3], 3, freeReq), true);
  assert.equal(lookFittingLocked(withLock[0], 0, freeReq), false);
}

// Default freeFirstBoard when session has not used free board (parked → always tiles-only).
const autoFirst = buildStylistRequest(first);
const autoLater = buildStylistRequest(used);
assert.equal(autoLater.freeFirstBoard, false);
assert.equal(autoLater.fittingCount, 0);
if (FITTINGS_PARKED) {
  assert.equal(autoFirst.freeFirstBoard, false);
  assert.equal(autoFirst.fittingCount, 0);
} else {
  assert.equal(autoFirst.freeFirstBoard, true);
  assert.equal(autoFirst.fittingCount, 3);
}

// userGenerate meters fitting boards only
assert.equal(countsTowardUserGenerate(laterFree), false);
assert.equal(countsTowardUserGenerate({ generateMode: "styleThisPiece", fittingCount: 0 }), false);
assert.equal(countsTowardUserGenerate({ generateMode: "styleThisPiece" }), false);
assert.equal(countsTowardUserGenerate({ generateMode: "storeFirst", fittingCount: 0 }), false);
assert.equal(countsTowardUserGenerate({ generateMode: "storeFirst", fittingCount: 3 }), true);
if (FITTINGS_PARKED) {
  assert.equal(countsTowardUserGenerate(freeReq), false);
  assert.equal(countsTowardUserGenerate(premReq), false);
} else {
  assert.equal(countsTowardUserGenerate(freeReq), true);
  assert.equal(countsTowardUserGenerate(premReq), true);
}

console.log("freemium lock: free create + fittings-parked tiles-only ok");
