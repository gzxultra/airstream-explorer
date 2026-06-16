# Research Thread 3 — Imagery Audit & Coverage

_Airstream Explorer static reference site. Research-only; no images or code were
modified. Prepared as one of five parallel research threads._

## 1. Current imagery inventory (on disk, `public/assets/img/`)

| Category | Count | Dimensions (sampled) | What it is | Source character |
| --- | --- | --- | --- | --- |
| `heroes/` | 12 | 1280×720 | One family hero per model line | **Mixed** — some real official Airstream lifestyle shots, some AI-generated/over-stylized |
| `gallery/` | 177 | 920×518 | 3 shots per floorplan (59×3) | Predominantly **real** official Airstream studio/interior photos |
| `floorplans/` | 59 | 820×1332 | Official top-down floorplan renders | **Real** Airstream renders (no dimension labels) |
| `thumbs/` | 59 | 400×225 | Card thumbnails per floorplan | Derived from gallery/official |
| `upgrades/` | 26 | 1200×676 | Upgrades-page card images (just regenerated) | **Generated** — several branded items violate the real-photo rule |
| `community/` | 36 | ~760w | Attributed Wikimedia Commons photos | **Real**, license-clean, well-attributed |
| `decor/` | 142 | 600×600 | Material/finish swatches per family scheme | Texture swatches (acceptable) |
| **Total** | **511** | | | |

**Coverage is structurally complete.** Every one of the 59 floorplans has its
own hero (resolved by model slug), 3 own gallery images, and an own floorplan
diagram — no twin-fallback and no hero-only fallbacks are currently triggered.
The build's image guardrail (fails if any `<img>` ref doesn't resolve on disk)
is satisfied. So the gaps below are about **quality, believability, and
rule-compliance**, not missing files.

### Data-file attribution patterns (for any additions)

- **`community-photos.json`** (36 items, flat array). Each entry carries a full
  attribution block: `id`, `thumb`, `bucket`, `title`, `caption`, `artist`,
  `license`, `licenseUrl`, `source` (always "Wikimedia Commons"), `sourceUrl`
  (the Commons `File:` page), and `w`/`h`. Licenses in use: CC BY-SA 4.0 (25),
  CC BY 2.0 (4), CC BY-SA 2.0 (3), CC0 (3), CC BY 4.0 (1). 18 distinct artists.
  Buckets: Vintage & classic (12), Interiors & details (7), On the road &
  campsites (7), Bambi (3), International (2), Safari (2), Caravel/Flying
  Cloud/Trade Wind (1 each). **Any community addition must follow this exact
  schema and remain license-clean + attributable.**
- **`decor-options.json`** (family-slug → scheme array; 12 families, 28 schemes
  total). Each swatch is `{kind, file}` resolved to `assets/img/decor/`.
- **`trailers.json`** (59 floorplans). No image paths stored — asset paths are
  derived in `src/lib/data.mjs` (`assetPaths`/`resolveAssets`) from the slug and
  model name. Hero = `slugify(model)`, gallery = `slug-{1,2,3}`, floorplan =
  `slug`, with a cross-year twin (2025↔2026) fallback for gallery/floorplan.
- **`upgrades.json`** (26 items across 5 categories). Each item has an `image`
  pointing at `assets/img/upgrades/<name>.webp`. Brand names live in the `name`,
  `why`, and `sources` fields, not the image path.

---

## 2. RULE-COMPLIANCE PROBLEMS (highest priority)

The non-negotiable rule: **branded hardware must use a REAL reference photo,
never invented/AI-fabricated shapes.** The Upgrades cards were just regenerated
as "realistic product-style imagery," but several of them depict **named,
branded products with AI-fabricated logos, faceplates, and model badges.** On
close inspection the fine print is garbled — a tell-tale AI signature — and the
brand lockups are invented. These are the clearest violations on the site:

| Card (`upgrades/…`) | Brand named in data | What the image shows | Verdict |
| --- | --- | --- | --- |
| `lithium.webp` | **Battle Born** | Two "BATTLE BORN … 100 Amp Hour 12 Volt LiFePO4" batteries + a "Victron" box; logos & label text are AI-fabricated/garbled | **VIOLATION** — must be real |
| `inverter.webp` | **Victron** | "victron energy MultiPlus-II", "victron Lynx", "SmartShunt" — fabricated faceplates, garbled spec text | **VIOLATION** |
| `dcdc.webp` | **Victron** | DC-DC charger (Victron Orion implied) | **Likely violation** — verify, fabricated branding |
| `converter.webp` | Victron / Progressive | Lithium converter/charger | **Likely violation** — verify |
| `shunt.webp` | **Victron** | Battery monitor / shunt (Victron SmartShunt/BMV implied) | **Likely violation** — verify |
| `levelmate.webp` | **LevelMate Pro (LogicBlue)** | Device reads "LEVELONE LC-200" — invented brand, garbled text | **VIOLATION** |
| `compost-toilet.webp` | **Nature's Head / OGO** | Toilet labeled "NATURAL HEAD … COMPOSTING TOILET SYSTEM" — invented brand mimic, wrong silhouette | **VIOLATION** |
| `maxxfan.webp` | **MaxxFan / MaxxAir** | Generic roof fan, no real MaxxFan branding/shape | **VIOLATION** (branded item rendered generic) |
| `softstart.webp` | Micro-Air EasyStart / TST | "SOFT START CONTROLLER … SSC-230V" — invented model | **VIOLATION** (named brands) |
| `hitch.webp` | **Equal-i-zer** | WD hitch with invented "WD-1200 / S/N 847291" badge | **VIOLATION** (named brand rendered generic+fake badge) |
| `tpms.webp` | TST (named) | Generic TPMS display, no brand shown | Borderline — generic display is OK *if* the card text doesn't promise the named brand |

Cards that are **generic-by-design and acceptable** (no specific brand depicted,
believable scenes): `solar.webp`, `secondac.webp`, `brake.webp`, `surge.webp`,
`levelblocks.webp`, `waterfilter.webp`, `showerhead.webp` (Oxygenics is named in
data but card is generic), `pressure-reg.webp`, `mattress.webp`, `led.webp`,
`tint.webp`, `skylight.webp`, `lock.webp`, `hinges.webp`, `trim.webp`. These can
stay generated as long as they read as believable (neutral white balance,
natural light) and the card copy doesn't promise a specific brand's likeness.

**Recommended fix pattern for the violators:** either (a) swap to a REAL
reference product photo from the manufacturer (license caveat below), or (b)
re-shoot the card as a genuinely generic scene AND soften the card copy so it
doesn't claim to show that specific brand. Option (a) is stronger for a premium
reference site. Note that manufacturer product photos are **copyrighted** — they
are fine for editorial/reference fair-use-style display with attribution on a
non-commercial reference site, but the cleanest, China-robust, license-safe path
is to self-host with a visible "Image: <Brand>" credit, exactly as the community
gallery already credits Commons. Confirm the site's licensing posture before
shipping manufacturer images; if it must be license-clean, prefer Wikimedia
Commons equivalents where they exist (e.g., MaxxFan/Victron units do appear in
Commons RV-interior photos) or keep a tasteful generic scene + honest copy.

---

## 3. COVERAGE GAPS & WEAK SPOTS (a premium reference site would have these)

### A. Hero quality is inconsistent (real vs AI-stylized)
Sampled heroes: `basecamp.webp` and the interior galleries read as **real
official Airstream photography**. But `classic.webp` and `flying-cloud.webp`
read as **AI-generated/over-stylized** (Classic in particular has a
golden-hour, over-baked sky — exactly the "AI golden-hour" the rule warns
against). A premium reference site should have **one real official beauty shot
per model line** (12 families). Airstream's own model pages carry high-res
exterior heroes for every current line.

### B. No real exterior "beauty shot" set distinct from studio gallery
Gallery images lean on white-background studio product shots (great for clarity)
but the site lacks **in-situ exterior lifestyle reality shots** (trailer at a
real campsite, hitched to a truck, awning out) that are demonstrably real rather
than generated. Wikimedia Commons has license-clean candidates per several model
lines.

### C. Floorplan diagrams lack dimensional clarity
The official top-down renders are attractive but carry **no dimension labels,
no room callouts, no length/width annotations**. A premium reference site would
overlay (or pair) each diagram with labeled dimensions (length, width, bed size,
key zones). This is a *generated/derived* enhancement, not a photo — build an
annotation layer over the existing official render rather than replacing it.

### D. No comparison visuals
59 floorplans, rich spec data in `trailers.json` (length, weight, GVWR, tanks,
solar, battery, sleeps, off-grid score) — but **no visual comparison imagery**
(e.g., silhouette/length-to-scale line-ups, side-by-side floorplan compares).
These are generated/derived diagrams (SVG from data), fully China-robust, and
would meaningfully differentiate the site.

### E. Thin community-photo coverage for several model lines
`community-photos.json` is well-built but **unevenly distributed**: Bambi (3),
International (2), Safari (2), and only **1 each** for Caravel, Flying Cloud,
Trade Wind — and **zero** dedicated community shots for Basecamp, Globetrotter,
Classic, Trade Wind interiors, and the limited editions. Vintage (12) is
over-represented vs the modern line-up. More license-clean modern-model Commons
photos would balance it.

### F. No campground photography
The site has a large `campgrounds.json` (1.5 MB). If the campgrounds section
renders without imagery, a premium site would show **real, license-clean
campground/landscape photos**. Wikimedia Commons and NPS (public domain) are
clean sources. (Could not confirm whether the campgrounds UI currently shows
images — flag for the IA/visual threads.)

### G. Décor swatches are texture-only
142 décor swatches are flat material textures. A premium configurator-style
section would benefit from **at least one real in-situ interior photo per décor
scheme** showing the palette in context. Airstream's own décor pages have these
(real, copyrighted — same licensing caveat as §2).

---

## 4. PRIORITIZED IMAGE-ADDITION / FIX LIST

Ordered by impact. "Real" = must be a genuine reference photo; "Generated" = a
believable generated scene or a data-derived diagram is acceptable.

### P0 — Rule violations to fix (branded hardware showing fake logos)
1. **`upgrades/lithium.webp` → REAL.** Replace the fabricated Battle Born/Victron
   scene with a real Battle Born product photo.
   - Source: Battle Born official product page —
     `https://battlebornbatteries.com/products/100ah-12v-lifepo4-deep-cycle-battery`
     (official 100Ah 12V LiFePO4 hero image). Manufacturer-copyright; self-host
     with "Image: Battle Born Batteries" credit.
2. **`upgrades/inverter.webp` (+ `dcdc`, `converter`, `shunt`) → REAL.** Replace
   fabricated Victron faceplates with real Victron product photos.
   - Source: Victron MultiPlus-II official line (product page imagery), e.g. via
     Victron's product pages / authorized listings. Verify exact model image;
     manufacturer-copyright, self-host with "Image: Victron Energy" credit.
3. **`upgrades/compost-toilet.webp` → REAL.** Replace the invented "Natural Head"
   with a real Nature's Head photo.
   - Source: Nature's Head official site — resources page even has a
     **Nature's-Head-installed-in-an-Airstream** image:
     `https://natureshead.net/resources/` and shop `https://natureshead.net/shop-all/`.
     Manufacturer-copyright; self-host with "Image: Nature's Head" credit.
4. **`upgrades/levelmate.webp` → REAL.** Replace invented "LEVELONE LC-200" with
   a real LevelMate PRO (LogicBlue) product photo from the manufacturer/retailer.
   Manufacturer-copyright; credit "Image: LogicBlue Technology."
5. **`upgrades/maxxfan.webp` → REAL.** Replace generic fan with a real MaxxFan
   Deluxe (MaxxAir / Airxcel) product photo. Manufacturer-copyright; credit
   "Image: MaxxAir." (Commons also has real MaxxFan-in-RV interior photos as a
   license-clean fallback.)
6. **`upgrades/hitch.webp` → REAL or honest-generic.** Either a real Equal-i-zer
   4-point WD hitch product photo (credit "Image: Equal-i-zer / Progress Mfg"),
   or keep generic but remove the fake "WD-1200/S/N" badge and don't claim the
   Equal-i-zer likeness in copy.
7. **`upgrades/softstart.webp` → REAL or honest-generic.** Micro-Air EasyStart is
   named in data; use a real EasyStart product photo or make the scene honestly
   generic (drop the invented "SSC-230V" badge).

### P1 — Hero quality upgrades (real per model line)
8. **`heroes/classic.webp` and `heroes/flying-cloud.webp` → REAL.** Replace the
   AI-stylized/over-golden-hour heroes with real official Airstream exterior
   beauty shots from the model pages (`airstream.com` model line pages carry
   high-res heroes). Audit the remaining 10 heroes the same way; keep the ones
   that are genuinely official (e.g. Basecamp looks real). Manufacturer-copyright;
   self-host with "Image: Airstream" credit. **China-robust: download + self-host,
   no external CDN hotlinking.**

### P2 — Balance community coverage (license-clean, attributable)
9. **Add modern-model community photos** for under-covered lines (Basecamp,
   Globetrotter, Classic, Caravel, Trade Wind, Flying Cloud interiors).
   - Source: Wikimedia Commons `Category:Airstream` and subcategories —
     `https://commons.wikimedia.org/wiki/Category:Airstream`. Verified
     license-clean candidates include
     `File:1963 Airstream trailer in Joshua Tree dllu.jpg` (already a Commons
     Featured Picture, CC BY-SA) and `File:Chrysler Airstream (1935) (54561699604).jpg`
     (CC BY). Each must be added to `community-photos.json` with full attribution
     (artist, license, licenseUrl, sourceUrl) per the existing schema. **Verify
     each file's license on its Commons File: page before use; never assume.**

### P3 — Premium differentiators (generated/data-derived, fully China-robust)
10. **Floorplan dimension overlays → Generated/derived.** Pair each official
    `floorplans/*.webp` with a labeled dimension layer (length, width, bed,
    galley, bath) drawn from `trailers.json`. Keep the official render; add
    annotations as an overlay/SVG.
11. **Comparison silhouettes → Generated/derived (SVG).** Length-to-scale model
    line-up and side-by-side floorplan compare, generated from `trailers.json`
    spec data. No photos needed; ideal for a static, self-hosted, China-robust
    site.
12. **Décor in-situ context photos → Real (optional).** One real interior photo
    per décor scheme showing the palette in a real Airstream, from Airstream's
    décor pages. Manufacturer-copyright; credit "Image: Airstream." Lower
    priority and license-sensitive.
13. **Campground photos → Real, public-domain preferred.** If the campgrounds
    section lacks imagery, add license-clean landscape/campground photos
    (Wikimedia Commons / NPS public domain). Confirm the campgrounds UI's image
    needs with the IA thread first.

---

## 5. Licensing & attribution notes (cross-cutting)

- **Wikimedia Commons** (community + landscape additions): each file carries its
  own license. Confirm on the `File:` page; record `artist`, `license`,
  `licenseUrl`, `source`, `sourceUrl` exactly as the existing 36 entries do.
  CC BY / CC BY-SA require visible attribution + license link (the site already
  does this in the community gallery). CC0/PD need no attribution but crediting
  is good practice.
- **Manufacturer product photos** (Battle Born, Victron, Nature's Head, MaxxAir,
  Equal-i-zer, LogicBlue) and **Airstream.com** heroes/décor: these are
  **copyrighted**. For a non-commercial editorial reference site, self-hosting
  with a clear "Image: <Brand>" credit is the pragmatic norm, but confirm the
  project's licensing posture before shipping. Where a license-clean Commons
  equivalent exists, prefer it. **Do not hotlink** — download and self-host every
  image (China-robust requirement: no external image CDNs).
- **Generated images** (generic upgrade scenes, heroes that must stay generated,
  décor textures): keep them believable — natural daylight, neutral white
  balance, NOT over-stylized AI golden-hour. The current `classic.webp` hero is
  the cautionary example of what to avoid.

---

## 6. Verification status of source URLs cited

- `battlebornbatteries.com/products/100ah-12v-lifepo4-deep-cycle-battery` — verified via search (official product page with hero image).
- `natureshead.net/resources/` and `natureshead.net/shop-all/` — verified (official site; resources page shows a real Airstream install).
- Victron MultiPlus-II — official product line confirmed across listings; pull the exact model image from Victron's own product page when implementing.
- `commons.wikimedia.org/wiki/Category:Airstream` — verified live (brand category with subcategories + license-clean files).
- `airstream.com` model pages — official heroes exist per line (standard source); verify exact current hero per model at implementation time.
- All URLs above were surfaced via search and resolved; none were fabricated. Re-confirm each image's license/availability at implementation.
