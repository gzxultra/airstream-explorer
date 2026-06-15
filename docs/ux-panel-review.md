# Airstream Explorer — UX Panel Review (nav consolidation + UI/UX upgrade)

**Brief:** owner flagged 6 top tabs as too many. A 5-person panel (Information Architect, Product/UX Strategist, Visual/Editorial Designer, Front-end/Interaction Engineer, Enthusiast/Domain Advocate) proposed consolidations, cross-critiqued, and synthesized one plan. Planning only — no code changed.

**Hard constraints honored throughout:** static hand-rolled build (no SPA/framework); China-network robust (everything self-hosted, zero external CDN on critical path); NO commerce (enthusiast reference tool only); premium editorial aesthetic (Fraunces + DM Sans, copper, warm paper, cinematic heroes); Cloudflare Pages auto-deploy; 163 tests enforce structure/data invariants.

## Current state — 6 tabs
1. **Families** (`index.html`) — lineup grouped by 12 families, cinematic golden-hour hero per family. Entry point.
2. **Explore & match** (`explore.html`, ~76K, biggest) — all 59 floorplans (28×2025 + 31×2026), filter/sort by spec + tow-vehicle matcher.
3. **Compare** (`compare.html`) — pick floorplans → side-by-side spec matrix.
4. **Campgrounds** (`campgrounds.html`) — national finder: MapLibre map + clustering (self-hosted basemap), ~2561 campgrounds, length-fit logic, live Recreation.gov availability drawer.
5. **Upgrades** (`upgrades.html`) — owner-recommended factory + aftermarket options/mods, every item sourced + factory-vs-aftermarket tagged.
6. **Community** (`community.html`) — Creative-Commons owner photos "Airstream in the Wild." (`credits.html` = licenses, footer-linked, not in nav.)

Plus 59 per-floorplan detail pages (hero, official floorplan diagram, studio photos, spec table incl. CCC, official décor schemes).

---

## Panel positions

### 1. Information Architect
- **Core read:** Families + Explore & match + Compare are three doors into ONE job — choosing a trailer. That's the redundancy. Campgrounds, Upgrades, Community are each a distinct job.
- **Proposal — target 4 tabs:**
  - **Explore** ← Families + Explore & match + Compare (one hub, segmented control "By family ↔ All floorplans"; Compare becomes a selection-driven mode, not a tab)
  - **Campgrounds** (keep)
  - **Upgrades** (keep)
  - **Community** (keep, but a candidate to demote)
- **Merge map:** Families → Explore default view · Explore & match → Explore "All floorplans" view · Compare → selection tray/mode inside Explore · Campgrounds → tab · Upgrades → tab · Community → tab (or footer) · credits → footer (unchanged).
- **Top upgrades:** (1) segmented control instead of separate pages; (2) 4-item nav needs no hamburger on mobile — keep it persistent; (3) breadcrumb on detail pages back to family/hub.
- **Pushes back on:** merging Campgrounds into a "Planning" umbrella — different job, heaviest feature, don't bury it.

### 2. Product / UX Strategist (jobs-to-be-done)
- **Personas:** dreamer (browse by family, wants the romance) · spec shopper (filter all floorplans, tow match) · current owner trip-planning (campgrounds) · modder (upgrades). Community photos serve the dreamer + reassure the shopper, but rarely a destination of its own.
- **Verdict:** the 3-into-1 Explore merge serves a real funnel (dream → narrow by spec → compare), not just tidier chrome. Campgrounds + Upgrades are genuinely separate jobs and earn their tabs.
- **Top upgrades:** (1) make the dream→spec→compare flow continuous (don't force tab hops); (2) cross-link detail page → "where it fits" (campgrounds) and "popular mods" (upgrades); (3) Compare should accrue as you browse (tray), since nobody starts at Compare cold.
- **Pushes back on:** keeping Community as a primary tab — it's a supporting texture, not a job.

### 3. Visual / Editorial Designer
- **Worry:** the cinematic family entry is the brand's soul. If "all floorplans" (a dense spec table) becomes co-equal in one hub, the editorial first impression can get flattened into a database.
- **Resolution:** family grid stays the DEFAULT, full-bleed editorial view of Explore; the spec table is a deliberate second gear you shift into. You lose a tab, not the romance.
- **Top upgrades:** (1) tighten typographic scale — consistent eyebrow→H1→deck rhythm, larger Fraunces display on heroes, more line-height air; (2) calm the spec tables (lighter rules, copper only for emphasis, right-aligned numerals, tabular figures); (3) generous whitespace + a real grid on Explore; (4) restrained motion (slow hero fade/parallax, never bouncy).
- **Pushes back on:** any toggle/segmented control that looks like a generic SaaS pill switch — it must feel editorial (think magazine section dividers).

### 4. Front-end / Interaction Engineer
- **Feasibility:** the 3-into-1 merge is cheap — content already exists; mostly nav + a client-side view toggle and routing. Compare-as-tray needs client state across static pages → use `localStorage` + URL params (the site already does share-by-URL, so the plumbing exists).
- **Watch-outs:** (1) 163 tests assert page/nav structure — merging pages will touch those invariants; budget for it. (2) 59 detail-page routes and saved-shortlist/share state must not break. (3) Any new font weight or icon must be self-hosted (no CDN). (4) Map stays its own page — lazy-load only when Campgrounds opens; don't pull MapLibre into a shared hub.
- **Top upgrades:** (1) view toggle via progressive enhancement (works without JS → server-render both sections, JS just toggles visibility); (2) lazy-load studio photos + map; (3) keep Explore bundle lean (it's already the 76K page).
- **Pushes back on:** turning Explore into a client-rendered app — keep it static-first, JS only as enhancement.

### 5. Enthusiast / Domain Advocate (the real user)
- **Useful vs fluff:** family browse = yes (how enthusiasts think — by model line). All-floorplans spec filter + tow match = the single most useful tool here, must stay first-class. Compare = useful but only after you've shortlisted. Campgrounds length-fit = genuinely great, keep loud. Upgrades sourced list = exactly what owners want.
- **On Community:** owner photos are *inspiration and proof*, best woven INTO family/detail pages ("see it in the wild") rather than siloed in a tab most people click once. Honor the CC contributors with a credited gallery, but it doesn't need a top tab.
- **Guards the line:** no commerce, no "configure your build," no lead-gen. Keep it a reference tool.
- **Pushes back on:** any gimmick that smells like a buy-funnel (e.g. a flimsy "off-grid score" if it's not pure spec-derived; keep only if it's honest battery/solar→days math, kill if it's decoration).

---

## Cross-critique (the live tensions)

**A. Families + Explore merge — does the editorial entry survive?**
Designer raised the flag; IA + Product + Advocate converged on the fix: family grid is the *default* view of the hub, not a peer of the spec table. Ruling: **merge, with family-first as default.** Tension resolved, not papered over — the spec table must visibly feel like a second mode, not the landing.

**B. Where Community lands — tab vs woven-in.**
Advocate + Product: demote, weave photos into family/detail pages. Designer: keep a curated gallery so the CC work is honored. Ruling: **weave best shots into family/detail "In the wild" strips; keep a light gallery reachable from the footer (with credits), out of primary nav.** This is the panel's main "kill a tab" call beyond the 3-into-1.

**C. Compare — tab vs selection tray.**
IA + Engineer + Product agree fast: nobody lands on Compare cold. Ruling: **Compare = a tray that accrues as you tick floorplans anywhere → opens a compare view.** Low dissent.

**D. Should Campgrounds merge under a "Planning" umbrella with Upgrades?**
IA floated it. Advocate + Product pushed back hard: trip-planning (campgrounds) and outfitting (upgrades) are different jobs, and the map is the heaviest feature — burying it hurts. Ruling: **keep Campgrounds standalone; keep Upgrades standalone.**

**E. The off-grid / endurance score.**
Advocate flagged commerce-smell risk. Ruling: **keep only if it's pure spec-derived (battery Ah + solar W → realistic days off-grid) with sources; otherwise cut.** Verify before retaining — do not let it drift toward a buy-funnel.

---

## SYNTHESIS — recommendation

### Recommended nav: 6 → 4 (with a 3-tab "bolder" option)

| New tab | Absorbs | Notes |
|---|---|---|
| **Explore** | Families + Explore & match + Compare | Default = family grid (cinematic). Segmented control → "All floorplans" spec filter + tow matcher. Compare = selection tray → compare view. 59 detail pages live under this hub. |
| **Campgrounds** | (itself) | Distinct job, heaviest feature. Lazy-loaded map. Keep loud. |
| **Upgrades** | (itself) | Sourced factory + aftermarket reference. Keep. |
| **Community** | (itself) | KEEP at 4 tabs, OR demote → 3 tabs and weave photos into family/detail + footer gallery. |

- **4-tab** = safer, honors CC contributors with a visible home.
- **3-tab** = bolder (Explore / Campgrounds / Upgrades); Community photos become "In the wild" strips on family/detail pages + a footer-linked credited gallery. Panel leans **4** but flags **3** as defensible and cleaner. **Owner to choose.**
- credits.html stays a footer link (unchanged).

### Prioritized backlog

**P0 — highest leverage, clearly in-constraints**
- **Collapse nav 6→4:** build the **Explore** hub = Families + Explore & match + Compare. Segmented control "By family ↔ All floorplans"; Compare becomes a selection tray. *Directly answers the ask. Effort M (content exists; nav + view toggle + routing). Risk: touches the 163 structural tests + 59 detail routes — update invariants carefully.*
- **Family grid = editorial default of Explore.** *Preserves the cinematic entry. Effort S.*
- **Simplify top nav to 4 items, persistent, no hamburger on mobile.** *Effort S.*

**P1**
- **Compare-as-tray:** tick floorplans on family/detail/all-floorplans → floating "Compare (n)" tray → compare view. *Effort M. State via localStorage + URL params (share-by-URL plumbing exists).*
- **Weave "In the wild" community photos into family + detail pages**; demote Community from primary nav (if going 3-tab). *Effort M.*
- **Typographic hierarchy pass:** eyebrow→H1→deck rhythm, larger Fraunces display, calmer spec tables (tabular numerals, lighter rules, copper for emphasis only), more whitespace. *Effort M. Pure taste win.*
- **Mobile polish** on Explore filters + Campgrounds map. *Effort M.*

**P2**
- **Cross-links:** detail ↔ "where this fits" (campgrounds) ↔ "popular mods for this model" (upgrades). *Effort M–L. Cohesion.*
- **Recreation.gov proxy** (Cloudflare Pages Function) so campground photos/API survive the GFW. *Effort M. Known gap, not nav.*
- **Restrained motion pass:** slow hero fade/parallax, no bounce. *Effort S.*
- **Decide off-grid score:** keep (if pure spec-derived + sourced) or cut. *Effort S.*

### Key tradeoffs & dissents (carried forward, not resolved away)
- **Editorial vs database (A):** resolved by making family-first the default view, but the segmented control must *look* editorial, not like a SaaS pill — flagged for the designer at build time.
- **Community tab vs woven-in (B):** panel leans demote (3-tab); kept as an explicit owner choice because it trades CC-contributor visibility for a cleaner nav.
- **Campgrounds standalone (D):** firmly keep separate — the one merge the panel refused.

### Risks / verify before building
1. 163 tests assert nav + page structure — merging pages will break/extend invariants; plan the test updates.
2. Don't break 59 detail-page routes, saved-shortlist, or share-by-URL state.
3. Zero external CDN — any new font weight/icon must be self-hosted.
4. Compare tray needs client state across static pages — must degrade gracefully without JS.
5. Map must stay isolated/lazy on Campgrounds — don't pull MapLibre into the shared Explore bundle.
6. Confirm the off-grid score is honest spec math before keeping it.
