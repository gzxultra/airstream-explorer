# Airstream Explorer

A cinematic, spec-accurate static catalog of every current Airstream travel-trailer floorplan (2026 + 2025 model years — 59 floorplans across 12 families).

Built as a **zero-dependency** static site: data-driven build, real unit tests, no framework, no `node_modules`. Deploys to Cloudflare Pages via GitHub Actions on every push to `main`.

## Architecture

```
src/
  data/trailers.json     # the dataset (59 floorplans, audited specs) — source of truth
  lib/
    format.mjs           # pure formatters (price, weight, length, tanks…)
    data.mjs             # load + validate + filter/group helpers
    render.mjs           # pure HTML-string renderers (CSP-safe, escaped)
  assets/css/site.css    # design system (Fraunces + DM Sans, copper on cream)
  assets/js/app.js       # client-side year/model filtering (no deps, no innerHTML)
public/assets/img/       # pre-resized images: thumbs 400px / heroes 1280px / gallery 920px
scripts/
  build.mjs              # validate → render index + 59 detail pages → copy assets → dist/
  serve.mjs              # local static server for previewing dist/
test/                    # node:test unit tests (data integrity, formatting, rendering, XSS)
dist/                    # build output (deployed to Cloudflare Pages)
```

## Commands

```bash
npm test       # run the unit tests (node --test)
npm run build  # run tests, then build the site into dist/
npm run dev     # build, then serve dist/ at http://localhost:8788
node scripts/serve.mjs 8799   # serve an existing dist/ on a chosen port
```

`build` is gated by `prebuild` (tests must pass before a build is produced).

## Deployment

Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) runs tests, builds, verifies 59 detail pages exist, and deploys `dist/` to Cloudflare Pages.

Required repo secrets:
- `CLOUDFLARE_API_TOKEN` — token with **Cloudflare Pages: Edit**
- `CLOUDFLARE_ACCOUNT_ID`

Live: https://airstream-explorer.pages.dev

## Data integrity

The dataset is the source of truth and is validated on every build (`validateDataset`): unique slugs, `CCC === GVWR − dry weight`, required specs present, valid years. Audited reference specs (e.g. Classic 33FB 2026 — $222,900 / 1,575 lb CCC) are locked by tests in `test/data.test.mjs`, so a bad data edit fails CI before it can ship.

Independent enthusiast reference. Not affiliated with Airstream, Inc. Some imagery is AI-generated and labeled as such.
