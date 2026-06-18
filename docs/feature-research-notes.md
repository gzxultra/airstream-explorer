# Feature Research Notes

## Key Findings

### What the project already has:
1. **Tow Safety Calculator** - Full 3-check system (tow rating, payload, GCWR) with 11 vehicles
2. **Off-Grid Estimator** - Battery/solar/water endurance calculator
3. **Campground Finder** - Length-aware campground matching
4. **Floorplan Zones** - Interactive touch-friendly zones
5. **Trailer Comparison** - Side-by-side compare page
6. **Community Photos** - Real attributed photos

### What's missing / high-value opportunities:

1. **Fuel Cost Estimator for Towing** (HIGH VALUE)
   - Users consistently ask "how much will gas cost on my trip?"
   - Towing MPG varies dramatically by vehicle class and trailer weight
   - Data available: vehicle tow data already in repo, trailer weights known
   - Real MPG data from forums: 8-15 MPG depending on vehicle/trailer combo
   - Current gas prices: ~$3.50-4.16/gal (2026)
   - Can estimate: distance × (1/MPG) × price = trip fuel cost
   - Formula for towing MPG penalty is well-documented (30-50% reduction)

2. **Weight Distribution / Packing Calculator** (HIGH VALUE)
   - CCC (Cargo Carrying Capacity) is already in the data
   - Users need to know: "How much stuff can I bring?"
   - Key calculation: CCC - (water weight + propane + gear) = remaining capacity
   - Water weighs 8.34 lb/gal, propane ~4.2 lb/gal
   - This directly uses existing data fields (cccLb, freshGal, etc.)

3. **Altitude/Grade Impact Calculator** (MEDIUM VALUE)
   - Rule of thumb: 3% HP loss per 1,000 ft elevation (naturally aspirated)
   - 2% GCWR reduction per 1,000 ft (Ford/GM recommendation)
   - Grade resistance: weight × sin(angle) 
   - Interesting but more niche

### Decision: Implement these 2 features:

1. **Trip Fuel Cost Estimator** - Combines tow vehicle data + trailer weight + distance to estimate fuel costs
2. **Packing/Payload Calculator** - Shows remaining cargo capacity after water, propane, and standard gear

Both are:
- Pure-function, no external API needed
- Use existing data (trailers.json + tow-vehicles.json)
- High user demand (forums, Reddit)
- Complement existing tow safety calculator
- Can be TDD'd cleanly
