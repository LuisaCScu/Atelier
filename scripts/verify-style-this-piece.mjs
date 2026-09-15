import assert from "node:assert/strict";
import { lookFittingLocked } from "../src/lib/freemium.ts";
import { defaultSession } from "../src/lib/generate.ts";
import { FITTINGS_PARKED, 
  buildStylistRequest,
  parseClosetPieceId,
  parseGenerateMode,
  STYLIST_STYLE_THIS_PIECE_LOOK_COUNT,
} from "../src/lib/stylist-contract.ts";

assert.equal(parseGenerateMode("styleThisPiece"), "styleThisPiece");
assert.equal(parseGenerateMode("styleChat"), "styleChat");
assert.equal(parseGenerateMode("closetFirst"), "closetFirst");
assert.equal(parseGenerateMode("storeFirst"), "storeFirst");
assert.equal(parseGenerateMode("nope"), "storeFirst");
assert.equal(parseClosetPieceId(" photo-1 "), "photo-1");
assert.equal(parseClosetPieceId(""), undefined);

const session = defaultSession({
  name: "Luisa",
  likedStyleIds: ["sc-1"],
  hasUsedFreeBoard: false,
  hasPremium: false,
});

const closet = [
  {
    id: "photo-cream-knit",
    role: "top",
    name: "Cream knit",
    color: "cream",
    image: "https://example.com/cream.png",
    source: "photo",
    gender: "female",
  },
  {
    id: "photo-navy-trouser",
    role: "bottom",
    name: "Navy trouser",
    color: "navy",
    source: "manual",
    gender: "female",
  },
];

const req = buildStylistRequest(session, {
  generateMode: "styleThisPiece",
  closetPieceId: "photo-cream-knit",
  closet,
  tier: "free",
  freeFirstBoard: true, // must be ignored for this path
});

assert.equal(req.generateMode, "styleThisPiece");
assert.equal(req.closetPieceId, "photo-cream-knit");
assert.ok(req.closet?.some((p) => p.id === "photo-cream-knit"));
assert.equal(req.lookCount, STYLIST_STYLE_THIS_PIECE_LOOK_COUNT);
assert.ok(req.lookCount >= 2 && req.lookCount <= 3);
assert.equal(req.fittingCount, 0);
assert.equal(req.freeFirstBoard, false);
assert.equal(req.tier, "free");
assert.equal(req.gender, "female");

// Premium user still tiles-only on this path — no fittings/heroes intent.
const prem = buildStylistRequest(
  defaultSession({ hasPremium: true, hasUsedFreeBoard: true }),
  {
    generateMode: "styleThisPiece",
    closetPieceId: "photo-cream-knit",
    closet,
    tier: "premium",
  }
);
assert.equal(prem.fittingCount, 0);
assert.equal(prem.lookCount, 3);
assert.equal(prem.closetPieceId, "photo-cream-knit");
assert.equal(lookFittingLocked({ id: "l1", title: "A", hook: "", formula: "x", why: "y", pieces: [] }, 0, prem), true);

// Existing modes unchanged.
const closetFirst = buildStylistRequest(session, { generateMode: "closetFirst", closet });
assert.equal(closetFirst.generateMode, "closetFirst");
assert.equal(closetFirst.closetPieceId, undefined);
assert.equal(closetFirst.lookCount, 4);
assert.equal(closetFirst.fittingCount, FITTINGS_PARKED ? 0 : 3);

const storeFirst = buildStylistRequest(session, { generateMode: "storeFirst", closet });
assert.equal(storeFirst.generateMode, "storeFirst");
assert.equal(storeFirst.closetPieceId, undefined);
assert.equal(storeFirst.lookCount, 4);

console.log("styleThisPiece packet lock ok: mode + closetPieceId + closet[] + lookCount 2–3 + fittingCount 0");

import {
  closetToStylistPacket,
  parseClosetPacketForMode,
  shouldForceAllClosetImages,
} from "../src/lib/closet-packet.ts";
import { lookbookPathAfterRequest } from "../src/lib/stylist.ts";
import { normalizeClosetItem, roleFromNameHint } from "../src/lib/closet-roles.ts";

const huge = `data:image/png;base64,${"B".repeat(120_000)}`;
const focusPacket = closetToStylistPacket(
  [
    {
      id: "photo-1789155455558",
      name: "Missoni trousers",
      role: "top",
      category: "tee",
      color: "cream",
      cutoutUrl: huge,
      imageDataUrl: huge,
      source: "photo",
      gender: "female",
    },
    {
      id: "other-1",
      name: "Other top",
      role: "top",
      category: "tee",
      color: "black",
      cutoutUrl: huge,
      source: "photo",
      gender: "female",
    },
  ],
  { focusPieceId: "photo-1789155455558" }
);
const focus = focusPacket.find((p) => p.id === "photo-1789155455558");
const other = focusPacket.find((p) => p.id === "other-1");
assert.ok(focus?.image, "focus piece image must always be included");
assert.equal(focus.image, huge);
assert.equal(other?.image, undefined, "non-focus oversized image still stripped");
assert.equal(focus.role, "bottom", "trousers name → bottom role");

assert.equal(roleFromNameHint("Missoni trousers", "top"), "bottom");
assert.ok(["top", "sweater", "knit"].includes(roleFromNameHint("cream knit", "top") ?? ""));
assert.equal(normalizeClosetItem({ id: "x", name: "blue jeans", role: "top" })?.role, "bottom");

const redirect = lookbookPathAfterRequest({
  request: {
    requestId: "srq_test",
    generateMode: "styleThisPiece",
    closetPieceId: "photo-cream-knit",
  },
});
assert.ok(redirect.startsWith("/closet/photo-cream-knit?styling="), redirect);
assert.ok(!redirect.startsWith("/lookbook") && !redirect.startsWith("/style"), "styleThisPiece must not redirect to lookbook/style");

const storeRedirect = lookbookPathAfterRequest({
  request: { requestId: "srq_store", generateMode: "storeFirst" },
});
assert.ok(storeRedirect.includes("/style"), storeRedirect);
assert.ok(!storeRedirect.includes("/lookbook?"), "storeFirst lands on Style, not Lookbook archive");


// closetFirst / forceAllImages: EVERY piece keeps image even when each data URL > 90k
const hugeA = `data:image/png;base64,${"C".repeat(95_000)}`;
const hugeB = `data:image/png;base64,${"D".repeat(95_000)}`;
const closetFirstPacket = closetToStylistPacket(
  [
    {
      id: "cf-1",
      name: "Cream knit",
      role: "top",
      category: "tee",
      color: "cream",
      cutoutUrl: hugeA,
      imageDataUrl: hugeA,
      source: "photo",
      gender: "female",
    },
    {
      id: "cf-2",
      name: "Navy trouser",
      role: "bottom",
      category: "trousers",
      color: "navy",
      cutoutUrl: hugeB,
      imageDataUrl: hugeB,
      source: "photo",
      gender: "female",
    },
  ],
  { forceAllImages: true }
);
assert.equal(closetFirstPacket.length, 2);
assert.equal(closetFirstPacket[0].image, hugeA, "closetFirst piece 1 image forced");
assert.equal(closetFirstPacket[1].image, hugeB, "closetFirst piece 2 image forced");
assert.ok(closetFirstPacket.every((p) => p.image && p.image.length > 90_000));

assert.equal(shouldForceAllClosetImages("closetFirst", 0), true);
assert.equal(shouldForceAllClosetImages("storeFirst", 2), true);
assert.equal(shouldForceAllClosetImages("storeFirst", 0), false);
assert.equal(shouldForceAllClosetImages("styleThisPiece", 1), true);

const reparsed = parseClosetPacketForMode(
  [
    {
      id: "cf-1",
      role: "top",
      name: "Cream knit",
      color: "cream",
      image: hugeA,
      source: "photo",
      gender: "female",
    },
    {
      id: "cf-2",
      role: "bottom",
      name: "Navy trouser",
      color: "navy",
      image: hugeB,
      source: "photo",
      gender: "female",
    },
  ],
  "closetFirst"
);
assert.ok(reparsed);
assert.equal(reparsed[0].image, hugeA);
assert.equal(reparsed[1].image, hugeB);

console.log("closetFirst forceAllImages lock ok: all pieces keep >90k images + mode helper");
console.log("styleThisPiece UX lock ok: focus image always + role heuristic + closet redirect");

import { parseStylistResponse } from "../src/lib/stylist-contract.ts";

// tiles-only response: fittingLocked + no hero + closet piece without shopUrl must parse
const tilesOnlyBody = {
  kind: "atelier.stylistResponse.v1",
  requestId: "srq_tiles_parse",
  looks: [
    {
      id: "look-tiles-1",
      title: null,
      formula: "Cream knit + navy trouser",
      why: "Easy weekend polish.",
      fittingLocked: true,
      heroImage: "",
      pieces: [
        {
          id: "photo-cream-knit",
          role: "top",
          name: "Cream knit",
          // no brand / shopUrl / price — closet coerce
          image: "https://example.com/cream.png",
        },
        {
          id: "store-navy-trouser",
          role: "trousers",
          brand: "Demo",
          name: "Navy trouser",
          price: 120,
          currency: "USD",
          image: "https://example.com/navy.png",
          shopUrl: "#demo-stub",
        },
      ],
    },
  ],
};

const parsedTiles = parseStylistResponse(tilesOnlyBody, { tilesOnly: true });
assert.ok(parsedTiles, "tiles-only response must parse");
assert.equal(parsedTiles.looks[0].title, "Cream knit + navy trouser");
assert.equal(parsedTiles.looks[0].fittingLocked, true);
assert.equal(parsedTiles.looks[0].heroImage, "");
const closetPiece = parsedTiles.looks[0].pieces.find((p) => p.id === "photo-cream-knit");
assert.ok(closetPiece, "closet piece present");
assert.equal(closetPiece.brand, "Closet");
assert.ok(typeof closetPiece.shopUrl === "string");
assert.equal(closetPiece.price, 0);

const lockedNoContext = parseStylistResponse({
  kind: "atelier.stylistResponse.v1",
  requestId: "srq_locked_only",
  looks: [
    {
      id: "look-locked",
      formula: "Locked look",
      whyFit: "Fit note.",
      fittingLocked: true,
      pieces: [
        {
          id: "closet-owned-1",
          role: "dress",
          name: "Linen dress",
          image: "",
          source: "closet",
        },
      ],
    },
  ],
});
assert.ok(lockedNoContext, "fittingLocked without tilesOnly option must still parse");
assert.equal(lockedNoContext.looks[0].title, "Locked look");
assert.equal(lockedNoContext.looks[0].pieces[0].shopUrl.includes("closet") || lockedNoContext.looks[0].pieces[0].shopUrl === "", true);

console.log("styleThisPiece ingest parse ok: tiles-only + fittingLocked + closet shopUrl coerce");
