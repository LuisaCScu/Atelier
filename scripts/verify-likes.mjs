import assert from "node:assert/strict";
import { parseHeroCacheKey, redisHeroKey } from "../src/lib/hero-cache.ts";
import { FITTINGS_PARKED } from "../src/lib/stylist-contract.ts";
import {
  applyLookVoteToHistory,
  likedLookFromVote,
  likedLookId,
  loadLikedLooks,
  normalizeLikedVote,
  removeLikedLook,
  saveLikedLooks,
  voteKeepsHistory,
} from "../src/lib/liked-looks.ts";
import {
  filterActiveBoardLooks,
  isClearDislike,
  isMaybeVote,
  isSavedArchiveVote,
  isWearVote,
  lookLeavesActiveBoard,
  unvotedActiveBoardLooks,
} from "../src/lib/home-lookbook.ts";

assert.equal(normalizeLikedVote("wear"), "like");
assert.equal(normalizeLikedVote("maybe"), "skip");
assert.equal(normalizeLikedVote("no"), "dislike");
assert.equal(normalizeLikedVote("like"), "like");
assert.equal(voteKeepsHistory("wear"), true);
assert.equal(voteKeepsHistory("maybe"), true);
assert.equal(voteKeepsHistory("no"), false);

const look = {
  id: "look-1",
  title: "Paddock",
  hook: "Soft structure",
  formula: "Coat + knit + trouser",
  why: "Quiet layers.",
  heroImage: "https://atelier-theta-one.vercel.app/looks/heroes/demo.png",
  pieces: [
    {
      id: "coat-a",
      role: "outerwear",
      brand: "Toteme",
      name: "Coat",
      price: 210,
      currency: "USD",
      image: "https://example.com/coat.png",
      shopUrl: "https://example.com/coat",
    },
  ],
  levelUp: [
    {
      id: "bag-a",
      role: "bag",
      brand: "Everlane",
      name: "Boxy Tote",
      price: 180,
      currency: "USD",
      image: "https://example.com/bag.png",
      shopUrl: "https://example.com/bag",
    },
  ],
};

const saved = likedLookFromVote({ requestId: "srq_1", look, vote: "wear" });
assert.ok(saved);
assert.equal(saved.id, likedLookId("srq_1", "look-1"));
assert.equal(saved.fittingUrl, FITTINGS_PARKED ? "" : look.heroImage);
assert.equal(saved.pieces[0].id, "coat-a");
assert.equal(saved.levelUp?.[0]?.id, "bag-a");
assert.equal(likedLookFromVote({ requestId: "srq_1", look, vote: "no" }), null);

const g = globalThis;
const store = new Map();
g.window = {
  localStorage: {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  },
  dispatchEvent: () => {},
};

saveLikedLooks([]);
applyLookVoteToHistory({ requestId: "srq_1", look, vote: "wear" });
assert.equal(loadLikedLooks().length, 1);
applyLookVoteToHistory({ requestId: "srq_1", look, vote: "maybe" });
assert.equal(loadLikedLooks()[0].vote, "maybe");
applyLookVoteToHistory({ requestId: "srq_1", look, vote: "no" });
assert.equal(loadLikedLooks().length, 0);
applyLookVoteToHistory({ requestId: "srq_1", look, vote: "like" });
removeLikedLook("srq_1", "look-1");
assert.equal(loadLikedLooks().length, 0);

assert.equal(parseHeroCacheKey("fair-neutral__coat-a,knit-b"), "fair-neutral__coat-a,knit-b");
assert.equal(redisHeroKey("fair-neutral__coat-a,knit-b"), "hero-cache:v1:fair-neutral__coat-a,knit-b");

assert.equal(isClearDislike("no"), true);
assert.equal(isWearVote("wear"), true);
assert.equal(isMaybeVote("maybe"), true);
assert.equal(isMaybeVote("skip"), true);
assert.equal(isSavedArchiveVote("maybe"), true);
assert.equal(isSavedArchiveVote("wear"), true);
assert.equal(lookLeavesActiveBoard("maybe"), true);
assert.equal(lookLeavesActiveBoard("skip"), true);
assert.equal(lookLeavesActiveBoard("no"), true);
assert.equal(lookLeavesActiveBoard("like"), true);
assert.equal(lookLeavesActiveBoard(undefined), false);

const boardLooks = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const votes = [
  { lookId: "a", vote: "dislike", requestId: "srq_1" },
  { lookId: "b", vote: "like", requestId: "srq_1" },
  { lookId: "c", vote: "skip", requestId: "srq_1" },
];
// Wear + Maybe/skip + No leave; only unvoted "d" remains.
assert.deepEqual(
  filterActiveBoardLooks(boardLooks, votes, "srq_1").map((item) => item.id),
  ["d"]
);
assert.deepEqual(
  unvotedActiveBoardLooks(boardLooks, votes, "srq_1").map((item) => item.id),
  ["d"]
);
assert.deepEqual(
  filterActiveBoardLooks(boardLooks, votes, "srq_1", { lingerIds: ["b", "c"] }).map((item) => item.id),
  ["b", "c", "d"]
);

console.log("liked history + look disposition + hero-cache isolation checks ok");
