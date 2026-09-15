# Atelier Astra — reviewed local edition

The September 15 edition reviewed with Luisa, replacing the original Atelier app at the repository root. The original implementation remains in Git history at `d8856a319c1d8dad17f526f48f88ada291de1572`.

## Run locally

Use Node.js 22 or newer. From this directory:

```sh
npm ci
cp .env.example .env.local
npm run dev -- --hostname 127.0.0.1
```

Enter private server keys only in the ignored `.env.local` file. The default local address is http://127.0.0.1:3000. To build and serve:

```sh
npm test
npm run build
npm start -- --hostname 127.0.0.1
```

This requires a Next.js server, not static export. GPT requests use Vercel AI Gateway when `AI_GATEWAY_API_KEY` is configured, or the direct OpenAI connection otherwise. Never expose credentials as `NEXT_PUBLIC_` variables.

## Included

- Responsive workspace and mobile navigation; original full-body Discover intro photo.
- Profile questions, twelve seasonal palettes, optional GPT photo season estimate, and height in centimeters or feet/inches.
- Guest browsing with popular outfits and profile gates for wardrobe, saved looks, and planning.
- Optional five-step welcome tour and closing screen, replayable from the footer.
- Twelve swipeable inspiration looks; likes/dislikes influence catalog ranking.
- Catalog-based styling with a short outfit request, budget slider ($100–500 in $50 steps, then $100 steps to $2,000), and remembered outfit combinations to avoid repeat recommendations.
- Closet styling, individual piece styling, and one Add clothes entry point.
- Multiple source photos per upload, item detection and GPT transparent cutouts, per-item corrections and retries, color dropdown, and close-up references after generation.
- Background work while navigating within the app, completion notification, and IndexedDB draft recovery. Keep the tab open while processing; completed drafts persist, unfinished requests do not continue after the browser closes.
- Free/Premium preview closet capacities of 10/100; selection follows remaining space.
- Lookbook capacities of 10/100, with explicit replacement or upgrade choices at capacity.
- Weekly planning and inspiration storage.

## Current boundaries

Profiles, wardrobe photos, drafts, saved looks, and plans are device-local in IndexedDB. The profile and Premium controls are previews, not authenticated accounts or paid subscriptions. No cross-device sync exists. Clearing browser data removes these records.

Paid photo endpoints intentionally reject non-local requests until hosted authorization and durable quotas are implemented. Configuring Vercel keys alone does not enable them on a public domain. User-selected photos are sent to the configured AI service for detection, cutouts, or color analysis. AI images may change garment details; season analysis is a lighting-sensitive estimate. The face photo is not saved with the profile.

Styling runs locally against the supplied catalog. It does not call an AI stylist or retrieve current retailer stock/prices. Outfit text supports a limited set of keywords. Historical catalog prices should be checked at the retailer.

“See it worn” is deferred. The chat-only generated model sample is excluded from this app.

## Verification

`npm test` covers outfit budgets, composition, owned pieces, preference ranking, deduplication, closet capacity, draft persistence/migration, saved-look replacement, API input forwarding, and local-only API guards. Run `npm run build` for TypeScript and production compilation.

The original catalog and editorial imagery were supplied by the project owner. Competitor code and artwork are not included.

## Deployment

Use the Vercel Next.js preset with the repository root as Root Directory, `npm run build`, and the default Next.js output directory. This release intentionally retains local-only paid photo endpoints and clearly labeled Premium preview controls. It is a reviewed UI/prototype release, not a completed subscription launch. Existing original-app browser records are left untouched, but are not imported into the new IndexedDB schema.
