# Deployment

## Current state

- The repository's `vercel.json` has been repaired and is ready for a Vercel build.
- **A green production build has not been confirmed yet.** This document will be updated with the real result once a Vercel project linked to this repository completes a build.
- The web package is currently a stub, so a successful build will deploy a placeholder, not the full product.

## Frontend on Vercel

Configuration is committed in [`vercel.json`](../vercel.json):

| Setting | Value |
|---|---|
| Install command | `pnpm install --no-frozen-lockfile` (switch to `--frozen-lockfile` once `pnpm-lock.yaml` is committed) |
| Build command | `pnpm --filter @verdict/web build` |
| Output directory | `packages/web/dist` |
| Routing | SPA rewrite to `/index.html`, excluding `/api/` and `/assets/` |
| Headers | `nosniff`, `X-Frame-Options: DENY`, strict referrer policy, restricted permissions |

### Link the repository

1. In Vercel, choose **Add New > Project** and import `mrjayvirtual/Verdict-QA`.
2. Leave **Framework Preset** as *Other*. Leave **Root Directory** empty. Build and output settings are read from `vercel.json`.
3. Add environment variables (below) and deploy.
4. Every push to `main` then triggers a production build.

> If you reuse an older Vercel project, check **Settings > Git** first. Make sure it points at this repository. A project linked to a different repository will build the wrong code.

### Pitfall: stale redeploys

The dashboard **Redeploy** button can re-run an old commit. To build the latest code, push a new commit.

## Environment variables

See [`.env.example`](../.env.example) for the full list. At minimum for the frontend:

- `VITE_API_URL` - public API base URL (never a secret)

Backend variables (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `AI_PROVIDER`, `AI_API_KEY`, `GITHUB_TOKEN`) belong **only** on the API host.

## Backend and database

The API hosting model (serverless functions vs a Node host) is an open decision tracked in [`ROADMAP.md`](ROADMAP.md) Phase 2. Until the API exists, nothing needs to be deployed for it. Use any managed PostgreSQL service for `DATABASE_URL`.

## Verification checklist

- [ ] `pnpm install && pnpm build` succeeds from a clean checkout
- [ ] Vercel build log shows a successful build for the latest `main` commit
- [ ] The deployed URL loads and deep links resolve via the SPA rewrite
- [ ] No secrets appear in the built bundle
