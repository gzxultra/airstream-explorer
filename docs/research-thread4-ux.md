# Research Thread 4 — Premium UX / Editorial Benchmark

**Scope:** What makes top-tier editorial & product-reference sites read genuinely high-end, translated into concrete, on-brand, China-safe upgrades for our Fraunces + DM Sans system.
**Status:** Research/plan only. No site code changed.
**Hard constraints honored:** no Google Fonts (fonts stay self-hosted), no external CDN/JS, no external map tiles, everything static, no commerce, premium editorial bar.

---

## 0. Audit findings that shape every recommendation

Before any upgrade, four facts about our current build constrain (and sharpen) the plan:

1. **Our self-hosted fonts are STATIC instances, not the variable font.** `src/assets/css/fonts.css` ships:
   - DM Sans: weights **400, 500, 700** (latin + latin-ext woff2)
   - Fraunces: weights **500, 600, 700** (latin + latin-ext + vietnamese woff2)
   These are Google's `css2` static cuts. **The `opsz` / `SOFT` / `WONK` axes are NOT in these files** — they cannot be driven by CSS today. Any recommendation that exploits Fraunces' optical-size or wonk axes requires us to **self-host the Fraunces *variable* woff2** first (see §1.6). This is the single biggest unlock and the one thing the brief's "exploit Fraunces' axes" ask depends on.
2. **The CSS is already mature and token-driven.** `:root` in `site.css` defines `--bg #F4EFE6`, `--surface #FBF8F2`, `--ink #1F1B16`, `--muted #6B6258`, `--line #E0D7C8`, `--copper #B05C32`, `--copper-deep #8A4524`, `--shadow`, `--radius: 2px`, `--maxw: 1120px`. Recommendations must reference these, not invent a parallel palette.
3. **Motion today is minimal and tasteful** — short `transform`/`box-shadow` transitions on cards (`.16s`), `scale(1.045)` image zoom on hover, a few `@keyframes` (cgPinPulse, cgFade, cgSlide, cgSpin) **already correctly guarded** by `@media (prefers-reduced-motion: reduce)` in the campgrounds module. There is **no scroll-reveal and no view-transition** anywhere yet. Hover states are mostly not touch-guarded.
4. **JS is CSP-safe vanilla** (`app.js`, 1840 lines): "no eval, no innerHTML with untrusted strings, no inline handlers," module pattern guarded by element presence. There is **no IntersectionObserver** today. Any motion JS we add must follow this same CSP-safe, progressive-enhancement pattern. There is **no framework and no runtime external dependency** — keep it that way.

The good news: nearly every premium technique below is **pure CSS or ≤30 lines of vanilla JS**, ships from our own origin, and degrades to the current (already decent) experience when unsupported. Nothing here needs the GFW-blocked network.

---

## 1. Typography & hierarchy

### 1.1 Fluid type scale with `clamp()` (replace scattered ad-hoc clamps)
**Technique:** Define a single modular type scale as custom properties using `clamp(min, preferred-with-vw, max)` so type scales smoothly between viewports with no breakpoints. Utopia's method: pick min/max font size at min/max viewport + a modular ratio, let the browser interpolate ([Utopia / Smashing](https://www.smashingmagazine.com/2021/04/designing-developing-fluid-type-space-scales/)).

**Why it reads premium:** Consistent, intentional rhythm at every width. Our headings already use one-off `clamp()` calls (`clamp(40px,7vw,72px)`, `clamp(34px,6vw,56px)`, `clamp(34px,6vw,60px)`, etc.) — at least four different hero scales that don't share a ratio. A unified scale removes the "assembled from parts" feeling that separates good sites from great ones.

**On-brand, China-safe how-to:** Add a token block in `:root` (no network, pure CSS). A ~1.25 (major third) ratio suits an editorial catalog. Example shape (tune in the build):
```css
:root{
  --step--1: clamp(0.83rem, 0.80rem + 0.15vw, 0.94rem);  /* small caption */
  --step-0:  clamp(1.00rem, 0.96rem + 0.20vw, 1.13rem);  /* body */
  --step-1:  clamp(1.25rem, 1.16rem + 0.45vw, 1.56rem);  /* card title */
  --step-2:  clamp(1.56rem, 1.40rem + 0.80vw, 2.19rem);  /* section h2 */
  --step-3:  clamp(1.95rem, 1.66rem + 1.45vw, 3.05rem);  /* detail h1 */
  --step-4:  clamp(2.44rem, 1.95rem + 2.45vw, 4.39rem);  /* hero h1 */
}
```
Then `h1{font-size:var(--step-4)}` etc. Keep `rem` so it respects user zoom (accessibility). Migrate the existing one-off clamps to these tokens. **No GFW risk — it's just CSS math.**

### 1.2 Optical line-length (measure) and leading discipline
**Technique:** Cap body measure at **60–75ch**; pair longer measure with looser leading, shorter measure with tighter. We already do this well in places (`.detail-desc{max-width:64ch}`, `.lede{max-width:60ch}`, `.decor-intro{max-width:64ch}`) — the upgrade is to make it *systematic* via a token and apply it everywhere prose runs full-bleed.

**Why it reads premium:** A controlled measure is the single most reliable signal of "designed by someone who reads." Uncapped paragraphs that run 100+ characters at desktop are the #1 tell of a templated site.

**How-to:** `:root{--measure:66ch}` then `.prose, .detail-desc, .lede, .decor-intro{max-width:var(--measure)}`. Body `line-height:1.55` (current) is good for the 16px body; tighten display headings (already `line-height:1.1`). Add `line-height:1.05–1.1` consistency across all hero/`h1`. Pure CSS.

### 1.3 Tabular, lining figures for ALL spec data
**Technique:** `font-variant-numeric: tabular-nums lining-nums;` on every numeric cell so digits share one advance width and align in columns; numbers of equal magnitude become equal length, scannable down a column ([Datawrapper / data.europa.eu PDF](https://data.europa.eu/sites/default/files/course/5.4_ChoosingFonts.pdf)).

**Why it reads premium:** Spec tables are the heart of this site (length, GVWR, CCC, sleeps, MSRP-free specs). Misaligned proportional digits in a spec column is the difference between "catalog" and "blog." Tabular figures are the quiet craft detail high-end product sites (Apple tech-specs, car configurators) never skip.

**Current state:** `.specs-grid .spec dd` already has `font-variant-numeric: tabular-nums` and `.fam-hero-meta` too — **good, but partial.** `.card-specs .spec dd` (the 3-up mini-specs on every catalog card) does **NOT** have it, nor do the compare matrix cells or the Upgrades price/consensus columns.

**How-to:** Add `font-variant-numeric: tabular-nums lining-nums;` to: `.card-specs .spec dd`, all compare-table value cells, `.up-table` numeric columns, and any tow-matcher output. Add `lining-nums` to the existing tabular declarations too (Fraunces/DM Sans default to lining, but declaring it is defensive). Consider `font-feature-settings:"tnum","lnum"` as a fallback alias. Pure CSS, zero network.

> **Sharper still:** apply `tabular-nums` *only* to the data, and let prose keep proportional figures — mixing them is what a typographer would do. Don't globally force tabular on `body`.

### 1.4 Exploit Fraunces' optical sizing — *requires variable font (see §1.6)*
**Technique:** With the variable Fraunces installed, set `font-optical-sizing: auto` (browser ties `opsz` to rendered px) **or** drive `opsz` explicitly per role via `font-variation-settings: "opsz" <n>`. Per the foundry, low `opsz` opens letterspacing, raises x-height, lowers contrast (better for small text); high `opsz` tightens spacing and increases contrast for display ([FontsArena](https://fontsarena.com/fraunces-by-undercase-type/), [Pimp my Type](https://pimpmytype.com/font/fraunces/)).

**Why it reads premium:** Fraunces was *built* for this — a display serif that adapts its contrast to size is what makes editorial mastheads feel bespoke. Using one static cut at all sizes wastes the typeface's headline feature. Big hero `h1` at high `opsz` gets dramatic high-contrast Didone-ish elegance; a 13px eyebrow at low `opsz` stays legible instead of fragile (the foundry warns Fraunces gets "too delicate" below 14px — exactly our `.eyebrow` at 12px and section labels at 13px).

**How-to (on-brand, China-safe):**
```css
/* hero/display */
.hero-head h1, .detail-head h1, .home-hero-inner h1 {
  font-variation-settings: "opsz" 144, "wght" 600, "SOFT" 0, "WONK" 0;
}
/* small serif labels — open them up so they don't get spindly */
.spec-table h2, .decor-name { font-variation-settings: "opsz" 28, "wght" 600; }
```
Or simply `h1,h2,h3{font-optical-sizing:auto}` for the automatic path. **Blocked until §1.6 ships the variable woff2.** Until then, do NOT claim optical sizing — the static cut won't honor it.

### 1.5 SOFT / WONK — use sparingly, as accent
**Technique:** `SOFT` (0–100) rounds terminals ("inkier," warmer); `WONK` (0/1) swaps in the leaning n/m/h and flagged italic terminals that give Fraunces its character ([FontsArena](https://fontsarena.com/fraunces-by-undercase-type/)).

**Why it reads premium *when restrained*:** A whisper of softness on the wordmark / family names matches our "warm paper, copper, golden-hour" brand far better than the razor-sharp default. **WONK at display sizes only** — it auto-substitutes when `opsz > 18` and looks deliberate on a masthead; at body size it reads as a rendering bug. Restraint is the premium move: one expressive surface (the site title / family hero names), everything else calm.

**How-to:** e.g. `.fam-hero-overlay h1{font-variation-settings:"opsz" 144,"SOFT" 50,"WONK" 1;}` and leave body/labels at `SOFT 0,"WONK" 0`. Variable font required (§1.6). Document the chosen values as tokens so they're consistent.

### 1.6 ⚠️ PREREQUISITE: self-host the Fraunces *variable* woff2 (China-safe)
This is the linchpin for §1.4–1.5 and must be done **without any runtime external call**:
- **Build-time only:** download Fraunces variable TTF from Google Fonts / the GitHub repo (OFL licensed — free, redistributable), then **subset + convert to woff2 locally** with `fonttools`/`pyftsubset` (e.g. `pyftsubset Fraunces-VF.ttf --unicodes=U+0000-00FF,... --flavor=woff2 --layout-features='*'`). Keep the `opsz,wght,SOFT,WONK` axes (`--no-... ` pinning OFF for those). Subsetting to latin + latin-ext keeps it small.
- Add ONE `@font-face` with `font-family:'Fraunces'` and the full axis ranges:
  ```css
  @font-face{
    font-family:'Fraunces';
    src:url(../fonts/Fraunces-VF.subset.woff2) format('woff2-variations');
    font-weight:100 900; font-style:normal; font-display:swap;
  }
  ```
- This **replaces** the three static Fraunces cuts (net file-size often comparable or smaller than 3 static cuts + far more capable). Serve from our origin → loads where Google Fonts is blocked, identical to how we already self-host. **Zero GFW risk.** DM Sans can stay as static cuts or likewise go variable for weight animation (§2.5) — optional.
- Always keep a non-variable serif fallback (`Georgia, serif`) in the stack (already present).

### 1.7 Small craft details that compound
- **`text-wrap: balance`** on headings (h1–h3, card titles, section heads): the browser evens out ragged multi-line headlines so you never get one orphaned word — a hallmark of editorial setting. Progressive enhancement, ignored where unsupported. ([MDN text-wrap])
- **`text-wrap: pretty`** on body paragraphs and `.lede`/`.detail-desc`: prevents single-word last-line orphans.
- **Optical alignment of hanging punctuation / eyebrows:** keep eyebrows in `letter-spacing:.18em` uppercase (already done well) but consider `font-feature-settings:"cpsp"` (caps spacing) if available.
- **Disable ligatures in spec values, enable in prose:** prose `font-feature-settings:"liga","kern"` (default-on); leave numerics clean.
- All pure CSS, all degrade gracefully.

---

## 2. Micro-motion / interaction (performance-cheap, no library)

### 2.1 Scroll-reveal — two tiers, both China-safe
**Tier A (best, pure CSS, no JS): scroll-driven animations.** `animation-timeline: view()` ties a fade/rise to an element entering the viewport, running **off the main thread**, GPU-accelerated, zero JS ([WebKit guide](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/), [Smashing](https://www.smashingmagazine.com/2024/12/introduction-css-scroll-driven-animations/), [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations/Timelines)).
```css
@media (prefers-reduced-motion: no-preference){
  @supports (animation-timeline: view()){
    .reveal{ animation: reveal-rise linear both; animation-timeline: view(); animation-range: entry 0% entry 40%; }
  }
}
@keyframes reveal-rise{ from{opacity:0; transform:translateY(16px);} to{opacity:1; transform:none;} }
```
**Caveat:** Chrome/Edge support it; Safari was still rolling out (Safari 26 beta) and Firefox is behind a flag as of this research. So **pair with Tier B as the universal path**, or accept "no animation, content fully visible" as the fallback (the `@supports`/no-preference guards guarantee content is never hidden when unsupported).

**Tier B (universal, ~25 lines vanilla JS, CSP-safe): IntersectionObserver.** Matches our existing JS conventions exactly. Add a `.reveal` class; JS adds `.is-in` when the element crosses a threshold; CSS animates the transition. The critical safety rule: **default state must be visible** (so JS-off / no-IO users see everything), and the *hidden* starting state is applied **only when JS confirms support**, e.g. by adding a `js-reveal` class to `<html>` first:
```css
.js-reveal .reveal{ opacity:0; transform:translateY(16px); transition:opacity .6s ease, transform .6s cubic-bezier(.2,.7,.2,1); }
.js-reveal .reveal.is-in{ opacity:1; transform:none; }
@media (prefers-reduced-motion: reduce){ .js-reveal .reveal{opacity:1;transform:none;transition:none;} }
```
```js
// CSP-safe, progressive: only hide-then-reveal if IO exists
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('js-reveal');
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
}
```
**Why premium:** A gentle 12–16px rise + fade as cards/sections enter is the single most common "expensive" feel on award sites — but it must be *subtle* (≤600ms, small distance, ease-out) and **once-only** (unobserve after reveal; never re-animate on scroll-up, which feels cheap). Stagger card grids with a tiny per-item delay for editorial cadence.
**China-safe:** entirely first-party. No lib (no GSAP/Framer/AOS CDN).

### 2.2 Hover states that are touch-safe
**Technique:** Wrap all non-essential hover affordances in `@media (hover: hover) and (pointer: fine)` so touch devices don't get stuck-hover artifacts (the "tap leaves the card lifted" bug). Provide `:focus-visible` equivalents for keyboard.
**Why premium:** Our card lift (`translateY(-3px)`), image `scale(1.045)`, and copper underline are nice on desktop but on touch they can fire on tap and stick, or block the first tap ("tap to hover, tap to click"). High-end sites gate decorative hover behind hover-capable pointers.
**Current gap:** `site.css` has `:focus` outlines on inputs (good) but card/link hovers are **not** `@media (hover)`-guarded, and use `:hover` not `:focus-visible`.
**How-to:**
```css
@media (hover: hover) and (pointer: fine){
  .card:hover{ transform:translateY(-3px); box-shadow:...; }
  .card:hover .card-media img{ transform:scale(1.045); }
}
.card:focus-visible{ outline:2px solid var(--copper); outline-offset:3px; } /* keyboard parity */
```
Migrate `:focus` → `:focus-visible` on interactive elements so mouse-click doesn't show a ring but keyboard does. Pure CSS.

### 2.3 Cross-document View Transitions (MPA) — the standout, near-free upgrade
**Technique:** We're a **multi-page static site** (59 detail pages + hubs) — the ideal case for **cross-document view transitions.** Add to global CSS on every page:
```css
@view-transition{ navigation: auto; }
```
That alone gives a smooth crossfade between same-origin page navigations, **no JS** ([Chrome docs](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document), [MDN @view-transition](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40view-transition)). Both pages just need the rule + same origin.
**Morph the hero image card→detail:** give the catalog card's image and the detail hero the **same** `view-transition-name`, and the browser animates position/size between pages automatically:
```css
.card-media img{ view-transition-name: var(--vt, none); contain: paint; }
/* set --vt per-card to a unique slug; same slug on .detail-hero-img */
```
**Why premium:** A floorplan card that *expands into* its detail hero is the exact "configurator" feel of high-end auto/product sites — and here it costs ~3 lines of CSS plus a unique name per model. This is the highest wow-to-effort ratio on the list.
**Caveats:** Chromium-only for cross-document today (Safari/FF still catching up); **fully progressive** — unsupported browsers just navigate normally (our current behavior). Guard custom keyframes under `@media (prefers-reduced-motion)`. Unique names must be unique *per page* (don't reuse a name on two visible elements). **China-safe:** pure CSS, first-party.

### 2.4 Cheap, correct motion primitives (what to standardize)
- **Only animate `transform` and `opacity`** (compositor-only, 60fps; never animate `width`/`top`/`box-shadow`-blur in a loop). Our card transitions already do transform + box-shadow; box-shadow on a `.16s` one-shot hover is fine, but avoid it in scroll-driven loops.
- **Durations:** UI feedback 120–200ms (we use .12–.18s — good), reveals 400–600ms, page transitions 250–400ms. Consistency of easing matters: standardize on `cubic-bezier(.2,.7,.2,1)` (already used on image zoom) as the house ease, expose as `--ease`.
- **`will-change`** sparingly and only just-in-time (on hover-capable + about to animate); never blanket.
- **Respect `prefers-reduced-motion` everywhere** — we already do in the campgrounds module; make it a global rule: a single `@media (prefers-reduced-motion: reduce){ *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important;} }` safety net (the well-known accessibility reset), plus per-feature `animation-timeline:none`.

### 2.5 (Optional, needs variable font) weight-on-hover / interaction
With variable DM Sans/Fraunces, hovering a nav item or card title can ease `font-variation-settings:"wght"` from 500→600 — a smooth weight transition impossible with static cuts. Subtle, premium, but **only worth it once §1.6 variable fonts ship**, and must be `@media (hover)`-guarded + reduced-motion safe. Low priority.

---

## 3. Layout & detail density (editorial grid, spec-table craft)

### 3.1 Spec-table craft — the make-or-break surface
Spec tables are where a reference site earns "premium" or reads "spreadsheet." Concrete upgrades to our `.specs-grid` / `.card-specs` / compare matrix:
- **Tabular lining figures** everywhere (§1.3) — non-negotiable.
- **Align the value column** to a consistent right edge or a shared baseline grid. Our `.specs-grid .spec` uses `justify-content:space-between` with `align-items:baseline` (good — label left, value right, baselines aligned). Extend the same pattern to compare cells.
- **Hairline rhythm:** we use `border-bottom:1px solid var(--line)` per row (good editorial restraint). Consider **zebra-free** design (premium tables avoid stripes; rely on hairlines + whitespace) — we already do, keep it.
- **Units as muted superscript/suffix:** render the number prominent (ink, 600) and the unit (`lbs`, `ft`, `"`) in `--muted` at smaller size, so the eye scans values not units. e.g. `<dd>7,300 <span class="unit">lbs</span></dd>` with `.unit{color:var(--muted);font-weight:500;font-size:.82em;}`. This is the detail that makes Apple/auto spec sheets feel engineered.
- **Label microtypography:** spec labels in `--muted`, slightly tracked, sentence case or small-caps — our `.card-specs dt` uses 10px uppercase `letter-spacing:.08em` (good); the larger `.specs-grid dt` at 15px is fine. Keep two tiers.
- **Group long spec lists** under quiet subheads (Dimensions / Weights / Capacities) with our existing `.spec-table h2` 13px tracked-uppercase muted label style — turns a 20-row dump into a scannable structure.

### 3.2 Editorial grid & section rhythm
- **A real baseline/spacing scale.** Like the type scale, define a fluid **space** scale (`--space-s/m/l/xl` via clamp, Utopia's companion idea) and use it for section padding/margins instead of the current mix of literal px (`56px`, `36px`, `40px`, `64px`...). Consistent vertical rhythm is the quietest, strongest premium signal. Pure CSS.
- **Asymmetric / editorial grids for variety.** The 3-up card grid is correct for the catalog. On *detail* pages, break monotony with an occasional offset: e.g. spec table in a narrower measure column beside a wider image, or a full-bleed hero followed by an indented intro (magazine "drop"). Use CSS Grid `grid-template-columns: minmax(0,1fr) minmax(0,.66fr)` at desktop, collapse to one column on mobile. Reference: editorial sites (NYT Magazine, The Verge feature layouts cited as award winners by [ASME 2026](https://www.asme.org/) / [SND47](https://www.snd.org/)) earn richness from controlled asymmetry, not more decoration.
- **Whitespace as luxury.** Increase section spacing on large viewports (premium = generous air); our `--maxw:1120px` is appropriately restrained for an editorial measure (don't widen it — wide content columns read "dashboard," not "magazine").
- **Consistent corner language.** `--radius:2px` (crisp, editorial) on cards but `999px` pills on chips/buttons and `9px–10px` on controls/hero — this mix is intentional (sharp content cards vs. soft interactive controls) and reads deliberate. Keep, but document the rule so the build stays consistent.

### 3.3 Card design refinements
- Our `.card` already does the premium basics: subtle border + layered shadow, `aspect-ratio:3/2` media, `mix-blend-mode:darken` to drop studio-white into the cream ground (genuinely sophisticated touch), hover lift + image scale. Refinements:
  - **Gate hover behind `@media (hover)`** (§2.2).
  - **Stagger reveal** on grid entry (§2.1) for cadence.
  - **`content-visibility:auto`** + `contain-intrinsic-size` on off-screen cards/sections for cheaper rendering on the 59-page detail set and long Explore grid — pure CSS perf win, no network. (Use a sensible `contain-intrinsic-size` so scrollbar doesn't jump.)
  - Consider a hairline **inner top-light** (`box-shadow: inset 0 1px 0 rgba(255,255,255,.6)`) on surfaces to give the cream paper a faint sheen — a Stripe-ish material cue, very cheap.

### 3.4 Dense data, beautifully (compare + upgrades)
- Compare matrix: freeze the spec-label column, horizontal-scroll the model columns on mobile (we already use `overflow-x:auto` patterns with `-webkit-overflow-scrolling:touch` in `.up-table-scroll`/`.cg-tray-scroll`). Add `scroll-snap-type:x proximity` so columns snap — premium tactile feel, pure CSS.
- Use **`position:sticky`** for the compare header row and the spec-label column so context never scrolls away (pure CSS, cheap).
- Right-align numbers, left-align labels, tabular figures — covered above.

---

## 4. Reference exemplars (real, high-end) and the transferable technique

> URLs are documentation/foundry/spec sources verified during research. Showcase galleries (ASME, SND, Communication Arts) name the award-winning editorial publications to study; their *techniques* are what transfer, captured above.

| Exemplar / source | What's premium about it | Transferable technique (China-safe) |
|---|---|---|
| **Fraunces foundry pages** — [FontsArena](https://fontsarena.com/fraunces-by-undercase-type/), [Pimp my Type](https://pimpmytype.com/font/fraunces/) | The microsite shows Fraunces' opsz/SOFT/WONK as expressive but controlled display type | §1.4–1.6: self-host variable Fraunces, drive `opsz` by role, whisper of SOFT/WONK on the masthead only |
| **WebKit — scroll-driven animations** [guide](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/) | Off-main-thread reveals with zero JS, reduced-motion-aware | §2.1 Tier A `animation-timeline: view()` |
| **Smashing Magazine — SDA deep dive** [link](https://www.smashingmagazine.com/2024/12/introduction-css-scroll-driven-animations/) + **MDN** [timelines](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations/Timelines) | Canonical technique + `@supports`/reduced-motion guards | §2.1 fallback strategy + progressive enhancement pattern |
| **Builder.io — scroll-driven hero** [link](https://www.builder.io/blog/scroll-driven-animations) | Rebuilt GitHub's JS-heavy hero scroll effect in pure CSS | §2.1/§2.4: replace would-be JS scroll effects with CSS, `isolation:isolate`, `position:sticky` |
| **Chrome — cross-document View Transitions** [docs](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document) + **MDN** [@view-transition](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40view-transition) | MPA page-to-page morphs with 3 lines of CSS, no framework | §2.3: `@view-transition{navigation:auto}` + shared `view-transition-name` card→detail morph |
| **Utopia / Smashing — fluid type & space** [link](https://www.smashingmagazine.com/2021/04/designing-developing-fluid-type-space-scales/) | "Scale type and space without breakpoints"; intrinsic, consistent | §1.1 + §3.2: unified `clamp()` type AND space scales as tokens |
| **Datawrapper — fonts for tables** [PDF](https://data.europa.eu/sites/default/files/course/5.4_ChoosingFonts.pdf) | Why tabular + lining figures make data scannable | §1.3 + §3.1: `font-variant-numeric: tabular-nums lining-nums` on all spec data |
| **Award-winning editorial publications** — NYT Magazine, The Verge, National Geographic, Garden & Gun, Texas Monthly, WSJ. Magazine (named finalists/winners by [ASME 2026 design awards](https://www.asme.org/) and [SND47](https://www.snd.org/)) | Controlled asymmetric grids, generous whitespace, expressive display serif over clean sans, restrained motion | §3.2: editorial asymmetry, whitespace-as-luxury, one expressive type surface; §1.2 disciplined measure |

**Pattern across all exemplars:** the premium feel comes from **restraint + craft + intrinsic/responsive systems**, not from more effects or heavier tech. Every technique above ships from our own origin.

---

## 5. China-network compliance check (every recommendation)

| Recommendation | External runtime call? | Verdict |
|---|---|---|
| Fluid type/space `clamp()` tokens (§1.1, §3.2) | None — CSS math | ✅ Safe |
| Measure/leading tokens (§1.2) | None | ✅ Safe |
| `font-variant-numeric` tabular/lining (§1.3, §3.1) | None | ✅ Safe |
| Variable Fraunces optical sizing / SOFT / WONK (§1.4–1.5) | **None at runtime** — but requires self-hosting the variable woff2 (build-time download + `pyftsubset`, then served first-party) | ✅ Safe **after** §1.6 done. ❌ if anyone tries to pull it from Google Fonts at runtime — DON'T. |
| `text-wrap: balance/pretty`, OpenType features (§1.7) | None | ✅ Safe (progressive) |
| Scroll-reveal Tier A `animation-timeline:view()` (§2.1) | None | ✅ Safe |
| Scroll-reveal Tier B IntersectionObserver (§2.1) | None — first-party JS, no lib | ✅ Safe (NO GSAP/AOS/Framer CDN) |
| `@media (hover)` / `:focus-visible` touch-safety (§2.2) | None | ✅ Safe |
| Cross-document View Transitions (§2.3) | None | ✅ Safe (progressive) |
| Motion primitives + global reduced-motion (§2.4) | None | ✅ Safe |
| `content-visibility`, `scroll-snap`, `position:sticky` (§3.3–3.4) | None | ✅ Safe |

**The only rule to enforce in the build:** the variable Fraunces (§1.6) must be downloaded and subsetted **at build time** and served from our origin via `@font-face` — never linked to `fonts.googleapis.com`/`fonts.gstatic.com` at runtime. This mirrors exactly how we already self-host the static cuts, so there's no new risk class.

---

## 6. Prioritized rollout (highest value, lowest risk first)

1. **Tabular + lining figures on every spec value** (§1.3) — tiny CSS diff, immediate "engineered" feel, zero risk. *(Partially done; finish it.)*
2. **`@media (hover)` + `:focus-visible` touch-safety pass** (§2.2) — fixes a real touch bug, accessibility win, pure CSS.
3. **Unified fluid type + space scale tokens** (§1.1, §3.2) — replaces scattered one-off clamps; foundational consistency.
4. **Cross-document View Transitions** `@view-transition{navigation:auto}` + card→detail hero morph (§2.3) — biggest wow-per-line, fully progressive.
5. **Scroll-reveal** (§2.1) — IntersectionObserver Tier B for universal support, with Tier A CSS where supported; subtle, once-only, reduced-motion safe.
6. **Spec-table craft**: muted units, grouped subheads, sticky compare header/label column (§3.1, §3.4).
7. **Self-host variable Fraunces** (§1.6) → then **optical sizing per role** (§1.4) and **a whisper of SOFT/WONK on the masthead** (§1.5). Highest craft ceiling, most build work; do last.
8. **`text-wrap: balance/pretty`**, `content-visibility:auto`, global reduced-motion safety net — low-effort polish to fold in anytime.

**Do NOT:** add any motion/animation library (GSAP, AOS, Framer, Lottie via CDN), pull fonts from Google at runtime, animate layout properties in loops, or apply tabular figures globally to prose. None are needed; all would either break the China rule or cheapen the feel.
