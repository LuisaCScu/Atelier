import assert from "node:assert/strict";
import {
  applyLookFeedback,
  ensurePacketStyleSignals,
  lookIsBeigeNeutral,
  lookIsFullyCovered,
  normalizeLockedReasonId,
  parseStyleSignals,
  pickLookDislikeReasons,
  toStylistStyleSignals,
} from "../src/lib/style-signals.ts";

assert.equal(normalizeLockedReasonId("prefer-less-beige"), "too-beige");
assert.equal(normalizeLockedReasonId("over-budget"), "too-expensive");
assert.equal(normalizeLockedReasonId("Too beige / too muted"), undefined);
assert.equal(normalizeLockedReasonId("skip"), "skip");

const beigeLook = {
  title: "Camel knit column",
  hook: "Cream and stone, quiet",
  formula: "Camel knit + cream trouser + stone loafer",
  why: "Muted beige layers, high-neck midi coverage.",
  pieces: [
    { id: "knit-1", role: "knit", name: "Camel turtleneck", price: 90 },
    { id: "trouser-1", role: "trousers", name: "Cream midi trouser", price: 80 },
    { id: "shoe-1", role: "shoes", name: "Stone loafer", price: 70 },
  ],
};
assert.equal(lookIsBeigeNeutral(beigeLook), true);
assert.equal(lookIsFullyCovered(beigeLook), true);
const beigeReasons = pickLookDislikeReasons(beigeLook, { budgetMax: 280 });
assert.equal(beigeReasons.length, 4);
assert.ok(beigeReasons.every((item) => item.id && item.label));
assert.ok(beigeReasons.some((item) => item.id === "too-beige"));
assert.ok(!beigeReasons.some((item) => item.id === "too-colorful"));
assert.ok(!beigeReasons.some((item) => item.id === "too-revealing"));

const loudLook = {
  title: "Cobalt night",
  hook: "Bright fuchsia crop",
  formula: "Cobalt blazer + fuchsia crop + mini",
  why: "Colorful and low-cut.",
  pieces: [
    { id: "top-1", role: "top", name: "Fuchsia crop", price: 220 },
    { id: "bottom-1", role: "bottom", name: "Mini skirt", price: 90 },
    { id: "bag-1", role: "bag", name: "Statement tote", price: 40 },
    { id: "acc-1", role: "accessory", name: "Belt", price: 30 },
  ],
};
const loudReasons = pickLookDislikeReasons(loudLook, { budgetMax: 250 });
assert.equal(loudReasons.length, 4);
assert.ok(loudReasons.some((item) => item.id === "too-colorful" || item.id === "too-revealing" || item.id === "too-expensive"));
assert.ok(!loudReasons.some((item) => item.id === "too-beige"));

const beigeVote = applyLookFeedback(undefined, {
  vote: "dislike",
  lookId: "look-beige",
  reasons: ["prefer-less-beige"],
  look: beigeLook,
});
assert.ok((beigeVote.lean.colorIntensity ?? 0) > 0);
assert.ok(beigeVote.tags.disliked.includes("avoid-beige"));
assert.deepEqual(beigeVote.feedback?.lastReasons, ["too-beige"]);

const spendy = applyLookFeedback(beigeVote, {
  vote: "dislike",
  lookId: "look-loud",
  reasons: ["too-expensive"],
  look: loudLook,
});
assert.ok((spendy.budgetBias ?? 0) > 0);
assert.ok(spendy.tags.disliked.includes("price-sensitive"));

const avoidVote = applyLookFeedback(undefined, {
  vote: "dislike",
  lookId: "look-loud",
  reasons: ["wont-wear-again"],
  look: loudLook,
});
assert.ok(avoidVote.avoid?.pieceIds.includes("top-1"));
assert.ok((avoidVote.avoid?.classes.length ?? 0) > 0);

const skipVote = applyLookFeedback(undefined, {
  vote: "dislike",
  lookId: "look-beige",
  reasons: ["skip"],
  look: beigeLook,
});
assert.deepEqual(skipVote.feedback?.lastReasons, ["skip"]);
assert.equal(skipVote.budgetBias, undefined);

const shoeLook = {
  title: "Sneaker day",
  formula: "Tee + denim + chunky sneaker",
  why: "Casual",
  pieces: [
    { id: "tee-1", role: "tee", name: "White tee", price: 40 },
    { id: "denim-1", role: "bottom", name: "Denim", price: 90 },
    { id: "shoe-bad", role: "shoes", name: "Chunky sneaker", price: 120 },
  ],
};
const shoeVote = applyLookFeedback(undefined, {
  vote: "dislike",
  lookId: "look-shoes",
  reasons: ["wrong-shoes"],
  look: shoeLook,
});
assert.ok(shoeVote.avoid?.pieceIds.includes("shoe-bad"), "wrong-shoes bans shoe");
assert.ok(shoeVote.avoid?.pieceIds.includes("tee-1"), "dislike bans look pieces");
assert.deepEqual(shoeVote.feedback?.lastReasons, ["wrong-shoes"]);
assert.ok(shoeVote.avoid?.lookIds?.includes("look-shoes"));

const packet = toStylistStyleSignals(spendy);
assert.ok(packet?.budgetBias);
assert.deepEqual(packet?.feedback?.lastReasons, ["too-expensive"]);

const parsed = parseStyleSignals(spendy);
assert.ok(parsed?.avoid || parsed?.budgetBias);

const ensured = ensurePacketStyleSignals(shoeVote);
assert.ok(Array.isArray(ensured.avoid.pieceIds));
assert.ok(ensured.avoid.pieceIds.includes("shoe-bad"));
assert.equal(ensured.feedback.lastLookId, "look-shoes");
assert.deepEqual(ensured.feedback.lastReasons, ["wrong-shoes"]);

console.log("verify-look-dislike ok", {
  beige: beigeReasons.map((item) => item.id),
  loud: loudReasons.map((item) => item.id),
});
