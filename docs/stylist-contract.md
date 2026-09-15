# Atelier ↔ Stylist contract v1

Friend is **women-only**. Atelier does not ask gender. Every `atelier.stylistRequest.v1` sends `gender: "female"` so Stylist stays compatible.

Shared types live in `src/lib/stylist-contract.ts`.

The **browser never talks to the Stylist agent**. Style Site’s bot does.

1. User finishes personalize on Atelier and hits **Request 4 looks**. The profile is saved and serialized as **`atelier.stylistRequest.v1`**. Lookbook shows *“Your stylist is putting looks together…”*
2. Atelier POSTs `{ requestId, host }` to **`STYLIST_HANDOFF_WEBHOOK_URL`** (owned by **Flow**, not Style Site — Flow provides/configures the URL; do not invent one on lasting). Until that env is set, Flow/Style Site **polls `GET /api/stylist/pending` on a schedule**.
3. Flow/Style Site loads `atelier.stylistRequest.v1` from `GET {host}/api/stylist/request/{requestId}` and sends it to **Stylist**. Stylist replies **`atelier.stylistResponse.v1`**.
4. **Style Site POSTs** that response to **`POST {host}/api/stylist/looks`**. For tiles-only / fittings parked / `fittingCount === 0` / all `fittingLocked`, Atelier stores **ready immediately** (JSON + piece tile URLs) — **never** `409 awaiting_heroes`. The user’s lookbook (which already has that `requestId`) renders the looks.

No retailer scraping. `shopUrl` is `#demo-stub` in local MVP. Shop CTAs toast a demo affiliate stub.

## `atelier.stylistRequest.v1`

Built when the user requests looks (Quick or Deep). Persisted in the stylist inbox under `requestId`.

| Field | Notes |
| --- | --- |
| `kind` | `"atelier.stylistRequest.v1"` |
| `requestId` | Stable id for this request (`srq_…`). Echo this on the response. |
| `gender` | Always `"female"`. Friend is women-only; the field stays on the packet for Stylist compatibility. |
| `path` | `"quick"` \| `"deep"` |
| `size` | Clothing size on Quick only; **`null` on Deep** |
| `shape` | Overall shape, or `null` |
| `torso` | Torso length, or `null` |
| `measurements` | `{ heightCm, chestCm, waistCm, hipsCm, inseamCm, shoulderCm, neckCm }` — numbers or `null`. No weight. |
| `color` | `{ season, undertone, value, chroma, swatches[{ name, hex }] }` — see Color rules. Optional extra `metal`: `gold` \| `silver` \| `both`. |
| `priorities` | What’s-important chips |
| `likedAesthetics` | Locked v1 names the user liked, first-like order (`Paddock Cashmere`, `Harbor Granddaughter`, `Harvest Tweed`) |
| `dislikedAesthetics` | Locked names from explicit dislike, minus any also liked |
| `dislikedSilhouettes` | Optional silhouette tags from disliked cards (silhouettes on liked cards are dropped) |
| `styleSignals` | Always on new packets: `atelier.styleSignals.v1` with **`avoid.pieceIds`** (per-user disliked / voted-no pieces, esp. shoes) + **`feedback.lastReasons` / `lastLookId` / `lookVotes`**. Optional `recentServedCoreHashes` / `avoid.lookIds`. Richer axes layer — does **not** replace `likedAesthetics`. No `cardVotes[]`. **Per-user bans only — never global SKU ban.** |
| `budget` | `{ min, max, currency: "USD" }` |
| `occasions` | `work` \| `weekend` \| `night` \| `travel` \| `event` |
| `lookCount` | `4` for closetFirst / storeFirst; **2–3** (prefer `3`) for `styleThisPiece` |
| `generateMode` | **Required** on new packets: `"closetFirst"` (Style my closet), `"storeFirst"` (Style a new outfit), or `"styleThisPiece"` (How to style it). Stylist soft-defaults `storeFirst` if missing on old packets. |
| `closetPieceId` | Required when `generateMode` is `styleThisPiece` — that closet piece must appear in every look. |
| `freeFirstBoard` | `true` on the first unpaid board so Stylist only gens **3 fittings** |
| `tier` | `"free"` \| `"premium"` |
| `fittingCount` | `3` on free first board; `4` on Premium; **`0` for `styleThisPiece`** (tiles-only, no fittings). Worn photos are **fittings** (`heroImage` / `fittingImage`). |
| `closet` | Optional owned pieces when the client closet is non-empty. See Closet mix. |
| `favColors` | Optional `{ name, hex }[]` — colors they like to wear. Not a flattering-near-the-face palette. Season analysis stays on `color`. |
| `lookAge` | Optional `younger` \| `mid` \| `mature` \| `mixed`. How fittings should read. |
| `appearance` | Optional `{ hairColor, hairLength, eyes, skinToneBand }` tags so heroes honor the person. Editable guesses from a daylight face. |

## `styleSignals` (`atelier.styleSignals.v1`)

Optional field on `atelier.stylistRequest.v1`. Built from swipe likes/passes. `likedAesthetics` / `dislikedAesthetics` stay the aesthetic rollup.

```json
"styleSignals": {
  "kind": "atelier.styleSignals.v1",
  "source": "swipe-quiz",
  "swipe": { "shown": 10, "liked": 6, "disliked": 4 },
  "lean": {
    "colorIntensity": -0.4,
    "fit": 0.5,
    "accessories": 0.6,
    "accessoryScale": -0.2,
    "jewelryAmount": -0.4,
    "structureVsDrape": 0.3,
    "coverage": 0.0,
    "patternVsSolid": -0.5,
    "footwear": -0.2,
    "formality": 0.2,
    "statementLevel": -0.7
  },
  "leanScale": {
    "colorIntensity": "soft(-1) … bold(+1)",
    "fit": "fitted(-1) … loose(+1)",
    "accessories": "minimal(-1) … finished(+1)",
    "accessoryScale": "small(-1) … big(+1)",
    "jewelryAmount": "small(-1) … big(+1)",
    "structureVsDrape": "structure(-1) … drape(+1)",
    "coverage": "covered(-1) … open(+1)",
    "patternVsSolid": "solid(-1) … pattern(+1)",
    "footwear": "flat/loafer(-1) … heel(+1)",
    "formality": "casual(-1) … polished(+1)",
    "statementLevel": "quiet(-1) … statement(+1)"
  },
  "tags": {
    "liked": ["loafer", "belt", "monochrome", "drape"],
    "disliked": ["loud-print", "crop", "chunky-sneaker"]
  }
}
```

Rules: lean floats in `[-1, 1]`. Like pushes toward that card’s polarity; pass pushes opposite. Omit an axis with no votes. `leanScale` is documentation. `tags` are short tokens from card metadata. Do not send `cardVotes[]`.

Lookbook votes (`POST /api/style/feedback`) soft-update the same object. Body: `{ requestId, lookId, vote: "like"|"dislike"|"skip", reasons?, look?, at }`. Quiz is the prior (weight 1.0); each look vote is weight 0.25 until ~8 votes, then catch-up. Applied lean step stays ~0.08–0.12 and is clamped to `[-1, 1]`. Like (no reasons) nudges toward the look’s inferred lean and merges formula/piece tags into `tags.liked`. Dislike slugs: `too-dark` → colorIntensity −, coverage −; `too-colorful` → colorIntensity −, patternVsSolid − + `loud-color`/`busy-print`; `too-revealing` → coverage − + look-relevant `crop`/`low-cut`/`mini`; `too-simple` → statementLevel +, accessories + + `bare`/`unfinished`. Look-aware extras go in as slug tokens (`too-stiff` → structureVsDrape +, `too-dressy` → formality −, `wrong-shoes` from the look’s footwear, `jewelry-too-much` / `jewelry-too-little` / `no-jewelry` → jewelryAmount). Soft-honor `lean.jewelryAmount` (−1 minimal … +1 stacked) and tags `jewelry-minimal` | `jewelry-layered` | `jewelry-stack` | `no-jewelry`. Optional `styleSignals.feedback = { lookVotes, lastLookId, lastVote, lastReasons[] }` is included once a look has been voted. `likedAesthetics` is unchanged. Skip records the vote and does not nudge lean.

## Closet mix (`closet[]` + `generateMode` on the request)

Present whenever look generation / regenerate runs and `atelier.closet.v2` has ≥1 piece — **`closetFirst`, `storeFirst`, and `styleThisPiece`**. Cap ≤10 via `closetToStylistPacket`. For `styleThisPiece`, closet must include `closetPieceId`. Women-only (Friend). Each entry:

```json
{
  "id": "photo-1778…",
  "role": "top",
  "name": "Cream knit",
  "color": "cream",
  "image": "data:image/png;base64,…",
  "source": "photo",
  "gender": "female"
}
```

`role`: `top` | `bottom` | `dress` | `outerwear` | `shoes` | `bag` | `accessory` | `other` (legacy knit/shirt/tee/trousers/shorts also accepted). `image` is a durable cutout (transparent PNG data URL or hosted), same spirit as Store collage tiles. Large data URLs may be omitted so Redis stays safe; id/role/name/color still go.

**`generateMode` (Stylist implements; Atelier documents only):**

- **`closetFirst`** (Style my closet): core from closet; 1–2 store gap fillers; prefer `mixCloset`.
- **`storeFirst`** (Style a new outfit): store priority; ≤1 closet piece if it fits; `storeNew` / `mix`.
- **`styleThisPiece`** (How to style it, from `/closet/[id]`): every look includes `closetPieceId`; fill the rest with store SKUs; vary silhouettes across boards; **tiles-only** (`fittingCount: 0`, lookCount 2–3). Distinct from full-wardrobe Style my closet.
- Soft-default **`storeFirst`** when the field is missing on old packets.

**Legacy mix labels (of each 4 looks; UI may show later):**

1. Mostly closet + 1–2 store elevate → `look.source: "mixCloset"`
2. Mostly/all store new → `look.source: "storeNew"`
3–4. Mix → `look.source: "mix"`

Core / elevate budget rules are unchanged. Parked: video→stills, Elevate suggestions, real payments.

## Color rules (locked with Stylist)

Packet fields stay `color.season`, `undertone`, `value`, `chroma`, `swatches`. Value in the packet is `light` \| `medium` \| `deep` (`dark` is accepted as an alias for `deep`). Chroma is `bright` (clear) or `muted` (soft).

Both paths start with **Do you already know your season?**

- **Yes** → send `season` and skip undertone / value / chroma (`null` on Deep; Quick may still map a guide). Do not also collect the three axes.
- **No** → optional daylight face photo (no heavy makeup), then undertone (`warm` \| `cool` \| `neutral`) + value (`light` \| `medium` \| `deep`) + chroma (`bright` \| `muted`). Photo is optional. Do not block on a photo. No vein tests. No body-angle photos.

Optional: `favColors` `{ name, hex }[]` — favorites they wear, collected on Color for both season paths. Do not treat these as “colors that sit well near the face.”

Optional `appearance` tags (`hairColor`, `hairLength`, `eyes`, `skinToneBand`) and `lookAge` so full-body fittings match the person. Face photo is optional; guesses are editable. Do not invent paid vision.

## Freemium (fittings unlock — create stays free)

Atelier is **free to style, create looks, and shop**. Premium unlocks worn fittings / See it on — not the right to use the app.

1. First Generate: `freeFirstBoard: true`, `tier: "free"`, `lookCount: 4`, `fittingCount: 3`. Stylist gens **three** worn fittings + one Premium placeholder look.
2. Still **four looks**. Looks 1–3 include a fitting (`heroImage` / `fittingImage`). Look 4 must still include tiles, shop, and recipe. Friend shows **See it on** (Premium sheet) in that slot.
3. Later Generate (no Premium): `freeFirstBoard: false`, `tier: "free"`, `fittingCount: 0` — tiles-only boards; create/shop stay free. Soft upsell only.
4. Premium: `tier: "premium"`, `fittingCount: 4` — four fittings on later boards. Mock unlock (no Stripe). Create is **never** gated (`generateAccess` is only `"free" | "premium"`).
5. Friend UI locks look 4 on the first free board; on later free boards all looks are fitting-locked (tiles-only).

Ingest still accepts a look without `heroImage` when `pieces[]` and recipe copy exist.

## Liked looks vs hero-cache

- **Wear / Maybe / No** (aliases: like / skip / dislike) write that user’s liked history (`atelier.likedLooks.v1` on the device). Wear or Maybe stores pieces + fitting URL + meta on **You** (Saved Lookbook) and **leave the active board**. No removes from history and the board. Active board keeps **unvoted** looks only.
- **Hero-cache** stays shared: `GET` / `PUT /api/looks/hero-cache` keyed by `appearanceFingerprint__sortedPieceIds`. Likes never write or delete cache entries.

## `atelier.stylistResponse.v1`

Ingest is **permissive**: unknown fields on the response or a look are kept. Do not strip extras.

| Field | Notes |
| --- | --- |
| `kind` | `"atelier.stylistResponse.v1"` |
| `requestId` | **Must match** the request Atelier saved. This is how looks attach to the user. |
| `looks[]` | See look fields below |

Each look:

| Field | Notes |
| --- | --- |
| `id`, `title` | Required. |
| `heroImage` / `fittingImage` | Worn **fitting**. Required on looks 1–3. Optional on free look 4 (`fittingLocked: true`). |
| `hook` | Optional short line. |
| `formula` | Optional one-line formula. Grid prefers this over a clipped `why`. |
| `why` | Still accepted. Required **unless** `whyFit` / `whyColor` / `whyVibe` / `formula` supply copy. |
| `whyFit`, `whyColor`, `whyVibe` | ~1 sentence each. UI uses these when present; otherwise it splits `why` into sentences. |
| `capsuleNote` | Optional brief capsule line. |
| `lookTotal` | Optional `{ amount, currency }`. UI compares to the request budget min/max. If omitted, Atelier sums `pieces[].price`. |
| `coreTotal` / `elevateTotal` | Optional amounts (number or `{ amount }`). Look detail always labels **Core look (in budget)** for `pieces[]` and **Elevate (optional adds)** for `levelUp[]`. Amounts render only when Stylist sends them — Atelier does not invent splits. **Look total** is always the full `lookTotal` (or the sum of `pieces[]` if omitted). |
| `pieces[]` | **Only items visibly worn** in the full-body `heroImage`. These sit on the magazine board (no prices on the collage). |
| `levelUp[]` | Optional same piece shape. Shown **below** the board as “Take your look to the next level with these”. Omitted if empty. |
| `layout` | `"board"` (default) or `"ltk-row"`. Missing/undefined → board. |
| `source` | Optional `mixCloset` \| `mix` \| `storeNew` when closet inventory was on the request. UI can show later. |

Each **piece**: `id`, `role` (outerwear / knit / shirt / tee / trousers / shorts / shoes / accessory), `brand`, `name`, `price`, `currency`, `image`, `shopUrl`. Extra piece fields are kept.

Lookbook default is a **j.cathell-style magazine board**: left ~1/3 full-bleed `heroImage`, right ~2/3 white field with `pieces[].image` as editorial cutouts (`object-contain`, light overlap, no prices on the collage). Headline is uppercase `formula` or `title`. On narrow viewports the hero stacks above the board. `layout: "ltk-row"` keeps the older hero-then-grid card.

While `awaiting_stylist` / looks empty, the lookbook shows a snappy progress state: **“Generating your looks…”** / **“Almost ready…”** — never minute promises, never a blank grid. When a prior board exists, Style keeps it visible with a subtle Generating badge.

`/lookbook/[id]` opens with the same board, then **Look total**, formula / whyFit / whyColor / whyVibe / capsule, **Core look (in budget)** (`pieces[]` + `coreTotal` when present), a divider, **Elevate (optional adds)** (`levelUp[]` + `elevateTotal` when present), then **Look total** again. Shop links stay on the piece tiles.

## HTTP

Inbox is keyed by `requestId`. **On Vercel it must be Upstash Redis** (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) so POST ingest and lookbook GET share one store across instances and redeploys of the same project. Local/dev without those vars uses `.data/stylist` on disk. `GET /api/stylist/health` reports `{ driver: "redis" | "fs", durable }` plus `globalDaily` / `userGenerate` exhausted flags (same buckets as budget).

### Look-cache by fingerprint (tiles-only, ≤2s hit)

Namespace `look-cache:v3-tiles` (versioned so old hero-dependent / pre-vote entries never poison). Fingerprint = stable SHA-256 prefix of profile signals + `generateMode` + closet seed + **per-user** lookFeedback / `styleSignals.avoid` / feedback + prior `stylistRequestId` count. A new Create after votes or a prior board **misses** cache — never remaps prior looks onto a fresh `requestId` as “new.” Force regenerate skips cache. On successful `POST /api/stylist/looks` / ready board, Atelier writes the cache. **Tiles-only only** while fittings are parked — never serves worn fittings. Avoid lists are **per-user only** (never a global SKU ban).

### Closet cutout host (slim HTTPS for Stylist)

Before Redis pending / handoff wake, Atelier hosts any `closet[].image` `data:image/...` as lasting HTTPS via `GET /api/closet/cutout/{id}` (Redis + FS, WebP). Existing `https://` URLs pass through. Megabase64 data-URLs are **never** forwarded to Stylist. Ideal lasting URLs also include `https://atelier-assets.vercel.app/cutouts/...` when static assets are redeployed.

### Hero cache — `GET` / `PUT /api/looks/hero-cache` (Stylist COGS)

Stub for Luisa’s Cold ≤ $0.80 / Cached ≤ $0.15 hero reuse. Parallel to Friend UX — Generate, closet, and swipe are unchanged. Style Site / Stylist may look up a hero before a cold render.

**Key:** `appearanceFingerprint__sortedPieceIds` (two segments, `__` separator).

```http
GET /api/looks/hero-cache?key=<appearanceFingerprint>__<sortedPieceIds>
```

```json
{ "hit": true, "heroImageUrl": "https://atelier-theta-one.vercel.app/looks/heroes/lp-harbor-everyday-denim-worn.png" }
```

Miss: `{ "hit": false, "heroImageUrl": null }`.

```http
PUT /api/looks/hero-cache
Content-Type: application/json

{
  "key": "fair-neutral__coat-a,knit-b,trouser-c",
  "heroImageUrl": "https://atelier-assets.vercel.app/looks/heroes/…",
  "requestId": "srq_…",
  "lookId": "look-1"
}
```

```json
{ "ok": true, "key": "fair-neutral__coat-a,knit-b,trouser-c", "heroImageUrl": "https://atelier-assets.vercel.app/looks/heroes/…" }
```

Storage uses the **same Upstash Redis driver as the stylist inbox** (`hero-cache:v1:<key>`). Local/dev without Redis uses `.data/hero-cache` — never `/tmp`, never PNG bytes. `heroImageUrl` must be lasting **https** on `atelier-assets.vercel.app` or `atelier-theta-one.vercel.app`. If `STYLIST_INGEST_KEY` is set, send the same Bearer / `x-stylist-key` as other bot routes. `GET /api/stylist/health` includes `heroCache: { namespace, driver, durable, path }`.

### Generate budget — `GET /api/stylist/budget`

```json
{
  "ok": true,
  "globalDaily": { "used": 0, "limit": 20, "remaining": 20, "exhausted": false },
  "userGenerate": null
}
```

`userGenerate` is filled when `?userKey=` or `?requestId=` is present; otherwise `null`. User generate is **5 fitting boards/day** by default (`STYLIST_USER_DAILY_LIMIT` or `STYLIST_USER_GENERATE_LIMIT`) — hero GenerateImage COGS only (`fittingCount > 0`). Tiles-only / `styleThisPiece` creates skip the quota gate and do not INCR user or global. Global daily limit is `STYLIST_GLOBAL_DAILY_LIMIT` (default **20**). Counters live in Redis and increment **only after a successful fitting-board handoff**. Exhausted fitting quota does not create a fittings request and does not increment. The lookbook shows a light pause note — no auto-regenerate.

The lookbook also mirrors a ready payload in `localStorage` (`atelier.stylist.looks.{requestId}` + `atelier.stylist.recentIds`). If Redis/fs inbox is empty after refresh, the client still renders those cached looks (labeled “Saved on this device”). Redis remains source of truth when `GET /api/stylist/health` is `driver: redis`. The profile cookie `atelier.v2` (plus `localStorage` backup) keeps personalize + `stylistRequestId` on the **same host** so the cache key is found. A new `temporary-*` URL is a new origin and starts over — use one named production URL ([docs/deploy.md](deploy.md)).

The lookbook decides what to poll from, in order: `?requestId=` on `/lookbook`, then `atelier.v2` → `stylistRequestId`, then recent `stylistRequestIds[]`. It also shows the latest ready payload already mirrored in this browser. Style Site does **not** need the visitor cookie to POST ingest.

If Style Site ingested `srq_…` but the browser still has an older id, open `/lookbook?requestId=srq_…` (or Request again so the cookie catches up).

If `STYLIST_INGEST_KEY` is set, send `Authorization: Bearer <key>` or `x-stylist-key: <key>` on bot routes (`POST /api/stylist/looks`, `GET /api/stylist/pending`, `GET /api/stylist/request/{id}`).

Style Site must call the **Atelier origin** (absolute URLs on this host), not a relative path from another site. `/api/stylist/*` responds with `Access-Control-Allow-Origin: *` and accepts `OPTIONS` so a browser or bot on another origin can POST ingest. A server-side bot does not need CORS, but it still must use this host’s absolute API URLs.

### Ingest — `POST /api/stylist/looks`

**This is the Style Site handoff.** After Stylist replies, POST the completed response. No session cookie required.

```http
POST /api/stylist/looks
Content-Type: application/json
Authorization: Bearer <STYLIST_INGEST_KEY>   # if configured

{
  "kind": "atelier.stylistResponse.v1",
  "requestId": "srq_…",
  "looks": [
    {
      "id": "look-1",
      "title": "Paddock Cashmere",
      "hook": "Soft structure for a weekday.",
      "why": "…",
      "heroImage": "https://images.unsplash.com/…",
      "pieces": [
        {
          "id": "p1",
          "role": "knit",
          "brand": "Atelier Demo",
          "name": "Cashmere crew",
          "price": 128,
          "currency": "USD",
          "image": "https://images.unsplash.com/…",
          "shopUrl": "#demo-stub"
        }
      ]
    }
  ]
}
```

`{ "response": { …same object… } }` is also accepted. Keep image URLs reasonably short.

**200** `{ "status": "stored", "response": … }`

### Read a request — `GET /api/stylist/request/{requestId}`

Returns `{ request, status }` so the bot can send `atelier.stylistRequest.v1` to Stylist.

### Wake handoff — `STYLIST_HANDOFF_WEBHOOK_URL` (Flow-owned)

**Webhook ownership: Flow** (not Style Site). Flow provides the URL via env; lasting/Atelier only POSTs create-time wakes and never invents a webhook endpoint. When the user hits **Request 4 looks** (or `POST /api/stylist/generate`), Atelier saves the request, then POSTs:

```http
POST {STYLIST_HANDOFF_WEBHOOK_URL}
Content-Type: application/json

{ "requestId": "srq_…", "host": "https://atelier-host.example" }
```

`host` is this Atelier origin (scheme + host, no trailing path). Flow/Style Site should `GET {host}/api/stylist/request/{requestId}` and later `POST {host}/api/stylist/looks`. No manual “ready” step.

Until the webhook URL is set, Flow polls **`GET /api/stylist/pending`** on a schedule. Pending and ingest stay the same either way. `STYLIST_HANDOFF_URL` / `FLOW_HANDOFF_WEBHOOK_URL` are accepted as fallback aliases for the same notify.

### Pending queue — `GET /api/stylist/pending`

Lists saved requests that still have no response. Use this on a schedule until `STYLIST_HANDOFF_WEBHOOK_URL` is configured.

**Auth lock:** If `STYLIST_INGEST_KEY` is set on lasting, agent routines **must** send `Authorization: Bearer <STYLIST_INGEST_KEY>` (or `x-stylist-key`). Do not invent keys in code or docs — read the env on the bot side. Without the header, pending returns **401** and `awaiting_stylist` can sit forever.

Create-time wake (`notifyStyleSite`) POSTs `{ requestId, host }` to the Flow-owned webhook when configured, with the same Bearer when the key is set. Lasting logs `[handoff-wake] {requestId} {status}` (never the key). Soft-fail: Flow can still poll pending.

### Lookbook poll — `GET /api/stylist/looks?requestId=`

The lookbook page polls this (and any recent request ids on the profile). `{ status: "awaiting_stylist" | "ready" | "demo", request, response }`. When `response` is present, the handler also sets the ready cookie so the next SSR/refresh works on any instance.

`/lookbook?requestId=srq_…` forces that id (share this after ingest if the browser cookie still points at an older quick request).

### `POST /api/stylist/generate`

Called by the **site** (same browser session) after personalize. Saves the profile, writes the request to the inbox, returns `{ status: "awaiting_stylist", request, response: null }`. Does not call Stylist. Form **Request 4 looks** (`POST /generate`) does the same, then redirects to `/lookbook`. Returns **429** with the budget snapshot when the daily generate quota is exhausted.

## Style Site bot

```text
Atelier  POST  STYLIST_HANDOFF_WEBHOOK_URL   { requestId, host }
   or    Style Site polls GET /api/stylist/pending

Style Site  GET  {host}/api/stylist/request/{requestId}
            → atelier.stylistRequest.v1 → Stylist agent

Style Site  POST {host}/api/stylist/looks
            body = atelier.stylistResponse.v1  (same requestId)
```

Lookbook stays pending until that ingest. No browser call to Stylist.

## Env

| Variable | Default | Meaning |
| --- | --- | --- |
| `STYLIST_MODE` | `ingest` | Wait for Style Site to POST looks. `local` fills **demo** looks from the catalog while you wait (not the agent). |
| `STYLIST_INGEST_KEY` | unset | Optional shared secret for bot routes. |
| `STYLIST_HANDOFF_WEBHOOK_URL` | unset | **Flow-owned** handoff webhook. Request-looks POSTs `{ requestId, host }`. Until set, Flow polls `/api/stylist/pending`. |
| `STYLIST_HANDOFF_URL` | unset | Fallback alias for the same webhook. |
| `FLOW_HANDOFF_WEBHOOK_URL` | unset | Additional Flow alias for the same notify. |
| `STYLIST_DATA_DIR` | `.data/stylist` | Local filesystem inbox when Redis is unset. |
| `UPSTASH_REDIS_REST_URL` | unset | Required on Vercel. Shared inbox across instances. |
| `UPSTASH_REDIS_REST_TOKEN` | unset | Required on Vercel with the REST URL. |
| `STYLIST_GLOBAL_DAILY_LIMIT` | `20` | Shared generate cap per UTC day. |
| `STYLIST_USER_DAILY_LIMIT` | `5` | Per-user **fitting-board** generate cap per UTC day (tiles-only exempt). `STYLIST_USER_GENERATE_LIMIT` is accepted as an alias. |
