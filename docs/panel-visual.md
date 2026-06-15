# Upgrades Module — Editorial Visual Design Direction

**Author:** Editorial / Visual Designer (5-member panel)
**Status:** Design proposal only — no code changed.
**Brief:** Owner asked to "整个模块再弄好看点" (make the whole Upgrades module more beautiful), plus add two new concepts: a community **consensus/recommendation** signal and more prominent **forum source citations**.

This is concrete, CSS-level direction tied to the site's real design tokens. Every value below references the actual `:root` tokens in `src/assets/css/site.css` or the colors already hard-coded in the existing `.up-*` rules, so the result stays consistent with the family/detail/campgrounds pages. Static site, no framework, no CDN at runtime, no commerce styling.

---

## 0. Audit findings that shape this proposal

The existing tokens (verbatim from `:root`, lines 1–11):

```
--bg: #F4EFE6;        /* warm paper page background      */
--surface: #FBF8F2;   /* card / panel surface            */
--ink: #1F1B16;       /* primary text                    */
--muted: #6B6258;     /* secondary text                  */
--line: #E0D7C8;      /* hairline borders                */
--copper: #B05C32;    /* accent                          */
--copper-deep: #8A4524;/* accent text / hover            */
--shadow: 0 1px 2px rgba(31,27,22,.05), 0 8px 24px rgba(31,27,22,.06);
--radius: 2px;        /* the site's tight editorial radius */
--maxw: 1120px;
```

Type system (self-hosted, `src/assets/css/fonts.css`): **Fraunces** weights 500/600/700 (display, serif) and **DM Sans** weights 400/500/700 (body, sans). **No italic faces are bundled** — so do NOT specify `font-style: italic` on Fraunces; an italic eyebrow would synthesize/fault. Use let-spacing + caps for editorial emphasis instead.

The three type-badge colors already in the codebase (lines 1090–1092) — reuse these EXACT values everywhere consensus/source color logic touches, so nothing drifts:
- Factory green: text `#2f6b46`, wash `rgba(63,125,84,.10)`, border `rgba(63,125,84,.28)`
- Aftermarket copper: text `var(--copper-deep)`, wash `rgba(176,92,50,.10)`, border `rgba(176,92,50,.26)`
- Both gold: text `#6a5330`, wash `rgba(160,120,50,.12)`, border `rgba(160,120,50,.30)`

### ⚠️ Latent bug to fix while we're in here (flag, not in scope of "beauty")
Three rules in the Upgrades block reference **CSS variables that are never defined**:
- `.up-table-title` uses `font-family: var(--serif)` (line 1065)
- `.up-table thead th` and `tbody th` use `font-family: var(--sans)` (lines 1069, 1071)
- `.up-table tbody td` uses `color: var(--ink-soft, #4a4036)` (line 1072) — only this one has a fallback.

`var(--serif)` / `var(--sans)` resolve to nothing → those cells silently fall back to the browser default (inherited body DM Sans for `--sans`, which happens to be fine; but `--serif` on the table title falls to inherited DM Sans, so **the table title is currently NOT rendering in Fraunces** even though it should). Recommended fix as part of this pass — add the missing tokens to `:root` so intent matches reality:

```css
:root {
  /* font aliases (so existing var(--serif)/var(--sans) refs resolve) */
  --serif: 'Fraunces', Georgia, serif;
  --sans: 'DM Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  --ink-soft: #4A4036;       /* softer body ink, already used as a literal fallback */

  /* NEW consensus scale (see §2) — copper-family, derived from existing accents */
  --consensus-strong: #8A4524;   /* = copper-deep; "near-universal"           */
  --consensus-common: #B05C32;   /* = copper; "commonly added"                */
  --consensus-niche:  #A98C66;   /* warm taupe; "situational / personal taste" */
  --pip-off: rgba(176,92,50,.18);/* unfilled meter pip                         */
}
```
Adding `--serif`/`--sans` is purely corrective and makes the table title finally pick up Fraunces — a free polish win.

---

## 1. Recommended layout: **keep the grid, but make it an editorial two-tier within each section**

**Verdict: do NOT throw out the card grid for a full magazine list.** A numbered alternating-row layout sounds editorial but fights three things this page actually is: (a) a *reference* people scan and compare, where equal-weight cards read faster than a ranked list; (b) responsive — 2-up cards collapse cleanly, alternating full-bleed rows get awkward on mobile; (c) consistent with `.fam-grid` and `.cards`, the site's established visual grammar. A numbered list would make Upgrades look like a different site, violating the hard constraint.

**Instead, introduce a deliberate "two gears" rhythm per category — the one editorial move that adds romance without breaking the system:**

1. **A "Essentials first" featured strip** at the top of high-traffic categories (Power especially). The 1–2 near-universal upgrades render as a single wider *feature card* spanning both grid columns, with a copper hairline top-rule and a larger Fraunces name. This is the magazine "lede" — it gives the eye a clear entry and signals "start here" editorially, not commercially.
2. **The standard 2-up `.up-grid`** for everything else, unchanged in structure but polished (§4).

This is achieved with almost no DOM change — a feature item just gets a `.up-card--feature` modifier and `grid-column: 1 / -1`. The render loop can promote items where `it.consensus === 'strong'` (or an explicit `it.featured`) to the front and tag them.

```css
/* Feature strip: the "essential first mods" lede, spans the grid */
.up-card--feature {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1.15fr 1fr;   /* why-copy | popular+sources rail */
  gap: 0 32px;
  padding: 26px 28px 22px;
  border-top: 3px solid var(--copper);  /* the editorial top-rule */
  background:
    linear-gradient(180deg, rgba(176,92,50,.04), transparent 120px),
    var(--surface);
}
.up-card--feature .up-name { font-size: 25px; line-height: 1.12; }  /* vs 19px standard */
.up-card--feature .up-why  { font-size: 15px; }
@media (max-width: 860px) {
  .up-card--feature { grid-template-columns: 1fr; gap: 14px; padding: 22px 18px 18px; }
}
```

**Section header upgrade** (`.up-sec-head`) — currently a flat baseline row with a hairline. Make it read like a magazine department head: a copper kicker rule + the count as a set-apart numeral.

```css
.up-sec-head {
  display: flex; align-items: baseline; gap: 14px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 12px; margin-bottom: 18px;
  position: relative;
}
.up-sec-head::before {            /* short copper rule above the title */
  content: ""; position: absolute; top: -2px; left: 0;
  width: 44px; height: 3px; background: var(--copper);
}
.up-sec-head h2 { padding-top: 12px; }   /* clear the rule */
.up-sec-count {
  margin-left: auto;
  font: 700 11px/1 'DM Sans', sans-serif;
  letter-spacing: .14em; text-transform: uppercase; color: var(--muted);
}
.up-sec-count::before { content: ""; }   /* keep plain; the number speaks */
```

---

## 2. Consensus / popularity visual language — **the copper pip meter + tier eyebrow**

Owner wants "how strongly enthusiasts recommend this." Hard "no" on **star ratings** (consumer-review/commerce signal — wrong register) and **SaaS progress bars** (generic). The editorial answer is a **3-stop copper pip meter** paired with a **tier eyebrow word**, both drawn from the copper family so it reads as part of the brand, not a bolt-on widget.

### The model: 3 tiers, 3 pips
Three discrete, honest tiers (avoids false precision of a 0–100 score):

| Tier | Eyebrow label | Pips filled | Color token |
|------|---------------|-------------|-------------|
| `strong` | NEAR-UNIVERSAL | ●●● | `--consensus-strong` (#8A4524) |
| `common` | COMMONLY ADDED | ●●○ | `--consensus-common` (#B05C32) |
| `niche`  | SITUATIONAL | ●○○ | `--consensus-niche` (#A98C66) |

The eyebrow word does the heavy lifting (accessible, screen-reader friendly, no color-only meaning); the pips are the at-a-glance texture. This mirrors the site's existing `.eyebrow` treatment (12px, `.18em` tracking, uppercase, copper) so it feels native.

### Markup (render-side, ~6 lines)
```html
<p class="up-consensus is-strong">
  <span class="up-consensus-pips" aria-hidden="true"><i></i><i></i><i></i></span>
  <span class="up-consensus-label">Near-universal</span>
  <span class="up-consensus-meta">owners &amp; installers recommend this</span>
</p>
```

### CSS
```css
.up-consensus {
  display: flex; align-items: center; gap: 9px;
  margin: 0 0 10px;
  font: 700 11px/1 'DM Sans', sans-serif;
  letter-spacing: .12em; text-transform: uppercase;
}
.up-consensus-pips { display: inline-flex; gap: 4px; }
.up-consensus-pips i {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--pip-off);              /* unfilled = faint copper */
  display: inline-block;
}
/* fill pattern per tier */
.up-consensus.is-strong .up-consensus-pips i           { background: var(--consensus-strong); }
.up-consensus.is-common .up-consensus-pips i:nth-child(-n+2) { background: var(--consensus-common); }
.up-consensus.is-niche  .up-consensus-pips i:nth-child(1)    { background: var(--consensus-niche); }

.up-consensus-label  { color: var(--ink); }
.up-consensus.is-strong .up-consensus-label { color: var(--consensus-strong); }
.up-consensus.is-common .up-consensus-label { color: var(--consensus-common); }
.up-consensus.is-niche  .up-consensus-label { color: var(--consensus-niche); }
/* the trailing clause is quieter, sentence-case, not tracked */
.up-consensus-meta {
  font-weight: 500; letter-spacing: 0; text-transform: none;
  color: var(--muted); font-size: 12px;
}
@media (max-width: 480px){ .up-consensus-meta { display: none; } }  /* pips + label survive */
```

**Placement:** directly under `.up-card-head`, *above* `.up-price` — it's the first thing the eye should weigh after the name/type. On the feature card it can sit inline with the name as a right-aligned cluster.

**Why pips not a bar:** dots echo the round `.fam-plans`/`.up-badge` pills already on the site, sit on the 2px-radius/tight-geometry language, and at 7px read as a refined editorial mark rather than a dashboard gauge. Three stops keeps the data claim defensible (we're summarizing forum consensus, not measuring it).

**"Near-universal" eyebrow alternative for the feature card:** for `strong` items in the feature strip, you can additionally surface the eyebrow as a standalone kicker above the name (reusing `.eyebrow`) — e.g. `<p class="eyebrow">THE FIRST UPGRADE MOST OWNERS MAKE</p>` — pure editorial framing, no new CSS.

---

## 3. Source citations — **community vs manufacturer chips + a "cited from the community" footer**

Today sources hide inside a `<details>` "Sources (3)" disclosure (`.up-sources`). The brief wants forum citations *more prominent and credible* without a link dump. Two-part treatment:

### 3a. Domain-typed source chips (replace bare `<li><a>` with chips)
Every source URL maps to a **kind** — `forum` (community) vs `maker` (manufacturer/official) vs `video` vs `retail`. Derive from the domain at build time. Real domains already in `upgrades.json`:

- **maker:** `airstream.com`, `support.airstream.com`
- **forum/community:** `airstreamclub.org` / `blog.airstreamclub.org`, `rv.com`, installer write-ups (`sotasolar.com`, `pagosasupply.co`)
- **video:** `youtube.com`
- **maker (component brands):** `battlebornbatteries.com`, `microair.net`, `equalizerhitch.com`, `store.propridehitch.com`, `solar-electric.com`
- **retail:** `amazon.com`

Chips, not a list. Each chip = a tiny self-hosted inline-SVG glyph + domain label. The community/forum chip is visually elevated (copper wash) so forum credibility reads first; maker chips are neutral; this is the visual distinction the brief asks for.

```css
.up-sources[open] > ul,
.up-srcs {
  list-style: none; margin: 8px 0 0; padding: 0;
  display: flex; flex-wrap: wrap; gap: 7px;
}
.up-srcs li { margin: 0; }
.up-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px 5px 8px;
  font: 600 12px/1 'DM Sans', sans-serif; letter-spacing: .01em;
  border: 1px solid var(--line); border-radius: 999px;
  background: var(--surface); color: var(--ink);
  transition: border-color .15s ease, background .15s ease, transform .12s ease;
}
.up-chip:hover { text-decoration: none; transform: translateY(-1px); border-color: var(--copper); }
.up-chip svg { width: 13px; height: 13px; flex: 0 0 auto; opacity: .85; }

/* FORUM / COMMUNITY — elevated, copper, this is the credibility signal */
.up-chip.is-forum {
  background: rgba(176,92,50,.08);
  border-color: rgba(176,92,50,.26);
  color: var(--copper-deep);
}
.up-chip.is-forum svg { opacity: 1; }
/* MAKER / OFFICIAL — neutral but trustworthy, ink-on-paper */
.up-chip.is-maker  { background: var(--surface); border-color: var(--line); color: var(--ink); }
/* VIDEO — subtle, secondary */
.up-chip.is-video  { color: var(--muted); }
/* RETAIL — quietest; never commerce-styled, just a reference */
.up-chip.is-retail { color: var(--muted); border-style: dashed; }
```

### 3b. Keep the disclosure, but lead with a credibility eyebrow + count split
Replace the flat "Sources (3)" summary with a typed summary that previews the *kind* of sourcing, so forum-backed items signal credibility before expanding:

```html
<details class="up-sources">
  <summary>
    <span class="up-sources-eyebrow">Cited from the community</span>
    <span class="up-sources-count">3 sources · 2 forum</span>
  </summary>
  <ul class="up-srcs"> …chips… </ul>
</details>
```

```css
.up-sources { margin-top: auto; border-top: 1px solid var(--line); padding-top: 10px; }
.up-sources summary {
  cursor: pointer; list-style: none;
  display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
  padding: 2px 0;
}
.up-sources summary::-webkit-details-marker { display: none; }
.up-sources-eyebrow {
  font: 700 10.5px/1 'DM Sans', sans-serif;
  letter-spacing: .1em; text-transform: uppercase; color: var(--copper-deep);
}
.up-sources-count { font-size: 12px; color: var(--muted); }
.up-sources summary::after {           /* affordance chevron, CSS-only */
  content: "›"; margin-left: auto; color: var(--muted);
  transform: rotate(90deg); transition: transform .15s ease;
  font-size: 15px; line-height: 1;
}
.up-sources[open] summary::after { transform: rotate(-90deg); }
```

The phrase **"Cited from the community"** + the **"· 2 forum"** count is the editorial treatment that makes sourcing feel like a feature, not a footnote — and it directly answers "make forum citations more prominent" without dumping a wall of links.

---

## 4. Module polish — component-by-component CSS

### 4a. The `.up-card` itself — warmer, more deliberate, magazine hover
```css
.up-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 22px 22px 18px;
  box-shadow: var(--shadow);
  display: flex; flex-direction: column;
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
}
.up-card:hover {
  transform: translateY(-3px);                 /* matches .card hover, line 121 */
  box-shadow: 0 2px 4px rgba(31,27,22,.06), 0 16px 40px rgba(31,27,22,.12);
  border-color: var(--line);
}
/* a thin copper left-edge that ignites on hover — ties to .up-popular's copper rule */
.up-card { position: relative; }
.up-card::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 2px;
  background: var(--copper); opacity: 0; transition: opacity .16s ease;
  border-radius: var(--radius) 0 0 var(--radius);
}
.up-card:hover::before { opacity: .9; }
```
> Rationale: the home `.card` already lifts `translateY(-3px)`; matching it makes Upgrades feel of-a-piece. The igniting copper edge is the single "premium" flourish — restrained, brand-colored, reversible.

### 4b. Card head & price — tabular price, tighter hierarchy
```css
.up-name { font-size: 19px; line-height: 1.18; }   /* unchanged, already good */
.up-price {
  font: 700 14px/1.3 'DM Sans', sans-serif;
  color: var(--copper-deep);
  font-variant-numeric: tabular-nums;              /* aligns $ across cards — matches .fam-range */
  letter-spacing: .01em; margin: 0 0 12px;
}
/* price gets a hairline lead so it reads as a spec, not a sales price (anti-commerce) */
.up-price::before {
  content: "Typical "; font-weight: 500; color: var(--muted);
  font-size: 11px; letter-spacing: .06em; text-transform: uppercase;
  margin-right: 6px;
}
```
> The "Typical" prefix is deliberate anti-commerce framing — reinforces this is a reference, not a store, per the hard constraint and the existing footer disclaimer.

### 4c. "What owners pick" callout (`.up-popular`) — keep, refine into a pull-quote
This is already the best component on the page. Elevate it slightly so it reads as an editorial pull-quote, the human voice of the module:
```css
.up-popular {
  font-size: 13px; line-height: 1.58; color: var(--ink-soft);
  margin: 0 0 14px; padding: 12px 14px;
  background: rgba(176,92,50,.05);
  border-left: 2px solid var(--copper);
  border-radius: 0 var(--radius) var(--radius) 0;
}
.up-popular-label {
  display: inline-flex; align-items: center; gap: 6px;
  font: 700 10.5px/1 'DM Sans', sans-serif;
  letter-spacing: .09em; text-transform: uppercase; color: var(--copper-deep);
  margin-bottom: 5px;
}
/* tiny inline-SVG "owners" glyph before the label (self-hosted, §5) */
.up-popular-label svg { width: 13px; height: 13px; }
```

### 4d. Comparison table (`.up-table`) — finish the editorial job (and fix the Fraunces bug)
With `--serif`/`--sans` now defined (§0), the title renders correctly. Add zebra warmth + a sticky row-header so wide tables stay legible:
```css
.up-table-wrap {
  background: var(--surface);                 /* was #fff — use surface for warmth/consistency */
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 24px 24px 18px; margin: 0 0 26px;
  box-shadow: var(--shadow);
}
.up-table-title { font-family: var(--serif); }   /* now actually Fraunces */
.up-table tbody tr:nth-child(even) th,
.up-table tbody tr:nth-child(even) td {
  background: rgba(176,92,50,.025);           /* barely-there copper zebra */
}
.up-table tbody th {                          /* sticky model-name column on mobile scroll */
  position: sticky; left: 0; background: var(--surface);
}
.up-table tbody tr:hover th,
.up-table tbody tr:hover td { background: rgba(176,92,50,.06); }
.up-table thead th { border-bottom: 2px solid var(--copper); }  /* unchanged, already strong */
```

### 4e. Jump nav (`.up-jump`) — make it a sticky department rail
Currently a static pill row. Make it sticky like `.controls` (line 105) so the category switcher follows on long scrolls, and mark the active section:
```css
.up-jump {
  position: sticky; top: 0; z-index: 9;
  background: linear-gradient(var(--bg) 72%, transparent);
  padding-top: 12px; padding-bottom: 12px;
}
.up-jump a {                                  /* unchanged base look */
  background: rgba(176,92,50,.08); border: 1px solid rgba(176,92,50,.20);
}
.up-jump a:hover { background: rgba(176,92,50,.16); }
.up-jump a[aria-current="true"] {             /* set via tiny scroll-spy or :target-within */
  background: var(--copper); color: #fff; border-color: var(--copper);
}
```
> Scroll-spy is optional JS; if avoiding JS, `:target` styling on the section gives a lightweight active hint with zero script.

### 4f. Spacing rhythm
- Section gap `.up-sec { margin: 0 0 56px; }` (was 52 — slightly more air between departments).
- Grid gap `.up-grid { gap: 22px; }` (was 18 — matches `.cards` 24/`.fam-grid` 26 family, reads less cramped).
- Card internal vertical rhythm: name → consensus → price → why → popular → sources, each block `margin-bottom` on a 10/12/14 step so the eye descends predictably.

### Four highest-impact moves (if time is limited, do these)
1. **Consensus pip meter + tier eyebrow** (§2) — the headline new feature, biggest perceived upgrade.
2. **Typed source chips with the "Cited from the community" treatment** (§3) — delivers credibility + the forum-prominence ask.
3. **Section-head copper kicker rule + the "Essentials first" feature strip** (§1) — turns a flat grid into something that reads editorial/magazine.
4. **Card hover copper-edge + warmer table (zebra + Fraunces-title bugfix)** (§4a, §4d) — the "premium finish" pass that also quietly fixes a real rendering bug.

---

## 5. Iconography — inline SVG only, self-hosted, no icon font

All glyphs are **inline SVG** in the render module (or a tiny `src/assets/icons/*.svg` set referenced via `<svg><use>` with a self-hosted sprite). **No Font Awesome / icon-font CDN.** Keep them 13×13, `stroke: currentColor`, `stroke-width: 1.6`, `fill: none` so they inherit the chip/label color and stay hairline-consistent with the site's 1px borders. Five glyphs cover everything:

- **forum chip** — speech-bubbles (community voice)
- **maker chip** — small certificate/seal or factory outline (official)
- **video chip** — play triangle in rounded square
- **retail chip** — simple tag outline
- **"What owners pick" label** — a small people/owners mark

Example (forum, paste inline; `currentColor` makes it adopt `.up-chip.is-forum`'s copper):
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 9 9 0 0 1-3.9-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/>
</svg>
```
The pip meter (§2) is pure CSS circles — **no SVG needed**, which is even more robust.

---

## 6. Consistency check against the rest of the site
- **Radius:** everything uses `var(--radius)` (2px) except the round pills/chips (999px) — exactly how `.up-badge`, `.up-jump`, `.fam-plans` already behave. ✓
- **Hover lift:** `translateY(-3px)` matches `.card`; feature/family use `-4px`. We stay at -3 for cards. ✓
- **Color:** consensus + chips + edges all drawn from the existing copper/green/gold trio — no new hues introduced except `--consensus-niche` taupe (#A98C66), a desaturated copper that sits in-family. ✓
- **Type:** Fraunces 600 for names/titles, DM Sans 500/700 for labels/eyebrows; tracking `.09–.18em` uppercase for all kickers, identical to `.eyebrow`/`.fam-flag`/`.up-sec-count`. No italics (none bundled). ✓
- **Anti-commerce:** "Typical" price prefix, "Cited from the community" framing, reference-tone disclaimers retained; zero buy buttons, carts, or price-CTA styling. ✓

---

## 7. Open questions for the panel / owner
1. **Where does the consensus tier come from?** It must be an honest, sourced field (`it.consensus: "strong"|"common"|"niche"`) in `upgrades.json`, ideally justified by the same forum sources — otherwise the pip meter manufactures authority we can't defend. Recommend the data/IA member owns deriving it.
2. **Scroll-spy for active jump-nav** — JS (~15 lines, IntersectionObserver) or CSS-`:target` only? Engineer's call; design works either way.
3. **Feature-strip promotion rule** — auto-promote `consensus === "strong"` items, or an explicit `featured: true`? Recommend explicit, max 1 per category, to keep the "lede" meaningful.
