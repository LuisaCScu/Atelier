import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  countsTowardFreeDailyGenerate,
  FREE_CLOSET_ITEM_CAP,
  FREE_DAILY_GENERATE_LIMIT,
  FREE_LOOKBOOK_SAVE_CAP,
  lookbookSaveCap,
} from "../src/lib/freemium.ts";
import { defaultSession } from "../src/lib/generate.ts";
import { CLOSET_FREE_CAP } from "../src/lib/types.ts";
import { inferOccasionId, styleChatPacketFromInput } from "../src/lib/style-chat.ts";
import {
  buildStylistRequest,
  FITTINGS_PARKED,
  lookMixCaption,
  parseGenerateMode,
  STYLE_CHAT_LOOK_MIX,
  STYLIST_LOOK_COUNT,
} from "../src/lib/stylist-contract.ts";
import { canSaveLikedLook } from "../src/lib/liked-looks.ts";
import { shouldAutoFirstStoreFirst } from "../src/lib/onboarding.ts";

assert.equal(parseGenerateMode("styleChat"), "styleChat");
assert.equal(parseGenerateMode("closetFirst"), "closetFirst");
assert.equal(parseGenerateMode("nope"), "storeFirst");

assert.equal(STYLE_CHAT_LOOK_MIX.length, 4);
assert.equal(STYLE_CHAT_LOOK_MIX[0].source, "mixCloset");
assert.equal(STYLE_CHAT_LOOK_MIX[0].closet, "mostly");
assert.equal(STYLE_CHAT_LOOK_MIX[1].closet, "mix");
assert.equal(STYLE_CHAT_LOOK_MIX[2].closet, "mix");
assert.equal(STYLE_CHAT_LOOK_MIX[3].source, "storeNew");
assert.equal(STYLE_CHAT_LOOK_MIX[3].closet, "none");
assert.equal(lookMixCaption("storeNew"), "Store");

assert.equal(inferOccasionId("dinner with friends"), "night");
assert.equal(inferOccasionId("client meeting downtown"), "work");
assert.equal(inferOccasionId("airport travel day"), "travel");
assert.equal(inferOccasionId("just something easy"), "weekend");

const inferred = styleChatPacketFromInput({ occasionNote: "wedding in June, not too formal" });
assert.equal(inferred.occasions[0], "event");
assert.match(inferred.occasionNote ?? "", /wedding/);

const session = defaultSession({
  name: "Luisa",
  likedStyleIds: ["sc-1", "sc-2"],
  styleBrief: "dinner, keep it easy",
});
const req = buildStylistRequest(session, {
  generateMode: "styleChat",
  occasions: ["night"],
  occasionNote: "dinner, keep it easy",
  closet: [
    {
      id: "photo-1",
      role: "top",
      name: "Cream knit",
      gender: "female",
      source: "photo",
    },
  ],
});

assert.equal(req.generateMode, "styleChat");
assert.equal(req.lookCount, STYLIST_LOOK_COUNT);
assert.equal(req.lookCount, 4);
assert.equal(req.occasions[0], "night");
assert.equal(req.occasionNote, "dinner, keep it easy");
assert.ok(req.lookMix);
assert.deepEqual(
  req.lookMix.map((slot) => slot.closet),
  ["mostly", "mix", "mix", "none"]
);
assert.equal(req.fittingCount, FITTINGS_PARKED ? 0 : req.fittingCount);
assert.ok(req.closet?.some((piece) => piece.id === "photo-1"));

assert.equal(FREE_DAILY_GENERATE_LIMIT, 1);
assert.equal(FREE_CLOSET_ITEM_CAP, 10);
assert.equal(FREE_CLOSET_ITEM_CAP, CLOSET_FREE_CAP);
assert.equal(FREE_LOOKBOOK_SAVE_CAP, 10);
assert.equal(lookbookSaveCap(false), 10);
assert.equal(lookbookSaveCap(true), 40);

assert.equal(countsTowardFreeDailyGenerate(req, "free"), true);
assert.equal(countsTowardFreeDailyGenerate(req, "premium"), false);
assert.equal(
  countsTowardFreeDailyGenerate({ generateMode: "styleThisPiece", lookCount: 3 }, "free"),
  false
);

assert.equal(shouldAutoFirstStoreFirst(session), false);

assert.equal(canSaveLikedLook(new Array(10).fill({ id: "x" }), "new-id", false), false);
assert.equal(canSaveLikedLook(new Array(10).fill({ id: "x" }), "x", false), true);
assert.equal(canSaveLikedLook(new Array(10).fill({ id: "x" }), "new-id", true), true);

const chat = readFileSync(new URL("../src/components/style-generate-chat.tsx", import.meta.url), "utf8");
assert.match(chat, /generateMode="styleChat"/);
assert.match(chat, /occasionNote/);
assert.match(chat, /Get 4 looks/);

const ctas = readFileSync(new URL("../src/components/style-generate-ctas.tsx", import.meta.url), "utf8");
assert.match(ctas, /StyleGenerateChat/);
assert.doesNotMatch(ctas, /Create new looks/);

console.log("style chat generate: occasion packet + 4-look mix + freemium caps ok");
