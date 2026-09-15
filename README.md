# Atelier

A digital stylist lookbook. You build a profile, then Atelier returns **four shoppable outfits** inside your budget. Piece links may be affiliate links. Add what you already own and elevate it with one or two suggested buys.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147).

Public demo: deploy **one named Vercel project** with Upstash Redis — not `vercel deploy --temporary`. See [docs/deploy.md](docs/deploy.md).

```bash
npm run build
npm start -- --port 43147
```

## Product spine

**IA URLs:** `/style` (styling tool + active board) · `/lookbook` (saved Wear/Maybe) · `/closet` · `/profile` (`/you` → `/profile`).

1. **Welcome** (`/`) — First-run: brief What is Atelier + Create profile only (no freemium/Premium pitch, no Add to closet, **no home tour**). Returning signed-in redirects to **`/style`**. After budget: a one-time spotlight tour (Style → Lookbook → Closet → Profile, `atelier.postProfileDemo.v1`) runs; finish lands **`/style`** for occasion chat. Auto storeFirst is parked so the free 1/day generate is not burned without a brief.
2. **Quiz** (`/personalize`) — lookAge → color (season **or** three axes) + optional face → editable appearance chips + favorite colors → dating-style swipe (14 cards filtered by lookAge, heart/X) → occasions & prefs → budget. Friend is **women-only**. No body photos. Packet also sends `styleSignals`, `favColors`, `lookAge`, `appearance`.
3. **Request looks** — Style chat collects occasion + details and POSTs `atelier.stylistRequest.v1` with `generateMode: "styleChat"`, `occasionNote`, and `lookMix` (4 looks: 1 mostly closet, 2–3 mix, 4 store-only). Style Site’s bot talks to Stylist; it **POSTs** `atelier.stylistResponse.v1` to `/api/stylist/looks`. Style shows a pending state until that ingest, then a magazine shop-the-look **board** (tiles-only while fittings are parked).
4. **Freemium** — **1 generate/day**, **10 closet items**, **10 Lookbook saves** on free (`src/lib/freemium.ts`). Fittings / worn heroes stay parked. Premium is a mock unlock (no Stripe), not a create paywall.
5. **Likes** — Wear / Maybe / No (or like / skip / dislike) write that user’s lookbook. Wear and Maybe leave the active board into Saved (capped at 10 on free); No leaves too. Active board keeps unvoted looks only. Shared hero-cache (`fingerprint × pieceIds`) is unchanged.
6. **Closet** — Manual or Photo (cutout). Free cap **10** pieces. The 11th opens a mock upgrade that ends on **Development in progress** — no Stripe. Video and Elevate are parked. Capsule expand is mock-only. After the first lookbook, a skippable invite points here once. Closet gpt-image / sheet→slice belongs on `codex/atelier-improvements`.
7. **Tabs (Friend beta four-bucket)** — Style (`/style`, chat Generate + active board) · Lookbook (`/lookbook`, Wear+Maybe saved archive — secondary, free max 10) · Closet (`/closet`) · Profile (`/profile`; `/you` redirects). When Generate runs and the closet is non-empty, `atelier.stylistRequest.v1` includes `closet[]` (ids, cutout images, roles). Stylist mixes closet + store per `lookMix` (see [docs/stylist-contract.md](docs/stylist-contract.md)).

### Color

First question: **Do you already know your season?**

- **Yes** — pick one of twelve seasons. Each row shows representative color chips. Season is enough; we do not also ask undertone, value, and chroma.
- **No** — optional daylight face photo, then undertone + value + chroma. Optional face-near colors use a labeled **Pick color** control.

### Style cards

After color, the quiz is a **dating-style swipe** of **ten** looks from a curated women’s bank (`data/style-cards.v1.json`, 18 cards — 6 each of Paddock Cashmere, Harbor Granddaughter, Harvest Tweed). Cards are gated by season (or undertone × value × chroma), with `avoidIf` demoted and `shapeFit` boosted. Least-recently-shown cards rotate in. Swipe right to like, left to pass; like at least two. The packet still sends `likedAesthetics` and `dislikedAesthetics` (locked names only), plus optional `styleSignals` (`atelier.styleSignals.v1`) — lean axes and tags from the same votes. Aesthetics are not replaced by the axes layer. Lookbook like/dislike (`POST /api/style/feedback`) nudges the same signals; dislike asks what missed.

Stills are hosted first-party at `/style-cards/<id>.jpg`. Sources (Unsplash / Pexels licenses) are documented on each card.

### Optional shape

Overall shape, torso, and retail cm stay optional on `/personalize/measurements`. The quiz does not collect body-angle photos (front / side / back). Shape, when present, steers which ten cards you see.

## Data

- Profile session lives in a cookie (`atelier.v2`).
- Closet lives in `atelier.closet.v2` (`localStorage` is source of truth, including cutout data URLs; the same-named cookie holds slim metadata). Wipe: clear `atelier.closet.v2` in Application → Local Storage and Cookies. The optional face photo stays in `atelier.media.v2`. Liked looks live in `atelier.likedLooks.v1` (`localStorage`) — not the shared hero-cache.
- Photo add strips the backdrop on-device (canvas flood-fill against sampled corners — studio / plain surface). No remove.bg key. Cutouts are PNG tiles for the grid and, when small enough, the stylist packet.
- Looks are ingested as **`atelier.stylistResponse.v1`** after Style Site’s bot hears from Stylist (`POST /api/stylist/looks`, keyed by `requestId`). Lookbook polls `?requestId=` / the session cookie, then mirrors a ready payload in the browser so Vercel `/tmp` instance splits don’t hide looks. Request-looks can POST `{ requestId, host }` to `STYLIST_HANDOFF_WEBHOOK_URL`. See [docs/stylist-contract.md](docs/stylist-contract.md).
- Generate uses the in-repo Store MVP catalog (`data/mvp-catalog.json`, `mvp-2026-09-09-coord-accessories-1`) — 88 live Zara, Everlane, Toteme, and Massimo Dutti pieces. `STYLIST_MODE=local` can fill looks from that catalog while you wait; default is a pending lookbook.
- Generate budget: **5 fitting-board creates / user / UTC day** (`STYLIST_USER_DAILY_LIMIT` or `STYLIST_USER_GENERATE_LIMIT`, default 5), **20 global** (`STYLIST_GLOBAL_DAILY_LIMIT`). Meters hero GenerateImage COGS only (`fittingCount > 0`); tiles-only / `styleThisPiece` skips check + INCR. Persisted in Upstash Redis. `GET /api/stylist/budget`.
- **Hero cache (Stylist COGS stub):** `GET` / `PUT /api/looks/hero-cache` maps `appearanceFingerprint__sortedPieceIds` → a lasting https hero URL. Redis namespace `hero-cache:v1:` (same Upstash driver as the inbox). No PNG bytes. See [docs/stylist-contract.md](docs/stylist-contract.md#hero-cache--get--put-apilookshero-cache-stylist-cogs).
- **Regenerate** (`POST /regenerate` or `POST /api/stylist/regenerate`) queues a new pending request from the saved profile and lands on `/lookbook?requestId=…` (Generating…). After the free board, it redirects to `/upgrade` until mock Premium. Budget exhausted shows the pause note. A second POST for the same `generateUserKey` within ~2 minutes while still pending reuses that request (Redis inflight pointer + pending scan). The Regenerate button disables on pointer-down.
- The browser does not call the Stylist agent.

## Style photo assets

Onboarding style cards are first-party JPEGs in `public/style-cards/`. Product cutouts for the board live in `public/cutouts/`. v1 aesthetic names are locked: Paddock Cashmere, Harbor Granddaughter, Harvest Tweed. Shop CTAs may be affiliate links — see `/disclosure`.

Public trust pages: `/about`, `/how`, `/privacy`, `/terms`, `/disclosure`, `/contact`. Published lookbooks: `/looks`.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui
