# Upgrades Module Redesign — Design Panel Proposal

**Status:** Proposal for owner review. **Nothing built yet.** No code or data changed.
**Panel:** Forum Researcher · Technical Accuracy Editor · Information Architect · Editorial Visual Designer · Skeptic/Constraints Guard (lead).
**Source docs:** `panel-forum-research.md`, `panel-accuracy.md`, `panel-ia.md`, `panel-visual.md` (in this folder).

---

## TL;DR — recommended direction (10 bullets)

1. **Rebuild the content around verified community consensus, not marketing.** Add a real `consensus` signal to every item, sourced from forum threads — not invented.
2. **Keep the card grid** (a numbered magazine list would break consistency with the family/detail/campgrounds pages). Add an "Essentials first" feature card atop each section.
3. **New data field `consensus`** — ordered enum: `Near-universal` › `Frequently recommended` › `Enthusiast favorite` › `Niche`. Shown as a tasteful copper **pip meter** (●●● / ●●○ / ●○○), never stars or a SaaS bar.
4. **Promote citations out of the buried `<details>`** into a visible **typed source-chip row** — forum/community chips elevated in copper, manufacturer neutral, retailer quietest. This makes "the community actually recommends this" legible at a glance, which is the whole point.
5. **Hybrid IA:** keep topical sections (the backbone), add a **use-case filter lens** (Boondocking / Full-timing / Towing & safety / Comfort) + Type + Consensus facets — reusing the Explore page's existing vanilla-JS filter pattern (no framework, works with JS off).
6. **Grow 19 → ~26–30 items:** add the genuinely high-consensus mods the page is missing (LED lighting, MaxxAir/Maxxfan vent fan, LevelMate Pro, mattress upgrade, brake controller, battery shunt/monitor, composting toilet, DC-DC + lithium-profile converter).
7. **Fix 4 wrong prices** the accuracy editor caught (AirSkirts badly understated; Equal-i-zer, ProPride, budget batteries off) and **soften/drop ~5 unverifiable dollar figures.**
8. **Cut or demote low-consensus filler:** AirSkirts (appeared in ZERO forum sources opened), second A/C heat-pump (factory spec, not a community mod), water pressure regulator (baseline), stainless trim/rock guards, 170° hinges.
9. **Two free bug-fixes found during research:** undefined CSS vars `--serif`/`--sans`/`--ink-soft` (comparison-table title silently not rendering in Fraunces), and the validator should be extended to enforce the new `consensus` enum so the build fails loudly on bad data.
10. **Honesty flags the owner must see:** Reddit was **unreachable** in the research environment (no r/Airstream vote counts verified), and several prices were confirmed via search snippets, not by loading each page. Both need a verification pass during the build before anything ships.

---

## A. Forum-sourced content shortlist

### Consensus tiers are evidence-based
Only **4 sources were opened and read in full** (the Forum Researcher refused to fabricate): two Airforums threads, the Airstream Club carry list, and a long owner build blog. Reddit could not be loaded. So consensus labels below are honest about strength, and the build phase must widen sourcing (especially Reddit) before publishing.

### Verified source URLs (opened & confirmed)
- ✓ `https://www.airforums.com/threads/what-are-your-top-3-5-mods-or-additions.1443198/` — ~20 owners listing top mods
- ✓ `https://www.airforums.com/threads/converting-2016-flying-cloud-to-lithium-ion-batteries-free-standing-solar-panels.1448404/` — lithium/solar/DC-DC build consensus
- ✓ `https://blog.airstreamclub.org/36-things-every-airstreamer-should-carry-air-gear` — official-adjacent club carry list
- ✓ `https://www.outsideonline.com/outdoor-gear/cars-trucks/diy-modifications-airstream` — long owner build (Bambi)
- **✗ Could NOT verify:** reddit.com/r/Airstream (unreachable), AirSkirts community consensus (no source found), YouTube/installer/vendor pages (affiliate snippets only — never used as sole source)

### Shortlist (ranked by verified consensus)

| # | Upgrade | Type | Why owners recommend | Consensus | In current 19? | Source |
|---|---------|------|----------------------|-----------|----------------|--------|
| 1 | Lithium (LiFePO4) conversion | Both | ~4× usable energy, lighter, fast charge; the anchor of the power build | Near-universal | ✅ keep | airforums 1448404 |
| 2 | Solar (rooftop &/or portable) | Both | Stay out for days off-grid; live rooftop-vs-portable debate | Near-universal | ✅ keep | airforums 1448404 |
| 3 | Leveling system + **LevelMate Pro** | Aftermarket | "My favorite improvement" repeated; campsites never level | Near-universal | ⚠ partial (levelers yes, LevelMate NEW) | airforums 1443198 |
| 4 | TPMS (TST 507) | Aftermarket | Blowouts shred bodywork; club recommends by name | Near-universal | ✅ keep | club carry list |
| 5 | EMS / surge (Progressive) | Aftermarket | Pedestal power fries electronics; club "Highly Recommended" | Near-universal | ✅ keep | club carry list |
| 6 | Multi-stage + drinking water filter | Aftermarket | Clean/safe water; named systems (Blu Tech/Seagull/Acuva) | Frequently rec. | ✅ keep | club carry list |
| 7 | **MaxxAir/Maxxfan vent fan** | Aftermarket | Powerful airflow, rain-proof, reduces A/C need | Frequently rec. | ❌ **NEW** | airforums 1443198 |
| 8 | **Mattress upgrade** | Aftermarket | Factory mattress widely disliked; topper/Douglas/Airstream Supply | Frequently rec. | ❌ **NEW** | airforums 1443198 |
| 9 | **LED lighting conversion** | Aftermarket | Cheap, universal, less battery draw | Frequently rec. | ❌ **NEW** | owner blog |
| 10 | DC-DC charger + lithium-profile converter + **shunt/cutoff** | Aftermarket | Safe alternator charging + accurate state-of-charge | Frequently rec. | ⚠ partial (DC-DC yes; shunt/converter NEW) | airforums 1448404 |
| 11 | A/C soft start (Micro-Air) | Aftermarket | Run A/C off inverter/small genset; cuts surge ~65–75% | Frequently rec. | ✅ keep | accuracy audit |
| 12 | **Brake controller** | Aftermarket | Club lists it FIRST; legally required | Frequently rec. | ❌ **NEW** | club carry list |
| 13 | Weight-distribution + anti-sway hitch | Aftermarket | Biggest towing-safety upgrade; Equal-i-zer / ProPride | Frequently rec. | ✅ keep | accuracy audit |
| 14 | **Composting toilet (OGO) / black-tank delete** | Aftermarket | One owner's single favorite; polarizing | Enthusiast favorite | ❌ **NEW** | owner blog |
| 15 | Glass skylight (Maxim) + clear door glass + tint | Aftermarket | View + light + heat control | Enthusiast favorite | ✅ keep (soften prices) | (snippets only) |

**Secondary/trending (lower verified signal — include only if sourced during build):** Starlink/5G + booster, GasStop + Mopeka propane monitors, backup camera (HaloView), induction cooktop, Oxygenics shower head + full cutoff valve.

### Current 19 — cut / demote / reframe
- **Cut or demote (low community heat):** AirSkirts (**zero forum sources opened mention it — and price was badly wrong**), Second A/C heat-pump (factory spec, not a community *mod*), Water pressure regulator (baseline, never celebrated), Stainless trim & rock/window guards (one weak mention), 170° soft-close hinges (a "fix," not a passion upgrade — could fold into a "small fixes" cluster).
- **Reframe:** "Shower recirc/mixing valve" → owners actually rave about the **Oxygenics head + full cutoff valve**, not the recirc valve (that was creator-driven). Inverter: loved by heavy-build owners, but casual owners skip it for a portable power station — don't imply universal.

---

## B. Information architecture proposal

**Recommended: HYBRID (topical backbone + use-case filter lens).**

- **Topical sections (where an item lives):** Power · Climate · Towing & safety · Monitoring & connectivity · Water · Interior · Exterior. (Re-cut from 5 → up to 7; the two new soft splits — `electrical-control`, `exterior` — can fold back into Power/Interior if the panel wants fewer. **This is the one open scheme question.**)
- **Use-case lens (a filter you toggle, not a duplicate section):** Boondocking · Full-timing · Towing & safety · Comfort. Pure use-case categorization was **rejected** because it forces hard duplication (a soft start is both boondocking and comfort).
- **"Start here: essential first mods" lead strip** — rendered *by reference* from the top-consensus items (not copied), so no duplication. This is the honest version of a "Top 10," labeled editorially.
- **New data fields (all additive/optional, contract preserved):**
  - `consensus` (required, enum): `Near-universal` | `Frequently recommended` | `Enthusiast favorite` | `Niche`
  - `consensusNote` (optional): who says so / which threads
  - `useCases[]` (optional): for the filter lens
  - `sources[].sourceType` (optional): `community` | `manufacturer` | `retailer`, with host-based fallback for back-compat
- **Default sort:** consensus-descending within each section.
- **Filters:** three facets (Use-case · Type · Consensus) + Most-recommended sort, built on the **existing Explore-page vanilla-JS `data-*` + `aria-pressed` + `hidden` progressive-enhancement pattern** — no framework, no new dep, no runtime CDN, works with JS off.
- **Factory vs aftermarket:** keep the badge, add as a filter facet, **do NOT split into separate sections** (owners think by job, not procurement channel — splitting scatters the lithium/solar story).
- **Validator:** extend `validateUpgrades()` to assert the new `consensus` enum so the build keeps failing loudly on bad data.

---

## C. Visual redesign proposal

**Layout — keep the card grid; add a "two gears" rhythm within each section.** An **"Essentials first" feature card** spans both columns (`grid-column: 1 / -1`, `border-top: 3px solid var(--copper)`, larger Fraunces name) for the section's top near-universal upgrade; the standard 2-up `.up-grid` follows. Minimal DOM change — a `.up-card--feature` modifier.

**Consensus signal — 3-stop copper pip meter + tier eyebrow.** No stars, no SaaS progress bar.
- **NEAR-UNIVERSAL ●●●** · **COMMONLY ADDED ●●○** · **SITUATIONAL ●○○**
- Pips are 7px CSS circles (no SVG), filled via `:nth-child` from new tokens `--consensus-strong / --consensus-common / --consensus-niche` + `--pip-off`.
- The uppercase tracked eyebrow word carries the accessible meaning and reuses the site's `.eyebrow` grammar. Sits under the card head, above price.

**Citations — typed source chips + "Cited from the community" disclosure.** Map each domain to a kind (`forum`/`maker`/`video`/`retail`) at build time.
- Forum/community chips **elevated in copper** (`rgba(176,92,50,.08)` wash, copper-deep text) so credibility reads first.
- Maker chips neutral ink-on-paper; retail quietest (dashed border).
- The `<details>` summary becomes a kicker — e.g. "Cited from the community · 2 forum" — making forum sourcing a feature, not a footnote.
- Glyphs are inline SVG, `stroke: currentColor`, self-hosted — no icon font.

**Top 4 polish moves:** (1) consensus pip meter; (2) typed source chips + community framing; (3) section-head copper kicker rule (`::before` 44px bar) + the feature strip; (4) card hover with igniting copper left-edge (`translateY(-3px)` to match `.card`) + warmer comparison table (faint copper zebra, sticky model column).

**Tokens:** existing `--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--copper`, `--copper-deep`, `--shadow`, `--radius`, `--maxw`, badge literals `#2f6b46`/`#6a5330`; **new** `--consensus-strong/-common/-niche`, `--pip-off`.

**Free bug-fix:** `var(--serif)`, `var(--sans)`, `--ink-soft` are referenced (site.css ~lines 1065/1069/1071/1072) but never defined in `:root` — the comparison-table title is silently not rendering in Fraunces. Add the aliases.

---

## D. What changes vs today

| Dimension | Today | Proposed |
|-----------|-------|----------|
| Sourcing | Mostly manufacturer/retailer homepages | Forum/community consensus, deep-linked, typed chips |
| Consensus signal | None | `consensus` enum + copper pip meter, default sort |
| Categories | 5 topical | 6–7 topical + use-case filter lens + "essentials first" strip |
| Items | 19 (some thin stubs) | ~26–30 (add LED, vent fan, LevelMate, mattress, brake controller, shunt, composting toilet…) |
| Citations | Buried `<details>` | Visible typed chips, community elevated |
| Filtering | Jump-nav only | Use-case · Type · Consensus facets (vanilla JS, JS-off safe) |
| Layout | Uniform card grid | Card grid + per-section feature card |
| Prices | 4 wrong, ~5 unverifiable | Fixed/softened; reference-only preserved |
| Bugs | Undefined CSS vars; validator gaps | Fixed; validator enforces new enum |

---

## E. Open questions for the owner (please weigh in)

1. **Item count:** grow to ~26–30 (recommended), or stay lean near 19 with deeper consensus? 
2. **Category count:** 7 topical sections, or fold the two new soft splits back so it stays 5? (The only non-load-bearing part of the scheme.)
3. **Add the use-case filter lens** (Boondocking/Full-timing/Towing/Comfort), or keep simple jump-nav?
4. **Reddit:** worth a dedicated verification pass during the build (it was unreachable in research), or proceed with Airforums + Club + owner-blog sourcing only?
5. **Polarizing mods** (composting toilet / lift kit): include with a clear "enthusiast favorite, not for everyone" framing, or leave off?
6. **Consensus labels:** are the four tiers (`Near-universal`/`Frequently recommended`/`Enthusiast favorite`/`Niche`) the right vocabulary, or do you want different wording?

---

## F. Panel disagreements + resolution

1. **Layout — magazine list vs card grid.** IA leaned toward a ranked editorial layout; Visual Designer argued a numbered list breaks site consistency. **Resolution:** keep the card grid + a per-section feature card — ranked feel without a different-looking page.
2. **Consensus as a count vs named tier.** IA considered a mention-count; Skeptic + Visual rejected it as fake precision a hand-curated reference can't honestly defend, especially with Reddit unreachable. **Resolution:** named enum tiers, honestly sourced.
3. **AirSkirts.** Currently on the page; Accuracy found the price badly wrong AND Forum found zero community sourcing. **Resolution: cut it** (or demote to `Niche` only if a real source turns up).
4. **Price hard-citing.** Accuracy confirmed several figures via search snippets, not full page loads. **Resolution:** flagged as a build-phase requirement — open & confirm AirSkirts, Equal-i-zer, ProPride, Epoch pages before publishing; soften/drop the unverifiable Claim-12 figures (tint/skylight/hinges) now.
5. **Scope creep (Skeptic).** Connectivity/Starlink, induction cooktop, backup cameras are trending but mostly secondary signal. **Resolution:** include only those that get a real source during the build; keep the page a non-commercial reference (no buy/affiliate), prices reference-only.

---

## Constraints check (Skeptic sign-off)

✅ Static site — all proposals are build-time render + vanilla-JS filtering, no framework/SPA/new deps.
✅ China-network robust — no new external CDN; fonts/icons self-hosted; citation links are click-through, not runtime loads.
✅ No commerce — consensus + why + sources only; no buy buttons/affiliate; prices reference-only.
✅ Premium editorial aesthetic — copper/Fraunces/DM Sans, consistent with family/detail/campgrounds.
✅ Data contract preserved — every item still has `type` + ≥1 real source URL; new fields additive/optional.
✅ `trailers.json` untouched.
