# Contributing to Atelier

Shared repo: [github.com/LuisaCScu/Atelier](https://github.com/LuisaCScu/Atelier)

## Branches

| Who | Branch | Use for |
| --- | --- | --- |
| Luisa / Codex | `codex/atelier-improvements` | Imaging, Closet gpt-image / sheet→slice, extract quality |
| Grok / Admin team | `grok/atelier-improvements` | Product UX (Style chat Generate, freemium caps, Lookbook, app path) |
| Production | `main` | Known-good only — merge when ready to ship |

- Branch off `main` (or rebase onto it regularly).
- **Do not push straight to `main`.**
- Open a PR into `main` when a slice is ready to review/deploy.
- Prefer small PRs; don’t mix Closet imaging and Style chat in one PR if avoidable.

## Source of truth

- GitHub is the shared source of truth for Codex + Grok.
- Lasting Vercel (`atelier-theta-one`) may still deploy from an agent box tree until wired to this repo — after a merge to `main`, sync deploy from `main`.
- Never leave lasting-only edits that aren’t committed here.

## Secrets

- Do not commit `.env.local`, API keys, or ingest secrets.
- Use `.env.example` for required variable names only.

## Product locks (Sep 2025–26 direction)

- **Style:** little chat (occasion + details) → **4 looks**: 1 mostly closet, 2 mixed, 1 store-only.
- **Closet:** same job; polish later (imaging on Codex branch).
- **Lookbook:** last in IA; free tier **10** saves.
- **Freemium:** **1 generate/day**, **10 closet items**, **10 Lookbook saves**.
- Fittings / worn heroes stay parked unless Luisa reopens them.

## Review

- Smoke Closet / Generate paths that you touch before asking to merge.
- Call out freemium-cap or affiliate/disclosure impact in the PR body.
