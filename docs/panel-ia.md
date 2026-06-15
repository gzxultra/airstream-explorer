# Upgrades page — Information Architect IA proposal

**Role:** Information Architect, 5-member design panel.
**Scope:** Design proposal only. No code or data changed. This is the IA contract the
other panelists (Visual/Editorial, Front-end, Product/UX, Enthusiast) build against.

**Brief recap:** the owner wants the Upgrades module rebuilt around real
forum/community *consensus* (not manufacturer marketing), with visible source links,
organized the way enthusiasts actually think about mods. Today the data has no
consensus/popularity signal and categories are topical only.

**Hard constraints honored:** static hand-rolled build (no SPA/framework/new deps);
China-network robust (everything self-hosted, zero external CDN at runtime); NO commerce
(prices are reference-not-quote); premium editorial aesthetic. **Data-model contract to
preserve: every item keeps a `type` (Factory/Aftermarket/Both) + ≥1 real source URL.**
The existing validator in `src/lib/upgrades.mjs` enforces that and must keep passing.

---

## TL;DR — my single recommendation

1. **Category scheme:** **Hybrid.** Keep topical sections as the backbone (re-cut to 6),
   and add ONE editorial lead strip — **"Start here: essential first mods"** — plus a
   *use-case* filter layer (Boondocking / Full-timing / Towing & safety / Comfort) that
   re-slices the same items without duplicating them. Topical = where things *live*;
   use-case = a lens you switch on. No item appears in two sections.
2. **Consensus field:** add **`consensus`** to every item, an ordered enum:
   **`"Near-universal"` › `"Frequently recommended"` › `"Enthusiast favorite"` › `"Niche"`**.
   Optional `consensusNote` (one short clause on *who* says so). Sort each section by this
   tier; power the new lead strip and a "Most-recommended" sort from it.
3. **Citations:** promote out of the buried `<details>`. Show a **visible source row** of
   **domain chips**, each chip **classed forum/community vs manufacturer/retailer** so the
   community evidence reads at a glance. Keep an expandable "full sources" only for overflow.
4. **Factory vs aftermarket:** keep the `type` badge, **do not split into separate sections.**
   Add it as a filter facet and a subtle card treatment so factory options are visually
   distinct inline.
5. **Filters:** **yes — add filter chips**, mirroring the Explore page's existing vanilla-JS
   `data-*` + `aria-pressed` + `hidden` pattern (progressive enhancement, no framework, no
   CDN). Three facets: **Use-case · Type · Consensus**, plus a "Most-recommended" sort.
6. **Item count:** grow from **19 → ~26–30**, fewer thin one-line entries, more depth on the
   high-consensus core. Quality of consensus signal matters more than raw count.

---

## 1. Category scheme — recommended: HYBRID (topical backbone + first-mods strip + use-case filter)

### Why hybrid, not pure use-case
- **Pure topical (today):** matches where a part physically belongs, but gives a newcomer no
  sense of *sequence* or *priority* — every category looks equally important, and the page
  reads like a catalog, not advice.
- **Pure use-case ("Boondocking / Full-timing / Towing"):** matches how enthusiasts *talk*,
  but it forces hard duplication. A soft start belongs to both "Boondocking" and "Comfort";
  a TPMS is "Towing" and "Full-timing." Duplicating items breaks the one-source-per-item
  contract's clarity and doubles maintenance. Use-case is a *lens*, not a *home*.
- **Hybrid wins:** keep one canonical topical home per item (no duplication, validator stays
  simple), express priority through the **consensus** field + a highlighted **first-mods
  strip**, and let enthusiasts re-slice by **use-case via a filter** that just shows/hides
  the same cards. Best of both with zero data duplication.

### Recommended sections (6 topical, re-cut from 5)

Re-cut rationale: today's "Interior, storage & comfort" (5 items) quietly mixes three jobs —
exterior protection/security, interior comfort, and quality-of-life DIY. Splitting clarifies
and makes room for growth. Power stays the anchor.

| # | Section id | Title | What lives here (moves noted) |
|---|-----------|-------|------------------------------|
| — | `first-mods` | **Start here: essential first mods** *(highlighted strip, not a topical bucket)* | A curated, ordered lead row of the **Near-universal** items pulled from the sections below by `consensus`, not a separate data category. See §2. |
| 1 | `power` | **Power: lithium, solar & inverters** | Unchanged core (lithium, solar, inverter, DC-DC) + keep the per-model factory solar/lithium table. The site's most-recommended path — stays first. |
| 2 | `climate` | **Climate: A/C, heat & insulation** | Soft start, second A/C w/ heat pump, AirSkirts skirting; add: vent fan upgrade (MaxxAir/Fan-Tastic), reflective window/vent insulation. |
| 3 | `towing` | **Towing & safety** | WD/anti-sway hitch, TPMS, surge/EMS, leveling & chocks. Move **anti-theft/hitch locks** here from Interior (it's a hitch/towing-adjacent security item). |
| 4 | `electrical-control` | **Monitoring & connectivity** *(new, small)* | Battery monitor/shunt (Victron SmartShunt), cellular/Wi-Fi booster (WeBoost/Starlink mount), surge-adjacent system monitoring. Splits "electronics you watch the system with" out of Power so Power stays about generation/storage. |
| 5 | `water` | **Water & plumbing** | Pressure regulator, inline/multi-stage filter, shower recirc valve; add: composting/upgraded toilet, macerator or upgraded sewer hose kit. |
| 6 | `interior` | **Interior & comfort** | Window tint, glass skylight, 170° hinges; add: mattress replacement (top-cited comfort mod), LED/lighting swap, surface/table or storage organizers. |
| 7 | `exterior` | **Exterior protection & security** *(new, small)* | Stainless trim & rock/window guards (moved from Interior), anti-theft locks share a cross-link from Towing, wheel-well/belly protection. |

> If the panel wants to hold the section count down, `electrical-control` and `exterior`
> can fold back into `power` and `interior` respectively — they are the soft splits. The
> non-negotiable structural change is the **first-mods strip + use-case filter**, which is
> what actually delivers "organized how enthusiasts think."

### The "Start here" strip (the editorial heart of the redesign)
- A single horizontally-prominent strip above the topical sections, rendered from items where
  `consensus === "Near-universal"` (cap ~6–8), in a recommended-sequence order.
- These cards are **references, not duplicates** — they reuse the same item objects (rendered
  by `id`) so there's one source of truth. Implementation note for the Front-end panelist:
  render by pulling matching items, not by copying JSON.
- Gives the newcomer the "if you do nothing else, do these" answer enthusiasts always give —
  surge protector, WD/anti-sway hitch, TPMS, soft start, water pressure regulator, lithium+solar.

---

## 2. Consensus / popularity indicator — data-model proposal

### Exact field
Add to every item object:

```jsonc
{
  "name": "...",
  "type": "Factory | Aftermarket | Both",      // PRESERVED contract
  "consensus": "Near-universal",                 // NEW — required, enum (ordered)
  "consensusNote": "Airstream Club + forums treat it as non-negotiable", // NEW — optional, ≤120 chars
  "useCases": ["boondocking", "towing-safety"],  // NEW — optional, array of slugs (powers the use-case filter)
  "priceText": "...",
  "why": "...",
  "popular": "...",
  "sources": [ { "label": "...", "url": "..." } ] // PRESERVED contract, ≥1
}
```

### `consensus` allowed values (ordered, strongest → weakest)
1. **`"Near-universal"`** — comes up in essentially every owner thread / the Airstream Club
   carries-list / "do this first." (surge protector, WD hitch, TPMS, soft start, water regulator)
2. **`"Frequently recommended"`** — broadly endorsed, common but not literally everyone.
   (lithium, solar, inverter, EMS, leveling blocks, filter)
3. **`"Enthusiast favorite"`** — beloved by the people who do it; not everyone needs it.
   (170° hinges, window tint, glass skylight, ProPride premium hitch, big aftermarket solar build)
4. **`"Niche"`** — situational / preference-driven / specific climates or full-timers.
   (AirSkirts, composting toilet, shower recirc valve, second A/C in the deep South)

I recommend a **4-tier named enum over a tier 1–3 number or a raw count**:
- Named tiers are *editorial* (fits the premium aesthetic) and self-explaining; "Tier 2" is not.
- A raw **count-based** signal ("mentioned in 14 threads") implies a precision the data can't
  honestly support for a hand-curated reference site and invites "where's the number from?"
  challenges. The enum encodes the same judgment without faking a metric. `consensusNote`
  carries the *who* (e.g. "Airstream Club carries-list") so the claim stays verifiable via the
  same sources already required.

### How it's shown
- A small **consensus pill** on each card, color-stepped (strongest = warm copper/filled,
  weakest = muted outline) so the visual weight tracks the strength. Distinct from the
  existing `type` badge — they answer different questions ("how agreed?" vs "factory or not?").
- The `consensusNote`, if present, renders as a quiet sub-line under the pill.

### How it sorts
- **Within each topical section, default sort = consensus descending** (Near-universal first),
  ties broken by current author order. This makes every section lead with "what everyone says
  yes to," which is exactly the consensus-first intent.
- Add a page-level sort control **"Most-recommended"** (default) ↔ **"As listed / topical"**.
- **Yes to a lead strip** — the "Start here: essential first mods" strip in §1 is the
  consensus-driven "Top most-recommended" section the brief asks about. I prefer the honest
  label "essential first mods" over "Top 10": it's curated by tier, not a forced ranking to 10,
  and avoids implying a precise leaderboard the data can't defend.

---

## 3. Citation presentation — make community evidence visible, distinguish forum vs manufacturer

**Problem with today:** sources are a collapsed `<details>` ("Sources (2)"). For a page whose
*entire credibility pitch* is "real forum consensus, not marketing," hiding the evidence and
treating an Airstream marketing URL identically to a forum thread undercuts the premise.

### Proposal: a visible source-chip row, classed by source type
- Replace the buried `<details>` with a **visible "Why we list this" source row** of compact
  **domain chips** (e.g. `airforums.com`, `airstreamclub.org`, `airstream.com`), each chip a
  real link (`target=_blank rel="noopener nofollow"`, unchanged).
- **Visually distinguish source classes** with a chip class derived from the URL host at build
  time (no new data field strictly required, but optionally add `sourceType` per source for
  precision):
  - **Community / forum** (airforums.com, airstreamclub.org, reddit.com, youtube.com owner
    videos, irv2.com) → a distinct "community" chip style + a small people/forum glyph.
  - **Manufacturer** (airstream.com, support.airstream.com, battlebornbatteries.com,
    microair.net) → a neutral "official" chip style.
  - **Retailer/independent** (amazon.com, solar-electric.com, pagosasupply.co) → a third quiet
    style.
- This lets a reader instantly see *"this is backed by the Club + two forums"* vs *"this is
  Airstream's own page."* That distinction is the whole point of the rebuild.
- **Overflow:** show up to ~3–4 chips inline; if more, a quiet "+2 more" expands the rest. Keep
  the `<details>` only as the progressive-enhancement fallback container, not the primary UI.

### Optional data refinement (recommended, low cost)
Add `sourceType` to each source so classification doesn't rely on host-string heuristics:

```jsonc
"sources": [
  { "label": "Airstream Club — 36 Things Every Airstreamer Should Carry",
    "url": "https://blog.airstreamclub.org", "sourceType": "community" },
  { "label": "TST 507 6-sensor — retail price",
    "url": "https://www.amazon.com", "sourceType": "retailer" }
]
```
`sourceType` enum: `community | manufacturer | retailer`. Backward-compatible (optional);
the renderer falls back to host-based classing when absent, so the validator contract is
unchanged.

---

## 4. Factory vs aftermarket — keep the badge, add a facet, don't split sections

- **Do NOT split factory into its own section.** Owners think by *job* ("I need off-grid
  power"), not by *procurement channel*. Splitting would scatter the lithium/solar story
  (factory bundle vs aftermarket build) across two places — the current single Power section
  with its factory table + aftermarket cards is exactly right and should be the model.
- **Keep the existing `type` badge** (Factory / Aftermarket / Both) — it already works and
  satisfies the contract.
- **Add `type` as a filter facet** (see §5) so a buyer who only wants factory-orderable options
  can isolate them on demand, without the page being pre-split for everyone.
- **Light visual grouping inside a card grid:** optionally let factory options carry a subtle
  card treatment (e.g. a thin copper top-rule) so they're scannable inline. The per-section
  factory comparison **table** (today only in Power) is the right home for dense factory
  pricing/availability and can be reused in Climate (second A/C tiers) if it grows.

---

## 5. Filtering / navigation — add chips, reuse the Explore pattern

**Recommendation: add filter chips**, because the new dimensions (use-case, consensus, type)
are exactly the kind of slicing the Explore page already does well — and the brief explicitly
asks whether to mirror the floorplans page. The site **already ships the entire mechanism**:
`src/assets/js/app.js` filters Explore cards with `data-*` attributes, `aria-pressed` toggle
buttons, and `hidden` show/hide, server-rendered first and enhanced by vanilla JS. **No
framework, no new dependency, no external CDN** — fully inside the hard constraints.

### Proposed controls (top of the Upgrades page, under the hero)
- **Use-case chips** (from `useCases`): `Essential first mods` · `Boondocking & off-grid` ·
  `Full-timing` · `Towing & safety` · `Comfort & interior`. Multi-select, OR within facet.
- **Type chips** (from `type`): `Factory` · `Aftermarket`.
- **Consensus chips** (from `consensus`): `Near-universal` · `Frequently recommended` ·
  `Enthusiast favorite` · `Niche`.
- **Sort:** `Most-recommended` (consensus desc, default) ↔ `Topical (as listed)`.
- Jump-nav stays for the topical sections; filters layer on top of it.

### Implementation contract for the Front-end panelist (so it stays in-constraint)
- Each card emits `data-type`, `data-consensus`, `data-usecases="boondocking full-timing …"`,
  mirroring `renderExploreCard`'s `data-tags` approach.
- Filtering toggles `hidden`; **works with JS off** (everything server-rendered, all cards
  visible, sorted topically). JS is pure enhancement — same progressive-enhancement rule the
  panel already adopted for Explore.
- Reuse the existing chip/`aria-pressed` handler shape; do not add a new library.
- Keep a visible "X of N shown" + reset, matching Explore's empty-state pattern.

---

## 6. Item count — 19 → ~26–30, deepen the core

- Current 19 is thin for a page meant to be *the* consensus reference, and several entries are
  one-line stubs (shower recirc valve, glass skylight) while obvious high-consensus mods are
  missing (battery monitor/shunt, vent fan, mattress, connectivity/booster, composting toilet).
- Target **~26–30 items**: add the high-consensus and frequently-cited gaps named in §1, and
  give the **Near-universal** tier more depth (these are what the strip and most readers act on).
- **Quality > count:** the win is the consensus signal and visible sourcing, not sheer volume.
  Don't pad `Niche` items just to hit a number; every item must still clear the ≥1-real-source
  bar. Roughly: ~6–8 Near-universal, ~10–12 Frequently recommended, the rest split between
  Enthusiast favorite and Niche.

---

## "vs current" diff

| Dimension | Current | Proposed |
|-----------|---------|----------|
| **Categories** | 5 topical only | 6 topical (re-cut) **+ a "Start here: essential first mods" strip** + a use-case filter lens |
| **How priority is shown** | None — all items look equal | `consensus` tier pill + consensus-desc default sort + first-mods strip |
| **Data model** | `{name, type, priceText, why, popular, sources[]}` | **+`consensus` (required enum)**, **+`consensusNote` (opt)**, **+`useCases[]` (opt)**, **+`sources[].sourceType` (opt)** — all additive, contract preserved |
| **Consensus field** | — | `consensus`: `Near-universal` › `Frequently recommended` › `Enthusiast favorite` › `Niche` |
| **Citations** | Collapsed `<details> "Sources (n)"`, all sources equal | Visible domain-chip row, **forum/community vs manufacturer vs retailer classed differently**; overflow expands |
| **Factory vs aftermarket** | Badge only | Badge kept + **type filter facet** + subtle inline card treatment; **not** split into sections |
| **Sorting** | Author order within section | **Most-recommended (consensus desc) default**, toggle to topical |
| **Filtering** | Jump-nav only | **Filter chips: use-case · type · consensus**, vanilla-JS reusing Explore's `data-*`/`aria-pressed`/`hidden` pattern (no deps, no CDN) |
| **Item count** | 19 (some stubs) | ~26–30, deeper on high-consensus core |
| **Contract** | type + ≥1 source per item; validator enforces | **Unchanged** — every addition is optional or additive; validator keeps passing, extend it to also require `consensus` ∈ enum |

### Validator note (for the Front-end panelist)
Extend `validateUpgrades()` in `src/lib/upgrades.mjs` to also assert
`consensus` is present and ∈ the 4-value enum, and (if present) each `sources[].sourceType`
∈ `{community, manufacturer, retailer}`. Everything else in the existing contract stays as-is,
so the build keeps failing loudly on bad data — which is the page's whole credibility guarantee.
