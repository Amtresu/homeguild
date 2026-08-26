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
  css/site.css        One stylesheet, tokens at the top
  js/site.js          Nav, scroll reveal, form handling, register filter
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

Any static host (Netlify, Cloudflare Pages, GitHub Pages, S3) works as-is.

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

## Placeholder content

Every number (61 firms, 412 applications, 14.8%, stat strip), every firm name, every reviewer,
and the removal log are invented to show the layout at realistic proportions. The register data
lives in an inline array at the bottom of `register.html`; `firm.html` is a single hard-coded
example. Replace before launch.

Forms are front-end only (`js/site.js`) — wire them to a backend or form service. Sign-in is a stub.

## Photography

Generated with Higgsfield Soul 2.0, prompted for documentary/film-grain, cool grey light so it sits
on the basalt ground. Prompts are recorded in the Higgsfield generation history. `plumber.webp`
was cropped from the raw PNG to remove a rendered film border.
