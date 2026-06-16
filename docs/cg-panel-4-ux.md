# Panel 4 — Campground: Map & UX Premium Design

**Lens:** Make the Campground experience genuinely *premium* and more capable, China-robust (no external tiles/fonts/CDN/JS), CSP-safe vanilla, progressive-enhancement.
**Status:** Research/plan only. No `src/` code or data changed.
**Date anchor:** 2026-06-15.

---

## 0. Repo reality check (what ALREADY ships — read before proposing)

The brief described a simpler build than what is actually on disk. I read every relevant file. The campground feature today **already has** much of what a naive "upgrade" plan would propose, so my recommendations deliberately build on top of it instead of re-inventing it.

What exists right now (`src/assets/js/app.js` `campgrounds()` IIFE ~L878–1977; `src/lib/campgrounds-render.mjs`; `src/lib/campgrounds.mjs`; `src/lib/share.mjs`; 182 `cg-*` CSS rules):

- **Map + list split view** with self-hosted MapLibre basemap (`us-states.json` polygons + one local glyph PBF, `localStyle()`), **GPU clustering** (`addCgLayers()`: cluster bubbles stepped by count + count labels + **fit-colored point layer** `cg-pts` using `FIT_COLOR`), `renderWorldCopies:false`, NavigationControl, graceful `mapStub()` + `showMapUnavailable()` when WebGL/lib is missing, `bareStyle()` fallback if the basemap source errors, 8s watchdog.
- **Hybrid data**: baked static set (2561 sites, 47 states, loaded async from a fingerprinted cache-forever JSON) **plus** a live viewport-scoped Recreation.gov `/api/search` fetch on `moveend` (z≥5), clipped to bounds, with honest `live`/`fallback`/`static` source tag in the summary. *(Note: the live fetch + availability drawer hit `recreation.gov` directly — a third-party request. This is a pre-existing China-robustness exception; flagged in §7. The static set is the offline/blocked fallback and is what actually renders at national zoom.)*
- **Saved shortlist** — `Store` localStorage wrapper, `cg.saved` key, `toggleSave()`, heart buttons on every card AND map popup, a **collapsible "Saved" tray** (`drawSavedTray()`) that renders a comparison-style table (Fit / Posted max / Rating / Price) with per-row remove + Clear all, fit recomputed for the current rig.
- **Per-site availability drawer** (`ensureDrawer()`/`openDrawer()`): a right-side modal `role="dialog"` with This-weekend / Next-weekend / Next-30-days segments, live month fetch, per-site fit classification + hookup labels, Escape-to-close, scrim.
- **Fit logic single source of truth** `fitInfo()` (mirrors `campgrounds.mjs` `fitExplain()`): fits / tight / no / unknown + an honest plain-language "why" + a `posted`/`unverified` confidence dot.
- **Filters**: rig picker, manual length, state, search, sort (rank/reviews/length/price/name), "only posted limits", "comfortable fits only", reset, **Share view** (URL-hash round-trip via `share.mjs` `encodeView`/`decodeView`, mirrored client-side), deep-link `?len=&from=`, persisted prefs.
- **Detail-page "Where this fits" panel** (`renderCampgroundFit()`): dataset-wide fit summary bars + top-6 fitting cards + CTA into the finder pre-filtered.

**Design tokens** (`:root` in `site.css`): `--bg #F4EFE6`, `--surface #FBF8F2`, `--ink #1F1B16`, `--muted #6B6258`, `--line #E0D7C8`, `--copper #B05C32`, `--copper-deep #8A4524`, `--shadow`, `--radius: 2px`, `--maxw: 1120px`. Fit colors live in JS: `FIT_COLOR = { fits:#2e7d4f, tight:#c98a16, no:#c0392b, unknown:#8a8f98, limit:#6B6258 }`. Fraunces + DM Sans self-hosted (static cuts, per panel 4-typography). Motion already guarded by `prefers-reduced-motion` (cgPinPulse/cgFade/cgSlide/cgSpin keyframes).

**Implication:** the premium gap is no longer "add a shortlist / add a drawer / color the pins." Those exist. The gap is: (a) the list↔map relationship is one-directional and cold (no hover/selection sync, no detail-in-place — the card title links straight *out* to Recreation.gov); (b) the map is informationally flat at national zoom (a uniform copper cluster bubble tells you nothing about *fit* or *density* until you drill in); (c) there is **no editorial discovery layer** — the page opens cold on an unfiltered national dump, with none of the "Best Places to Camp" curation that makes The Dyrt/Campendium feel premium; (d) the saved tray is a plain HTML table, not a shareable curated trip; (e) several touch/a11y gaps on the existing controls.

### Data actually available for derived features (baked, no network)
Per-record: `i,n,p(parent),s(state),o(org),r(rating),v(reviews),m(maxLengthFt),pr(price.min),g(photo tail),la/lo(coords),a(top-4 activities)`. Confirmed distributions across the 2561 sites:

| Signal | Count | Collection it powers |
|---|---|---|
| `rating≥4.5 & reviews≥100` | 487 | **Editor's picks / Top-rated** |
| `maxLengthFt≥35` (or null) | 1887 (+305 null) | **Big-rig friendly** |
| activities include star/astronomy | 78 | **Dark-sky & stargazing** |
| water activity OR coastal/lake parent | 2073 | **Waterfront & coastal** |
| `parent` matches "National Park" | 118 | **Inside a National Park** |
| org = NPS | 211 | **National Park Service sites** |
| org = USACE | 551 | **Lakeside (Army Corps)** |

These are all computable at build time or client-side from baked fields — **zero network, China-safe.**

---

## 1. Ranked upgrades

Legend: **QW** = quick win (≤~40 lines, hours), **FLAG** = flagship. Every item reuses existing tokens/patterns and degrades gracefully.

### ★ FLAGSHIP — "Curated Collections" editorial discovery rail + in-place detail drawer

The single biggest premium lever, in two tightly-linked parts. Competitors' premium feel comes from **editorial curation** ("Best Places to Camp," "National Park Neighbors") and from a **rich in-place detail view**, not from another filter checkbox. We have the data for both, baked.

**1a. Curated Collections rail (the discovery framing).**
Above the map/list, a horizontal rail of editorial collection chips/cards: *Editor's picks · Big-rig friendly · Dark-sky & stargazing · Waterfront · Inside a National Park · Lakeside (Army Corps)*. Each is a one-tap **derived filter** over the baked set (predicate table in §0). Selecting one sets a `state.collection` predicate that composes with the existing rig/length/state filters, updates the summary line ("**78** dark-sky campgrounds that fit your 25′ rig"), and re-plots the map. Each collection carries a one-line editorial blurb (Fraunces subhead, copper eyebrow) so it reads like a magazine section, not a facet.

- **Interaction:** chips behave like the existing `cg-fits-only`/`cg-hide-unknown` toggles but mutually-exclusive radio semantics; "All campgrounds" clears. Deep-linkable via a new `col=` key in `share.mjs` (same omit-default pattern) so a collection view is shareable and survives the round-trip.
- **Premium rationale:** turns a cold national data-dump into curated entry points — the difference between a database and a guide. Gives the page an opinion (on-brand with SOUL.md "have opinions").
- **Reuse:** filter-toggle wiring in `campgrounds()` (`elFitsOnly` listener pattern); `cg-controls`/`cg-ctl` chrome; eyebrow/Fraunces from the `cg-hero`; `encodeView`/`decodeView` for `col=`; predicates are pure functions that belong in `campgrounds.mjs` (testable, mirrored client-side exactly like `fitClass`).
- **CSP/China:** pure client filter over baked fields; no network, no innerHTML (build chips with createElement). Blurb text is static, server-rendered into the page.
- **Mobile/touch:** horizontal scroll-snap rail, ≥44px tap targets, `-webkit-overflow-scrolling`; collapses cleanly above the stacked map/list.
- **a11y:** `role="tablist"`/`tab` or grouped radios with `aria-pressed`; selected collection announced via the existing `aria-live` summary; chips reachable by keyboard, visible focus ring (reuse `--copper` outline).

**1b. In-place campground detail drawer (replaces the "card links straight out" dead-end).**
Today a card's title is an `<a target="_blank">` to Recreation.gov, and the map popup is a cramped 280px bubble — the user is ejected before they can evaluate. Add a **detail drawer reusing the EXISTING availability-drawer shell** (`ensureDrawer()`): clicking a card body (not the heart/avail buttons) or a map pin opens a richer panel with the hero photo, rating + review count, fit verdict + the honest "why," posted max, price, the baked `activities` as chips, an **"Airstream suitability" line from Panel 3** (hookups/length read), Save-to-shortlist, the availability segments inline, and the Recreation.gov link as a footer CTA — so the *out-link is the last step, not the first*.

- **Premium rationale:** keeps evaluation on-site, in one calm surface, with our honest fit framing — the core trust differentiator. Consolidates popup + availability into one coherent object.
- **Reuse:** the drawer DOM, scrim, Escape handler, focus model, and `cg-drawer-*` CSS already exist for availability — extend, don't add a second modal. `fitInfo()` for the verdict; `card()`'s photo/meta builders; `openDrawer()` flow.
- **CSP/China:** createElement/textContent throughout (the drawer already follows this); photo is the same Recreation.gov CDN `<img referrerpolicy=no-referrer>` the cards use (pre-existing external-image dependency, see §7); everything else baked.
- **Mobile/touch:** the drawer is already a full-height right sheet on desktop; make it a **bottom sheet** under ~640px (transform/translateY, reduced-motion-guarded), with a drag-affordance bar and large close target.
- **a11y:** `role="dialog" aria-modal` + focus trap already present; add `aria-labelledby` to the campground name, return focus to the invoking card on close, and ensure the card is a real `<button>`/link so it's keyboard-openable.

> Why these two ship together: the rail gives users a *reason* to dig in; the drawer gives them somewhere *premium to land*. Each alone is good; together they convert the finder from "search tool" to "guided catalog."

---

### QW1 — Hover/selection sync between list and map (bi-directional)
Today the relationship is cold: the list filters the map's data, but hovering a card does nothing to the map and clicking a pin doesn't highlight its card. Add a shared `state.activeId`: hovering/focusing a list card raises that pin (MapLibre `setFeatureState` → grow radius / copper halo via a `feature-state` paint expression) and, on click, `easeTo` the pin + scroll its card into view with a brief highlight; clicking a pin highlights+scrolls to the card. One small `feature-state` layer tweak + two delegated listeners.
- **Premium rationale:** the hallmark "this is a real map app" interaction (Airbnb/Zillow-class) — makes the two panes feel like one instrument.
- **Reuse:** existing `cg-pts` layer + `recordById()` + `wireMapInteractions()`; cards are already delegated-click. Highlight uses `--copper`.
- **CSP/China:** `setFeatureState` is core MapLibre, no network. Degrades to nothing if map is the stub.
- **Mobile/touch:** hover→use tap/focus only on touch (guard with a pointer check); don't hijack scroll. **a11y:** drive it off `focusin` on cards too, so keyboard users get the same sync; respect reduced-motion (`jumpTo` instead of `easeTo`).

### QW2 — Fit-aware clusters (donut/colored clusters instead of uniform copper)
At national zoom every cluster is the same copper bubble — informationally flat for a *fit* tool. Recolor/encode clusters by the fit mix of their members once a rig is set: use clustered aggregate properties (`clusterProperties` summing fits/tight/no counts) to drive a stepped color or a thin colored ring, so a glance shows "mostly green here, mostly red there."
- **Premium rationale:** the map finally *answers the page's question* (where does my rig fit?) at a glance, not just "where are campgrounds."
- **Reuse:** `addSource('cg', {cluster:true})` already there — add `clusterProperties`; `FIT_COLOR` palette already defined; `buildFeatures()` already computes per-point fit class.
- **CSP/China:** pure MapLibre expression, no network. Falls back to current uniform style if no rig set.
- **Mobile/touch:** unchanged tap-to-expand. **a11y:** clusters aren't keyboard targets; keep the list as the accessible source of truth (the summary already states counts).

### QW3 — Shareable curated trip (upgrade the saved tray's "Share")
The shortlist exists but can only be cleared/removed — it can't be *sent*. Add a "Share this list" action that encodes saved ids into a `saved=` URL param (cap ~12, comma-joined ids — mirrors the `compare()` module's `?ids=` pattern exactly) so a curated shortlist opens pre-populated for a friend. Optionally a "Compare these" button that reuses the tray table as a side-by-side.
- **Premium rationale:** turns a private bookmark into a shareable trip artifact — the social/“send to my partner” moment premium travel tools live on.
- **Reuse:** `compare()` already does `?ids=`+localStorage seeding; `buildShareUrl()` + clipboard + `fallbackCopy()` already written; the tray table is already a comparison grid.
- **CSP/China:** URL param only, no backend, no network. **Mobile/touch:** same copy-to-clipboard flash UI. **a11y:** announce "list link copied" (reuse the share button's flash pattern, add `aria-live`).

### QW4 — Editorial empty/loading/hero polish
The empty state is a single gray sentence; loading is a spinner; the hero is solid copy. Premium sites make these moments feel intentional. (a) Empty state: offer the nearest *fitting* alternatives ("Nothing fits a 33′ rig in Utah — here are the 6 closest that do") using the existing sort; (b) skeleton card shimmer instead of a bare spinner (reduced-motion → static); (c) hero gains a quiet stat strip ("2,561 sites · 47 states · matched to your real length") and a collection teaser.
- **Reuse:** `cg-empty`, `cg-loading`/`cg-spinner`, `cg-hero`, `--line`/`--surface` tokens, existing `visible()` sort. **CSP/China:** static/createElement. **Mobile/touch + a11y:** skeletons `aria-hidden`, keep the `aria-live` summary authoritative; ensure empty-state CTA is a real button.

### QW5 — "Fly to state/park" affordance
The state `<select>` filters the list but the map comment admits it "keeps map, filters list" — it doesn't move. Bake a small per-state (and per-NP-`parent`) centroid/bbox table at build time (computable from the lat/lon we already have — group + average, or min/max bbox) so choosing a state/collection **flies the map there** (`fitBounds`/`easeTo`).
- **Premium rationale:** filter and map finally agree; choosing "Utah" *takes you to Utah*. Removes the current dissonance.
- **Reuse:** centroid table generated in `build.mjs` from baked coords (pure, testable); `map.fitBounds` already available; `elState` listener already there (has a TODO stub for exactly this).
- **CSP/China:** centroids baked into the page JSON island, zero network. Degrades to list-filter-only if map is stub. **a11y:** selection still announced via summary; motion reduced-motion-guarded.

---

## 2. Quick-win vs flagship summary

| Rank | Upgrade | Effort | Depends on |
|---|---|---|---|
| ★ | **Curated Collections rail + in-place detail drawer** | FLAG | baked activity/org/rating predicates; reuses availability-drawer shell + Panel 3 suitability line |
| 1 | Hover/selection list↔map sync | QW | `setFeatureState`, existing layers |
| 2 | Fit-aware clusters | QW | `clusterProperties`, `FIT_COLOR` |
| 3 | Shareable curated trip (saved list) | QW | `compare()` `?ids=` pattern, `buildShareUrl` |
| 4 | Editorial empty/loading/hero | QW | existing tokens + `visible()` |
| 5 | Fly-to-state/park | QW | build-time centroid table from baked coords |

**Build order rationale:** QW1+QW2 make the *map* premium and are nearly free given clustering already exists. The flagship makes *discovery + evaluation* premium and is where the editorial bar is won — but it's larger, so land the two map quick-wins first to show momentum, then the rail, then the drawer (it reuses the availability shell so it's cheaper than it looks). QW3–QW5 are independent polish that can slot in any order.

---

## 7. Hard-constraint notes (honest)

- **China-robustness caveat (pre-existing, not introduced here):** the live `/api/search` viewport refresh, the availability drawer's month fetches, and every campground **photo** (`cdn.recreation.gov`) are third-party requests to `recreation.gov`. These already ship today. The *static* baked set + self-hosted basemap/glyphs are the China-safe core and the offline/blocked fallback, and the UI labels source honestly. **None of my proposed upgrades add a new third-party dependency** — collections, sync, clusters, trip-sharing, empty states, and fly-to are all pure client logic over baked data. If the goal is full China-robustness, the separate "Cloudflare Pages Function to proxy recreation.gov" track (already on Ernie's options list) is the right home for the photo/live/availability calls; that's out of this panel's scope.
- **CSP-safe:** every proposal uses createElement/textContent and delegated listeners (the module's existing style); no `eval`, no `innerHTML` with dynamic data, no inline handlers. New shareable state (`col=`, `saved=`) extends `share.mjs`'s pure encode/decode (testable, mirrored client-side).
- **No commerce/finance:** none of these touch booking/payment; the Recreation.gov link remains the only outbound action and is informational.
- **Palette discipline:** reuse `--copper`/`--copper-deep`/`--line`/`--surface`/`--muted` and the existing `FIT_COLOR` map; no parallel palette. Fit-green/amber/red is the one established non-token color set and is reused, not redefined.
- **Progressive enhancement:** with JS off, the server-rendered list scaffold + Recreation.gov links remain (existing `<noscript>`); with WebGL/map off, `mapStub()`+`showMapUnavailable()` already keep the list authoritative; collections degrade to plain server-rendered links if scripting fails.
- **Testing:** new predicates (collections, centroids, `col=`/`saved=` round-trips) are pure functions in `campgrounds.mjs`/`share.mjs` → add to `campgrounds.test.mjs`/`share.test.mjs` following the existing `okItem()`/round-trip conventions; render-structure tests assert the rail/drawer markup + no `</` breakout, matching the established security-test pattern.
