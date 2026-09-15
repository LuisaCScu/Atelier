import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { guessHairColor, guessSkinToneBand, parseAppearance, parseLookAge } from "../src/lib/appearance.ts";
import { FAV_COLOR_PRESETS, parseFavColors, toggleFavColor } from "../src/lib/fav-colors.ts";
import { FALL_26_TREND_TICKERS, pacificCalendarDay, trendTickerForDay } from "../src/lib/seasonal-clash.ts";
import { dedupeStyleCards, selectStyleDeck, STYLE_CARD_VISUAL_KEY } from "../src/lib/style-cards.ts";
import { buildStylistRequest, FITTINGS_PARKED } from "../src/lib/stylist-contract.ts";

assert.equal(parseLookAge("mid"), "mid");
assert.equal(parseLookAge("teen"), undefined);
assert.equal(guessHairColor(30, 10), "black");
assert.equal(guessSkinToneBand(200), "fair");
assert.equal(parseAppearance({ hairColor: "blonde", eyes: "green" })?.hairColor, "blonde");

const favs = toggleFavColor([], { name: "Navy", hex: "#1e2a4a" });
assert.equal(parseFavColors(favs).length, 1);

const session = {
  name: "Luisa",
  path: "deep",
  size: "S",
  occasions: ["weekend"],
  colors: [],
  vibes: [],
  priorities: [],
  hardNos: [],
  notes: "",
  budgetMin: 80,
  budgetMax: 280,
  likedStyleIds: [],
  dislikedStyleIds: [],
  deepDone: {},
  seed: 2,
  lookAge: "mid",
  favColors: favs,
  appearance: { hairColor: "brunette", hairLength: "long", eyes: "brown", skinToneBand: "medium" },
};
const req = buildStylistRequest(session);
assert.equal(req.lookAge, "mid");
assert.equal(req.favColors?.[0].name, "Navy");
assert.equal(req.appearance?.hairColor, "brunette");
assert.equal(req.gender, "female");
assert.equal(req.styleSignals, undefined);
assert.equal(req.lookCount, 4);
assert.equal(req.tier, "free");
if (FITTINGS_PARKED) {
  assert.equal(req.fittingCount, 0);
  assert.equal(req.freeFirstBoard, false);
} else {
  assert.equal(req.freeFirstBoard, true);
  assert.equal(req.fittingCount, 3);
}

console.log("friend polish packet checks ok");

const names = new Set(FAV_COLOR_PRESETS.map((c) => c.name.toLowerCase()));
for (const need of ["blue", "navy", "black", "brown", "beige", "gray", "yellow", "orange", "red", "pink", "purple", "green"]) {
  assert.ok(names.has(need), `missing fav color ${need}`);
}
assert.ok(FALL_26_TREND_TICKERS.length >= 4);
assert.match(pacificCalendarDay(new Date("2026-09-13T10:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
assert.equal(typeof trendTickerForDay(), "string");

const deck = selectStyleDeck({ lookAge: "mixed" }, 14);
const ids = deck.map((c) => c.id);
assert.equal(new Set(ids).size, ids.length);
const visuals = deck.map((c) => STYLE_CARD_VISUAL_KEY[c.id] ?? c.id);
assert.equal(new Set(visuals).size, visuals.length, "deck must be unique by visualKey");
const navyGroup = deck.filter((c) => (STYLE_CARD_VISUAL_KEY[c.id] ?? c.id) === "dx-mat-coat-column");
assert.ok(navyGroup.length <= 1, "navy suit near-dups must not repeat in one deck");
const deduped = dedupeStyleCards(deck.concat(deck));
assert.equal(deduped.length, deck.length);

const appearanceApi = readFileSync(new URL("../src/app/api/appearance/guess/route.ts", import.meta.url), "utf8");
assert.match(appearanceApi, /openai\/gpt-4o-mini/);
assert.match(appearanceApi, /generateObject/);
assert.doesNotMatch(appearanceApi, /gpt-image|generateImage/);

const handoff = readFileSync(new URL("../src/lib/stylist.ts", import.meta.url), "utf8");
assert.match(handoff, /\[handoff-wake\]/);
assert.match(handoff, /STYLIST_INGEST_KEY/);

console.log("fav colors + quiz visual dedupe + vision + handoff ok");
