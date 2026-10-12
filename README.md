# The HomeGuild

A private, vetted register of home professionals for Treasure Valley homeowners.
Brand: **Basalt & Sage** (Kit B) — basalt ground, chalk ink, bitterbrush gold, sage "vetted" mark.

## Layout

```
site/                 Static site, no build step. Serve the folder (see below).
  index.html          Home — WebGPU contour hero, Standard, trades, register sample, membership
  standard.html       The seven-point Standard, in full
  register.html       Searchable/filterable register (+ removals log)
  firm.html           Firm detail template (No. 007 shown)
  membership.html     Tiers, application form, FAQ — WebGPU contour header
  about.html          Why it exists, reviewers, bylaws, press
  signin.html         Magic-link sign-in stub
  quote.html          Address → parcel measurement → à la carte exterior services → Stripe
  welcome.html        Post-checkout page
  css/site.css        One stylesheet, tokens at the top
  css/quote.css       Quote flow only
  js/site.js          Nav, scroll reveal, form handling, register filter
  js/catalog.js       Service catalog + pricing rules (shared with the checkout function)
  js/measure.js       Geocode + county parcel lookup (shared with the measure function)
  js/quote.js         Quote page controller: Leaflet map, lawn slider, cart, checkout
netlify/functions/    measure (server-side geocode), lead (free/managed forms), checkout (Stripe), stripe-webhook
netlify.toml          Publish dir, functions, security headers + CSP
  js/terrain.js       WebGPU/TSL animated contour field (Three.js r180 via importmap)
  assets/*.webp       Photography generated with Higgsfield Soul 2.0 (raw PNGs in assets/raw/)
brand/brand-kits.html The three original brand kit options (published as an artifact)
research/             Reference-site taste analysis
```

## Running it

The pages use ES modules and an import map, so open them over HTTP, not `file://`:

```
cd site
python -m http.server 8000
# → http://localhost:8000
```

Any static host works for the brochure pages. The quote flow needs Netlify (functions):

```
npm install
cp .env.example .env     # Stripe test keys
netlify dev              # → http://localhost:8096, functions included
```

On a plain static server the quote page still measures (it falls back to Nominatim for
geocoding) but checkout reports that it is unavailable.

## The quote flow

0. **Home hero** carries the address input; it submits to `quote.html?address=…`, which measures on load.
   Plan details live on `membership.html` (nav label "Plans"); the quote page only shows a slim chooser.
1. **Address** → `measure` function: US Census geocoder (address, county) → county parcel polygon.
   Ada: assessor layer on services2.arcgis.com (acres, zoning). Canyon: IDWR statewide parcels.
   Both keyless. Geocoders land in the street, so the parcel whose address carries the house
   number wins; the page shows the parcel's own address so a wrong pick is obvious.
2. **Lot** → `deriveMeasurements` in `catalog.js` estimates footprint, beds, lawn, foundation
   perimeter and sprinkler zones from lot size. The homeowner can slide the lawn figure.
3. **Tier** → three doors, all via the `lead` function with the parcel and measurements attached.
   **Free** (`tier: free`): join the network; when there's a job the lead is sold to ≤2 vetted
   firms for that trade and the homeowner gets member rates. **Monthly**: goes straight to the priced
   service list (steps 4–5) with the white-glove dispatch membership (`MEMBERSHIP` in
   `catalog.js`, $79/mo placeholder) always in the cart; checkout through Stripe, services
   optional on top. **Managed** (`tier: managed`):
   HomeGuild as property manager, walk-through then a monthly quote.
4. **Services** (Monthly add-on) → every rule in `SERVICES` prices from those measurements. Integer cents only.
5. **Checkout** → the `checkout` function re-measures and re-prices server-side (the browser's
   numbers are never trusted), then creates a Stripe Checkout session with `capture_method:
   manual` so the card is held until the first visit is scheduled. `stripe-webhook` verifies
   the signature and is where the order record goes (Supabase TODO).

Measurements are estimates from parcel records, not a survey; the crew confirms on visit one.
Better inputs when there's budget: Google Places for the address, Google Solar API for real roof
area, and a drawn lawn polygon instead of the slider.

## The WebGPU animation

`js/terrain.js` renders a topographic contour field with Three.js's `WebGPURenderer` and a TSL
fragment shader (4-octave 3D noise → contour lines via `fract`/`fwidth`, every 4th line heavier,
one contour picked out in gold). Behaviour:

- Falls back to WebGL2 automatically where WebGPU is missing (Three handles this); if both fail
  the static SVG contours in the hero remain.
- Honours `prefers-reduced-motion` — draws one still frame, no loop.
- Only renders while on screen; pixel ratio capped at 1.5.
- Presets via `data-terrain="sage"` (hero) and `data-terrain="gold"` (membership block, dark lines
  multiplied over gold). Tune `levels`, `scale`, `speed`, `accentLevel` in `mountTerrain` opts.

Three.js is loaded from jsDelivr. To self-host, download `three.webgpu.js` and `three.tsl.js`
and point the import map at them.

## Hero parcel preview

`assets/parcel-preview.webp` is a stitched Esri World Imagery crop (zoom 19) around parcel
R2343000080 (1701 N 21st St, Boise), with the assessor polygon drawn as inline SVG in
`index.html`. Esri attribution is in the caption. To swap the example lot, run `measureServer()`
for a new address, stitch tiles around its polygon bounds, and update the `<polygon>` points.

## Interactive house

`js/house.js` renders `assets/house.glb` (Three.js WebGL via jsDelivr `+esm`, so no import map
is needed) with ten gold hotspots, one per exterior service in `catalog.js`. Tapping a point shows
the service and its price for the sample lot (9,583 sq ft). Lives on `house.html` and in the
`#services` section of `index.html`; loads lazily when within 600px of the viewport.

The model: a reference render from GPT Image 2.5 (isometric ranch house on its lot, charcoal
background) → Tripo H3.1 image-to-3D (detailed geometry + PBR textures, ~68 MB) → gltf-transform
`optimize --compress quantize --texture-compress webp --texture-size 2048 --simplify-ratio 0.2`
(~10 MB). Hotspot coordinates are normalised to the model's box and were placed with the
authoring helper: open the page, `window.__house.freeze()`, then `window.__house.pick(x, y)` on a
screen point returns the `[x, y, z]` to put in `HOTSPOTS`. CSP allows `blob:` in `img-src` and
`connect-src` because GLTFLoader hands embedded textures to the browser as blob URLs.

## Placeholder content

Every number (61 firms, 412 applications, 14.8%, stat strip), every firm name, every reviewer,
and the removal log are invented to show the layout at realistic proportions. The register data
lives in an inline array at the bottom of `register.html`; `firm.html` is a single hard-coded
example. Replace before launch.

Forms are front-end only (`js/site.js`) — wire them to a backend or form service. Sign-in is a stub.

## Photography

Regenerated 2026-10-12 with GPT Image 2.5 via Higgsfield (quality high, 2k): clean editorial
daylight, true color, no grain, no haze — the earlier Soul 2.0 film-look set is archived in
`assets/raw/previous/`. Direction for any new shot: Treasure Valley setting, foothills or valley
visible where possible, tradespeople mid-task, charcoal workwear, sage/oak/tan palette, composed
like an architecture-magazine feature. `plumber.webp` and `electrician.webp` are still from the
old set.
