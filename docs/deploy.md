# Deploy Atelier on one stable public URL

Do **not** use `vercel deploy --temporary`. Each `temporary-*` host is a new origin: cookies and localStorage reset, and Luisa has to personalize again.

## 1. Upstash Redis (required on Vercel)

Inbox used to live in `/tmp` (one serverless instance). POST and lookbook GET could miss each other.

1. Create a free Redis database at [console.upstash.com](https://console.upstash.com) (Hobby).
2. Copy **REST URL** and **REST TOKEN**.
3. Set them on the Vercel project (Production + Preview):

```bash
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
```

`GET /api/stylist/health` should return `{ "driver": "redis", "durable": true }` and exhausted flags on `globalDaily` / `userGenerate`. `GET /api/stylist/budget` reports the same counters.

Local/dev without those vars uses `.data/stylist` on disk.

## 2. Named project, same URL every time

```bash
# once
vercel link --yes --project atelier-luisa

# every release (same URL)
vercel deploy --prod --yes
```

Production URL stays `https://atelier-theta-one.vercel.app` (project `atelier`). Redeploys do not change the host, so `atelier.v2` cookies and profile localStorage survive.

If Origin → Vercel git is blocked on Hobby, keep shipping with this CLI link. Do not pass `--temporary`.

## 3. Turn Deployment Protection / SSO off

Hobby projects often sit behind Vercel Authentication. For Style Site + Luisa:

Vercel → Project → Settings → Deployment Protection → **off** (or Standard Protection disabled) so `/` and `/api/stylist/*` are public.

## 4. Style Site

Always call **this** origin:

```http
POST https://atelier-theta-one.vercel.app/api/stylist/looks
GET  https://atelier-theta-one.vercel.app/api/stylist/looks?requestId=srq_…
GET  https://atelier-theta-one.vercel.app/api/stylist/pending
GET  https://atelier-theta-one.vercel.app/api/stylist/budget
GET  https://atelier-theta-one.vercel.app/api/stylist/health
```

Optional: `STYLIST_HANDOFF_WEBHOOK_URL` on Atelier so Request 4 looks wakes Style Site with `{ requestId, host }`.
