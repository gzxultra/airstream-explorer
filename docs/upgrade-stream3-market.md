# Stream 3 — Competitive & Market Landscape Analysis

**Specialist:** Specialist 3 — Competitive & market landscape analyst
**Date:** 2026-06-19
**Workdir:** ~/workspace/your_files/airstream-explorer
**Brief:** upgrade-2026-06-19-brief.md (NO commerce/booking/affiliate · accuracy-first · no-AI-imagery · premium editorial · China-robust · static)

**Goal of this stream:** Study what the best Airstream/RV reference, community, and trip-planning
products do; figure out (1) what competitors do WELL that we lack, (2) gaps NOBODY fills well that we
could OWN, (3) how a no-commerce, accuracy-first, premium-editorial, China-robust reference can
DIFFERENTIATE. Each opportunity = What · Evidence · Value · Effort (S/M/L) · Constraint fit · First step.

> Note on scope vs prior research: docs/cg-panel-1-competitive.md already teardown'd the campground/
> trip-planning apps (Campendium, The Dyrt, Roadtrippers, AllStays, iOverlander) for the Campsites map.
> This stream focuses on the broader landscape: official Airstream.com, the spec/listing sites
> (RV Trader, RVUSA, RV Insider), the rental platforms (Outdoorsy, RVshare), valuation sites
> (JD Power/NADA), and the enthusiast communities (Airforums, Reddit). It avoids re-deriving the
> campground-app conclusions.

---

## PART A — Competitor / landscape teardown (what each does, with sources)

### A1. airstream.com (official) — the gold standard for presentation, weak on neutral comparison
**What they do well:**
- **Model configurator** — "build a travel trailer step-by-step based on your preferences," then
  generates a tailor-made brochure you can share with a dealer.
  (https://www.airstream.com/blog/whats-in-a-name-explaining-fb-rb-and-cb-floor-plans/)
- **Per-model spec tables** that are genuinely deep: Exterior/Interior L×W×H, GVWR, NCC/cargo, fresh/
  gray/waste tank gal, furnace BTU, hitch weight, base weight, sleeping capacity, solar/lithium
  options, A/C BTU, etc. (e.g. Basecamp & Bambi spec pages). This is our spec ground-truth.
- **"Compare up to 4 floor plans"** widget on floor-plan pages; **annotated hot-spot floor-plan images**.
- **Editorial decision guides** that are actually good content: "Things to Consider Before Buying an
  Airstream" (where are you going / who's coming / road conditions), "Comparing Single & Dual-Axle
  Travel Trailers," "Answering Questions About Airstream Ownership," "What's the Best Class B RV for
  You?", the **Comparison Guide 2026: Dual-Axle Travel Trailers**
  (https://www.airstream.com/travel-trailer-floor-plan-comparison-guide/).
- **Knowledge Base** (AI-autofill search over ~90 yrs of service docs), **FAQ**, **VIN recall lookup**,
  **Airstream Academy** (towing/hitching education).
- **Rich heritage/history** content (95 Years of Airstream, motorized history, the Torpedo, etc.).

**Where they are weak / conflicted (our opening):**
- **Everything routes to a dealer / brochure download.** It is a sales funnel, not a neutral reference.
  Comparison is *within Airstream only* and framed to upsell ("Airstreamers frequently upgrade to
  these longer models").
- **Spec pages are stale and inconsistent** — several model spec pages show "Last Updated: 2335 days
  ago" in crawl metadata; combined waste-tank labels ("24 Combo", "30 Combo") are ambiguous and have
  tripped up even our own team (see AGENTS.md note). A neutral, *dated, sourced, consistent* spec
  presentation is a real gap.
- **No real cross-model "which is right for me" engine** beyond prose. The configurator optimizes a
  single chosen model's options; it does NOT help a shopper triangulate across families on objective
  needs (tow limit, park length, off-grid, sleeping count) without bias.
- **No honest discussion of downsides** (quality issues, towing reality vs published tongue weight) —
  structurally can't, since it's the manufacturer.

### A2. RV Trader / RVUSA / dealer "dimension guides" — spec aggregation, but commerce-first & shallow
- RV Trader / RVUSA are **classified-listing marketplaces** (units for sale). Reference value is
  incidental: each listing repeats year/length/dry weight/sleeps, but data quality is seller-entered
  and inconsistent. They are commerce — off-limits as a model, but they reveal **what spec fields
  buyers scan first**: length, dry/GVWR weight, sleeps, slides, fresh/gray/black tanks, MSRP.
- **Dealer "Airstream Dimensions Guides"** (e.g. airstreamsandiego.com, airstreamsouthcarolina.com)
  are pure reference pages: every model's L×W×H by floor plan, with notes like "width jumps from 8 ft
  to 8'5.5" starting at 25 ft." These rank well and prove **demand for a clean, all-models-in-one
  dimensions reference** — but they're approximate ("approximate" repeated), undated, and unsourced.
  We can do this *better*: exact, sourced, dated, and interactive. (Source examples:
  airstreamsandiego.com Dimensions Guide; airstreamsouthcarolina.com Dimensions Guide.)
- **Reference value we can match WITHOUT commerce:** the consolidated, scannable spec/dimension table
  across ALL models and years — which is exactly our trailers.json/motorhomes.json strength. We just
  need to present it as authoritatively as a dealer guide but accurate + sourced.

### A3. Outdoorsy / RVshare (rentals) — surface *usage/trip* info, not purchase specs
**What rental listings surface that purchase-spec sites DON'T:**
- **Real usage framing:** "What will I need to tow?" (2-5/16" ball), delivery radius, "trailer will
  only fill to 20 gal if boondocking," generator add-ons, hookup requirements (30A/water/sewer).
- **Lived-in amenity lists** (composting toilet retrofit, MaxxAir fans, 400W solar + 276Ah lithium,
  linens, outside shower) — i.e. how owners *actually* equip a rig for a trip.
- **Plain-English capability** ("No truck needed! We drive, you arrive" / "Sleeps 4, fresh water 40
  gal, gray 26, black 26, propane 47 lbs"). Tanks/propane shown as **trip-duration enablers**, not
  just numbers.
- RVshare also publishes strong **editorial reference** outside its booking funnel — notably
  **"National Park RV Length Limits"** with a percent-of-parks-accessible-by-length table
  (https://rvshare.com/blog/national-parks-rv-length-limits/). This is reference content, not commerce.
- **Takeaway:** rental platforms prove that **trip/usage translation of specs** (how many days can I
  boondock, what can I tow it with, will it fit the park) is what *non-engineers* want — and nobody
  presents it neutrally across the whole Airstream line. (Sources: multiple Outdoorsy Airstream
  listings — outdoorsy.com; rvshare.com national-park length blog.)

### A4. JD Power / NADA + RV Insider + BBB — reliability & reputation reference (the BIG uncovered gap)
- **JD Power (formerly NADAguides)** publishes RV *values* (pricing — OFF-LIMITS for us) but ALSO
  editorial reference like park length guidance (jdpower.com "Back That Baby Up… National Park RV
  Length Restrictions"). Pricing/finance = reject; editorial/reference = fair game.
- **RV Insider** = aggregated **owner reviews with structured sub-scores** (Livability, Overall
  Quality, Floorplan, Driving/Towing, Factory Warranty/Support) per model/year. This is the closest
  thing to a neutral Airstream reliability database, and it is **brutal**:
  - 2021 Classic 30RQB: Overall quality **1.0/5** — "sink separated from countertop on first trip…
    light fixture fell from the ceiling… solar display problems."
    (https://www.rvinsider.com/Airstream-Classic-Travel-Trailers-RV-Reviews)
  - 2022 Classic 30RB: **2.6** — "leaks, water, pumps, cabinets pulling away from wall… Airstream
    refuses to honor warranty."
    (https://www.rvinsider.com/Airstream-Travel-Trailers%20-%20Hybrid-RV-Reviews)
  - 2022 Interstate 19: **1.4** — "disastrous money pit… water pump replaced 3 times… rust on the
    roof because Airstream drilled holes and never cleaned the metal shavings."
  - General owner advice surfacing repeatedly: "If you do buy an Airstream, try to get a pre-COVID
    one. 2019 or earlier" + the Vitrifrigo fridge failure pattern + Fantastic-fan-lid fracture defect.
    (https://www.rvinsider.com/Airstream-RV-Reviews?make=airstream)
- **BBB** carries similarly detailed warranty-experience complaints (2023 Flying Cloud 30FB Bunk:
  water heater failed 2 yrs, wall mis-installed at factory, microwave fell out, sewage leak inside
  from disconnected waste tank). (https://www.bbb.org/us/oh/jackson-center/profile/camping-trailer/airstream-0322-25000301/customer-reviews)
- **Takeaway:** there is NO premium, neutral, well-organized place that honestly synthesizes
  "what tends to go wrong, by model/year/system, and what to inspect." Airstream.com structurally
  can't. RV Insider/BBB have the raw signal but ugly UX and no editorial synthesis. **This is the
  single biggest white-space for an accuracy-first, no-commerce reference.**

### A5. Enthusiast communities — what serious owners actually hunt for
**Airforums (airforums.com) — the main enthusiast community. Recurring, high-heat questions:**
- **"Can my truck/SUV actually tow + carry this?"** — the #1 recurring thread type. The community
  consensus is remarkably consistent and sophisticated:
  - "Sticker 'dry weight' is fantasy." Real trailer weight = UVW + 800–1,500 lb.
  - **Payload (the door-jamb yellow sticker), not tow rating, is the true limiter.** Multiple threads
    walk newbies through: Payload Remaining = Sticker Payload − cargo − hitch head (50–75 lb) − tongue
    weight, and "AS published tongue weight is underestimated by the factory" (owners add ~15%).
  - Tongue weight is **worse on FB (front-bath) floor plans, better on RB**.
  - Verify on a **CAT scale**, loaded for a trip including water.
  - Sources: "Tow vehicle capacity for Trade Wind 25FB?"
    (https://www.airforums.com/threads/tow-vehicle-capacity-for-trade-wind-25fb.1442511/);
    "Newbie weight limit questions" (https://www.airforums.com/threads/newbie-weight-limit-questions.2187473/);
    "Changing my Tow Vehicle" (https://www.airforums.com/threads/changing-my-tow-vehicle.1447601/page-3).
  - **This validates our shipped Tow Safety Calculator hard** — but the community wants the *nuance*
    we may not yet encode: published-TW-is-low caveat, FB-vs-RB tongue bias, payload-as-limiter,
    hitch-head weight, "add water weight," CAT-scale verification.
- **Lithium/solar/off-grid system design** (covered in panel-forum-research.md — converter profile,
  DC-DC, shunt as a package). Validates our Off-grid estimator.
- **"What was Airstream thinking?"-style design-quirk threads** (e.g. Good Sam: no 12V plug / inverter
  vs 12V debate). Owners crowd-source *workarounds for known design quirks.*
- **Vintage identification & history** — older threads (Turbodiesel Register, etc.) show steady
  interest in identifying year/model and the towing/mpg lore of vintage rigs.

**Reddit r/Airstream & r/GoRVing — NOTE (honesty):** As in panel-forum-research.md, Reddit could not
be loaded in this environment and never surfaced in web search results. I make **no claims about
specific r/Airstream upvote counts or permalinks.** The *topics* above (tow/payload reality,
reliability/QC, model-choice, mods) are corroborated across Airforums, RV Insider, BBB, Good Sam, and
YouTube creator titles ("10 Hard Truths About Airstreams," "Dear Airstream, Please Fix This,"
"Honest Assessment of Airstream Ownership"), so they are safe directional signal — but a panelist
with Reddit access should still re-run that pass before we cite Reddit specifically.

---

## PART B — Synthesis: what we lack, what nobody owns, how we differentiate

### B1. What competitors do WELL that we currently lack
1. **A genuine neutral "which Airstream is right for me?" matcher** across ALL families on objective
   inputs. Airstream.com has a configurator but it's single-model + sales-biased; we have an
   "Explore & match" section but (per brief) it's not described as a true multi-axis recommender.
2. **A consolidated, authoritative dimensions/spec reference** as clean as the dealer "Dimensions
   Guides" but accurate, dated, sourced, and interactive (we have the data; question is presentation).
3. **Reliability / known-issues / "what to inspect" synthesis** — competitors have raw signal
   (RV Insider, BBB) but no premium neutral synthesis. We have none yet.
4. **Trip/usage translation of raw specs** (boondock days, tow-vehicle reality, park-fit) that rental
   platforms do conversationally — we have calculators but maybe not the editorial "what this means
   for your trip" layer tying them together.
5. **Deep model heritage/history reference** — Airstream.com has great heritage content; a neutral
   timeline of which models existed by year (incl. discontinued) is something enthusiasts hunt for
   and nobody presents cleanly outside the manufacturer's marketing frame.

### B2. Gaps NOBODY fills well (white space we can OWN)
- **WS-1 — A neutral, sourced "Reliability & Known Issues" reference by model/system.** Nobody
  premium + neutral does this. Highest differentiation, fully constraint-compatible (it's editorial
  reference, no commerce).
- **WS-2 — A real cross-family "fit matcher" that bakes in the community's hard-won towing nuance**
  (payload-is-the-limiter, published-TW-runs-low, FB-vs-RB bias). No site combines true Airstream
  spec data + the forum's correction factors in one honest tool.
- **WS-3 — "Will it fit the national park?" length-fit reference.** RVshare/Airstream/JD Power all
  publish the 27-ft-average prose, but nobody crosses **specific Airstream lengths × specific park
  limits** interactively. We already model length in the campsites layer — natural extension.
- **WS-4 — Honest spec accuracy/provenance** (dated, sourced, "Combo tank" disambiguated). The
  market is full of "approximate"/undated/unsourced spec pages; *accuracy-as-a-feature* is ownable.

### B3. How our constraints become differentiation (not handicaps)
- **No commerce** → we are the *only* neutral voice. We can publish reliability truths, towing-reality
  caveats, and "buy a pre-2020 used one" style honesty that no dealer/manufacturer/marketplace can.
  Trust is the moat.
- **Accuracy-first + sourced** → directly answers the market's biggest weakness (stale, undated,
  approximate, seller-entered specs everywhere).
- **Premium editorial** → lets us out-class RV Insider/BBB's ugly UX on the very content (reliability,
  fit) that's most valuable.
- **China-robust + static** → irrelevant to differentiation per se, but means every idea below must be
  baked/client-side (all of them are).

---

## PART C — Ranked opportunities (What · Evidence · Value · Effort · Constraint fit · First step)

### OPP-1 ⭐ "Reliability & Known-Issues" editorial reference (by model & system) — HIGHEST WHITE SPACE
- **What:** A premium, neutral, *sourced* reference synthesizing recurring owner-reported issues by
  system (water/plumbing, electrical/solar, A/C & fridge, cabinetry/build, warranty experience) and,
  where signal is strong enough, by model/year. Framed as "what owners report + what to inspect," not
  "Airstream is bad." Pairs naturally with the existing Maintenance section.
- **Evidence:** RV Insider structured sub-scores and review bodies (Classic 30RQB 1.0 quality;
  Interstate 19 1.4; "buy pre-2020"; Vitrifrigo fridge + Fantastic-fan-lid defect patterns); BBB
  Flying Cloud 30FB Bunk complaint; YouTube creator titles ("10 Hard Truths," "Dear Airstream, Please
  Fix This"). NOBODY premium/neutral synthesizes this. Sources: rvinsider.com (Classic / Hybrid /
  all-Airstream review pages), bbb.org Airstream customer-reviews.
- **Value:** Very high. This is the most-searched owner anxiety, the biggest trust gap, and the thing
  a manufacturer/marketplace structurally can't publish. Defines us as THE honest reference.
- **Effort:** **M–L.** Editorial curation + careful sourcing is the work; build is static content +
  SVG. Accuracy bar is high (must attribute every claim, avoid defamation — frame as "owner-reported,"
  cite, date, aggregate not anecdote-as-fact).
- **Constraint fit:** ✅ No commerce/finance (no pricing, no values, no buy). ✅ Accuracy: every claim
  links to a dated source (RV Insider/BBB/forum thread). ✅ No-AI imagery: SVG system diagrams +
  real-photo inspection points. ⚠️ Must be scrupulously fair/neutral in tone.
- **First step:** Build a small `known-issues.json` schema (system, symptom, affected models/years,
  source_url, source_date, severity, "what to check") and seed ~10 strongest, multiply-sourced
  entries (water heater/inlet leaks, Vitrifrigo fridge, Fantastic-fan-lid fracture, solar-install
  leaks, cabinet/wall separation, warranty-experience note). Editorial review for neutrality before
  shipping.

### OPP-2 ⭐ Upgrade the Tow Calculator with the forum's "towing reality" nuance — HIGHEST LEVERAGE on shipped work
- **What:** Layer the community's hard-won correction factors onto our existing 3-check Tow Safety
  Calculator: (a) flag **payload (door-jamb sticker) as the usual true limiter**, (b) note **published
  Airstream tongue weight runs low — add ~10–15%**, (c) note **FB floor plans are tongue-heavier than
  RB**, (d) add **hitch-head weight (~50–75 lb)** and **water weight (8.34 lb/gal)** to the math,
  (e) "verify on a CAT scale, loaded for a trip" call-to-action.
- **Evidence:** This is the single most consistent, sophisticated consensus on Airforums across many
  threads. Sources: airforums.com tow-vehicle-capacity-Trade-Wind-25FB; newbie-weight-limit-questions;
  changing-my-tow-vehicle (CAT-scale verification, "near upper end of half-ton" real numbers). RV
  dealer/CampgroundViews payload explainers corroborate (payload = the limiter, not tow rating).
- **Value:** High. Turns a good calculator into the *most credible* towing tool online by encoding
  what forums spend thousands of posts re-explaining — and it's distinctly Airstream-aware (FB-vs-RB,
  AS-publishes-TW-low) in a way no generic RV tool is.
- **Effort:** **S–M.** Mostly logic + copy on an already-shipped tool; data (per-floorplan TW, FB/RB
  flag) largely already in trailers.json.
- **Constraint fit:** ✅ All client-side, offline, no commerce. ✅ Accuracy: caveats are sourced to
  forum consensus + physics (water weight). ✅ No imagery needed (or SVG).
- **First step:** Add a "Towing reality check" expandable to the calculator output: payload-limiter
  explainer + FB/RB tongue note + "+15% to published TW" toggle + water-weight line, each with a
  source link.

### OPP-3 ⭐ "Will it fit the park?" national-park length-fit reference
- **What:** A reference pairing **specific Airstream floor-plan lengths × national/state-park length
  limits**, with a clear "X% of parks accept this length" readout and example parks that do/don't fit.
  Extends the campsites length-fit logic from campgrounds to iconic parks.
- **Evidence:** Strong, repeated demand — Airstream's own support article ("average NP limit = 27 ft;
  98% accept ≤19 ft; ~90% accept ≤25 ft"), RVshare's percent-by-length table, JD Power, CA State Parks
  per-park table, Zion/Yosemite per-road limits. Sources:
  support.airstream.com RV-length-restrictions-at-National-Parks; rvshare.com national-parks-rv-length-limits;
  nps.gov Zion/Yosemite large-vehicle pages; parks.ca.gov max trailer lengths table.
- **Value:** High and very on-brand (Airstream + national parks). Nobody crosses *specific model
  length* with *specific park limits* interactively; everyone publishes the generic prose.
- **Effort:** **M.** Need a baked `park-length-limits.json` (sourced per park/road) + join to our
  existing length data. Bounded if we start with the most-visited ~20–30 parks.
- **Constraint fit:** ✅ No commerce. ✅ Accuracy: per-park limit cited to NPS/state-park source +
  date. ✅ Static/baked, China-robust. ✅ SVG/real-photo only.
- **First step:** Seed `park-length-limits.json` with the top ~20 NPS units (limit_ft, source_url,
  source_date, notes like Zion's 26-ft trailer-to-rear-axle rule), then add a "fits which parks" line
  to each trailer detail page driven by its exterior length.

### OPP-4 Authoritative, dated, sourced "Dimensions & Specs" reference (beat the dealer guides)
- **What:** Position our cross-model spec/dimensions presentation as THE accurate, dated, sourced
  alternative to the ubiquitous dealer "Airstream Dimensions Guide" pages — with the "Combo" waste-tank
  ambiguity explicitly disambiguated (per AGENTS.md: Basecamp 16X 24 & Bambi 16RB 30 are genuinely
  single combined tanks; bigger siblings have separate gray/black).
- **Evidence:** Dealer dimension guides (airstreamsandiego.com, airstreamsouthcarolina.com) rank well
  but are explicitly "approximate," undated, unsourced; airstream.com's own spec pages show stale
  crawl dates and ambiguous "Combo" labels. Market-wide spec data is inconsistent/seller-entered
  (RV Trader/RVUSA).
- **Value:** Medium-high. "Accuracy as a feature" — every spec carries a source + date stamp, turning
  our existing data into a credibility showcase and SEO magnet, with zero commerce.
- **Effort:** **S–M.** Largely presentation over existing trailers.json/motorhomes.json; main work is
  per-field source/date provenance + a visible "verified against airstream.com on <date>" stamp.
- **Constraint fit:** ✅ Pure reference, no commerce. ✅ Accuracy is the whole point. ✅ Static. Context
  MSRP display allowed (brief permits context MSRP, not a purchase funnel) — keep it clearly non-buy.
- **First step:** Add `source_url`+`source_date` provenance to spec fields in trailers.json (start with
  tank capacities & weights), render a subtle "Verified <date>" stamp + disambiguate "Combo" tanks.

### OPP-5 "What this means for your trip" usage-translation layer (rental-platform lens, no booking)
- **What:** A small editorial layer on model/detail pages that translates raw specs into trip terms:
  "≈N days boondocking for 2 (from fresh-water + battery)," "tows with a properly-equipped half-ton if
  payload checks out," "fits ~90% of national parks at this length." Ties together the off-grid
  estimator + tow calc + park-fit into one human sentence per model.
- **Evidence:** Rental listings (Outdoorsy/RVshare) consistently frame specs as trip enablers
  ("fresh water 40 gal, gray 26, black 26… will only fill to 20 gal boondocking"; "No truck needed");
  this conversational translation is what non-engineers respond to. Sources: outdoorsy.com Airstream
  listings; rvshare.com.
- **Value:** Medium-high. Makes our data *legible* to dreamers, not just spec-readers; differentiates
  from dry spec tables without any commerce.
- **Effort:** **S** (derive from data + existing calculators; mostly copy/templating).
- **Constraint fit:** ✅ No commerce/booking. ✅ Accuracy: each claim derived from sourced spec +
  labeled "estimate." ✅ Static.
- **First step:** Add a derived "Trip snapshot" block to each trailer detail page (boondock-days
  estimate + tow-class hint + park-fit %), each value linking back to the underlying calculator.

### OPP-6 Neutral model heritage/timeline reference (incl. discontinued lines)
- **What:** A clean, sourced "Airstream through the years" timeline — when each line launched/ended
  (Argosy 1974–79, aluminum Class A 1979–96, Land Yacht 1989, Skydeck 2002, Class A ended 2006,
  Bambi/Caravel relaunch 2020, Trade Wind MY2024, Basecamp Xe 2025, FLW Usonian 2025 ltd 200) —
  framed as neutral reference, useful for vintage identification & "which model is which."
- **Evidence:** Airstream.com heritage content + Crittenden Automotive Library + RV Universe history +
  steady vintage-ID interest on forums. Sources: airstream.com 95-Years / motorized-history;
  carsandracingstuff.com (Crittenden); rvuniverse.com history.
- **Value:** Medium. On-brand, premium-editorial-friendly, SEO-durable, supports vintage owners the
  manufacturer's marketing-framed pages underserve. Lower urgency than OPP-1/2/3.
- **Effort:** **M** (editorial + sourcing; static SVG timeline).
- **Constraint fit:** ✅ No commerce. ✅ Sourced/dated. ✅ SVG timeline, real archival photos w/
  attribution (Wikimedia/heritage).
- **First step:** Draft a sourced `model-history.json` (line, years_active, chassis, notes, source_url)
  and render an SVG decade timeline.

---

## PART D — Rejected (violate constraints) — explicitly out
- **Used-value / pricing / depreciation tools** (JD Power/NADA core product) — REJECT: finance/pricing
  off-limits. (Context MSRP display is OK; valuation/finance funnels are not.)
- **Marketplace / listings / "units for sale"** (RV Trader, RVUSA, FB Marketplace) — REJECT: commerce.
- **Booking / rental availability / "reserve this Airstream"** (Outdoorsy, RVshare booking) — REJECT:
  booking/commerce. (Their *editorial* reference content is fine to learn from / cite.)
- **Affiliate gear shops / "buy this mod"** (creator Amazon storefronts, dealer install upsells) —
  REJECT: affiliate/commerce. (Mod *consensus* is fine — see panel-forum-research.md.)
- **Live cell-coverage / live availability / RV-safe routing** — already rejected in
  cg-panel-1-competitive.md (runtime/China-fragile/no routing engine). Not re-opened here.

---

## Top 3 picks + single highest-leverage call
1. **OPP-1 — Reliability & Known-Issues reference.** Biggest, most-defensible white space; only a
   no-commerce neutral can publish it; pure trust play.
2. **OPP-2 — Tow Calculator "towing reality" nuance.** Highest leverage on already-shipped work;
   encodes the #1 forum consensus; distinctly Airstream-aware.
3. **OPP-3 — "Will it fit the park?" length-fit reference.** On-brand, high-demand, extends shipped
   length logic; nobody crosses model-length × park-limit interactively.

**Single highest-leverage call → OPP-2 (Tow reality nuance)** for *immediate* shipping (S–M, builds on
existing tool, encodes the most-repeated owner pain), with **OPP-1 (Reliability reference)** as the
*strategic* flagship that most defines us as THE honest, no-commerce Airstream reference — the one
thing the manufacturer and every marketplace structurally cannot build.

---

## Source URL list (verified / opened via search)
**Official Airstream:**
- https://www.airstream.com/blog/whats-in-a-name-explaining-fb-rb-and-cb-floor-plans/ (configurator + naming)
- https://www.airstream.com/travel-trailer-floor-plan-comparison-guide/ (Comparison Guide 2026, dual-axle)
- https://support.airstream.com/hc/en-us/articles/4408050191764-RV-length-restrictions-at-National-Parks (NP length)
- airstream.com spec pages (Basecamp, Bambi, Trade Wind, Classic), "Things to Consider Before Buying,"
  "Comparing Single & Dual-Axle," "Answering Questions About Airstream Ownership," Knowledge Base, FAQ,
  95 Years of Airstream / Motorized History / Heritage (history content)

**Spec / dimensions reference:**
- airstreamsandiego.com Airstream Dimensions Guide
- airstreamsouthcarolina.com Airstream Dimensions Guide
- (RV Trader / RVUSA — commerce marketplaces, noted not cited as model)

**Rentals (usage framing + editorial):**
- outdoorsy.com — multiple Airstream listings (Bambi, Basecamp, vintage Safari/Land Yacht/Ambassador)
- https://rvshare.com/blog/national-parks-rv-length-limits/ (% parks accessible by length table)

**Reliability / reputation:**
- https://www.rvinsider.com/Airstream-Classic-Travel-Trailers-RV-Reviews (Classic owner reviews + scores)
- https://www.rvinsider.com/Airstream-RV-Reviews?make=airstream (all-Airstream reviews; "buy pre-2020")
- https://www.bbb.org/us/oh/jackson-center/profile/camping-trailer/airstream-0322-25000301/customer-reviews
- jdpower.com — "Back That Baby Up… National Park RV Length Restrictions" (editorial; pricing product = off-limits)

**Communities (Airforums; Reddit NOT accessible — see honesty note):**
- https://www.airforums.com/threads/tow-vehicle-capacity-for-trade-wind-25fb.1442511/ (payload/TW reality)
- https://www.airforums.com/threads/newbie-weight-limit-questions.2187473/ (GVWR/axle/payload nuance)
- https://www.airforums.com/threads/changing-my-tow-vehicle.1447601/page-3 (CAT-scale verified real numbers)
- community.goodsam.com "What was Airstream thinking (part 2)?" (12V/inverter design-quirk debate)
- carsandracingstuff.com (Crittenden Automotive Library — Airstream history); rvuniverse.com (Airstream history)

**Park length limits (for OPP-3):**
- nps.gov Zion "Large Vehicles" (26-ft trailer-to-rear-axle rule); nps.gov Yosemite "Vehicle Restrictions"
- parks.ca.gov "Maximum Trailer and RV Lengths" (per-park table)

> Honesty caveats: (a) Reddit r/Airstream & r/GoRVing could not be loaded — no upvote/permalink claims
> made; topics corroborated via Airforums/RV Insider/BBB/Good Sam/YouTube. (b) Reliability content must
> be framed as "owner-reported," aggregated (not single-anecdote-as-fact), sourced, dated, and neutral.
> (c) airstream.com spec crawl dates are stale in places — verify each spec live before shipping
> (per AGENTS.md, the NUXT_DATA blob method gets real per-floorplan numbers without a heavy browser).
