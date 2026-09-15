import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultSession } from "../src/lib/generate.ts";
import { isReturningSignedIn, shouldAutoFirstStoreFirst } from "../src/lib/onboarding.ts";
import { FIRST_BOARD_AUTO_KEY, NAV_TOUR_KEY } from "../src/lib/types.ts";

assert.equal(NAV_TOUR_KEY, "atelier.navTour.v1");
assert.equal(FIRST_BOARD_AUTO_KEY, "atelier.firstBoardAuto.v1");

const bare = defaultSession({ name: "Luisa" });
assert.equal(isReturningSignedIn(bare), false);
assert.equal(shouldAutoFirstStoreFirst(bare), false);

const midQuiz = defaultSession({
  name: "Luisa",
  likedStyleIds: ["sc-1", "sc-2"],
});
assert.equal(isReturningSignedIn(midQuiz), false);

const ready = defaultSession({
  name: "Luisa",
  likedStyleIds: ["sc-1", "sc-2"],
  deepDone: { budget: true },
});
assert.equal(isReturningSignedIn(ready), true);
assert.equal(shouldAutoFirstStoreFirst(ready), false);

const used = defaultSession({
  name: "Luisa",
  deepDone: { budget: true },
  hasUsedFreeBoard: true,
  stylistRequestId: "srq_1",
});
assert.equal(isReturningSignedIn(used), true);
assert.equal(shouldAutoFirstStoreFirst(used), false);

const voted = defaultSession({
  name: "Luisa",
  deepDone: { budget: true },
  lookFeedback: [{ lookId: "l1", vote: "like" }],
});
assert.equal(shouldAutoFirstStoreFirst(voted), false);
assert.equal(shouldAutoFirstStoreFirst(ready, { lookVoteCount: 1 }), false);

const home = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const landing = readFileSync(new URL("../src/components/landing-magazine.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../src/components/landing-login.tsx", import.meta.url), "utf8");
assert.match(landing, /Create a profile/);
assert.match(landing, /href="\/personalize"/);
assert.match(login, /Log in/);
assert.match(login, /SESSION_COOKIE/);
assert.match(login, /No saved profile on this device/);
assert.doesNotMatch(home + landing + login, /Instagram/);
assert.doesNotMatch(home, /Add to closet/);
assert.doesNotMatch(home, /Want fittings/);
assert.match(home, /What is Atelier/);
assert.match(home, /redirect\("\/style"\)/);

const tour = readFileSync(new URL("../src/components/nav-tour.tsx", import.meta.url), "utf8");
assert.match(tour, /NAV_TOUR_KEY/);
assert.match(tour, /return null/);
assert.doesNotMatch(tour, /Premium|freemium|unpaid/i);
const shellTabs = readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
assert.match(shellTabs, /Style/);
assert.match(shellTabs, /Lookbook/);
assert.match(shellTabs, /Closet/);
assert.match(shellTabs, /Profile/);

const auto = readFileSync(new URL("../src/components/first-board-auto.tsx", import.meta.url), "utf8");
assert.match(auto, /storeFirst/);
assert.match(auto, /\/generate/);
assert.doesNotMatch(auto, /\/regenerate/);

const budget = readFileSync(new URL("../src/components/personalize/budget-step.tsx", import.meta.url), "utf8");
assert.match(budget, /action="\/session"/);
assert.match(budget, /personalize\/ready|\/profile/);
assert.doesNotMatch(budget, /unpaid|Premium/i);

const shell = readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
assert.match(shell, /\/style/);
assert.match(shell, /\/lookbook/);
assert.match(shell, /\/closet/);
assert.match(shell, /\/profile/);

console.log("onboarding locks: home + lookbook redirect + nav tour + first-board auto ok");

// Shape sits in onboarding before color; Profile edit is isolated Close → /profile.
const personalize = readFileSync(new URL("../src/app/personalize/page.tsx", import.meta.url), "utf8");
assert.match(personalize, /personalize\/measurements/);
const measurements = readFileSync(new URL("../src/app/personalize/measurements/page.tsx", import.meta.url), "utf8");
assert.match(measurements, /isProfileEdit/);
assert.match(measurements, /closeHref/);
assert.match(measurements, /SizeField/);
const profile = readFileSync(new URL("../src/app/profile/page.tsx", import.meta.url), "utf8");
assert.match(profile, /withProfileEdit/);
const clash = readFileSync(new URL("../src/lib/seasonal-clash.ts", import.meta.url), "utf8");
assert.match(clash, /FALL_26_TREND_TICKERS/);
assert.match(clash, /America\/Los_Angeles/);
assert.match(clash, /garnet and lavender clash/);
assert.match(clash, /chocolate and ivory/);
console.log("onboarding + profile-edit + trend bank ok");
