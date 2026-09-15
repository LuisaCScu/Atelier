import assert from "node:assert/strict";
import { parseHeroCacheKey, parseHeroImageUrl, redisHeroKey } from "../src/lib/hero-cache.ts";

assert.equal(parseHeroCacheKey("fair-neutral__coat-a,knit-b"), "fair-neutral__coat-a,knit-b");
assert.equal(parseHeroCacheKey("short"), null);
assert.equal(parseHeroCacheKey("no-separator-here"), null);
assert.equal(parseHeroCacheKey("ok__ids"), "ok__ids");

assert.equal(
  parseHeroImageUrl("https://atelier-theta-one.vercel.app/looks/heroes/lp-harbor-everyday-denim-worn.png"),
  "https://atelier-theta-one.vercel.app/looks/heroes/lp-harbor-everyday-denim-worn.png"
);
assert.equal(parseHeroImageUrl("https://atelier-assets.vercel.app/looks/heroes/demo.png")?.includes("atelier-assets"), true);
assert.equal(parseHeroImageUrl("data:image/png;base64,AAAA"), null);
assert.equal(parseHeroImageUrl("https://images.unsplash.com/photo"), null);
assert.equal(parseHeroImageUrl("http://atelier-theta-one.vercel.app/looks/heroes/x.png"), null);

assert.equal(redisHeroKey("fair-neutral__a,b"), "hero-cache:v1:fair-neutral__a,b");

console.log("hero-cache key + url checks ok");
