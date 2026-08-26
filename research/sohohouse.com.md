# sohohouse.com — Design Map + Taste DNA
Captured 2026-08-26, public homepage, viewport 1440-class window (reported 2560×1215 at 2× DPR).

## Design Map
- Ground: #FFFEF7 (warm off-white, 83% of painted area). Not pure white — a 2% yellow bias.
- Ink: #000000 text; #121212 secondary. Black panels cover ~16% of area (footer/CTA blocks).
- Tint surfaces: #EBE3DB, #F0EEEB (sub-1% area — used as image placeholders and dividers only).
- Display: Cardo (serif) 56/70px weight 400, letter-spacing normal. h2 48/60 400.
- Body/UI: HK Grotesk, 13–16px, weights 400/700. h3 is 18.72px 700 grotesk — the serif is reserved for the two biggest sizes only.
- Buttons: pill (border-radius ≥ 999px), black fill / white text, ~13px, no letter-spacing, no uppercase.
- Shadows: none in practice. Radii: pill on buttons only; images are square-cornered.
- Layout: full-bleed hero image with centered serif headline overlaid; below, edge-to-edge horizontal image rails with caption bars; text sections left-aligned in a ~40% column, right 60% empty.

## Taste DNA
1. Serif-for-two-sizes. Trigger: hierarchy needs. Decision: Cardo at h1/h2 only; everything below 20px is grotesk. Reason: a serif at small sizes reads "hotel brochure"; kept large it reads "institution". Evidence: h3 = 18.72px HK Grotesk 700.
2. Warm ground, hard ink. Trigger: choosing neutrals. Decision: #FFFEF7 page + true #000 text, not grey. Reason: warmth from the paper, authority from the ink; grey text would soften the club's voice. Evidence: textColors #000 ×35, no mid-greys.
3. Photography is the ornament (Restraint). Trigger: temptation to decorate. Decision: zero shadows, zero card chrome, square image corners, one pill button. Reason: the houses themselves are the brand; any UI ornament competes. Evidence: shadows[] empty, radii only on buttons.
4. Asymmetric text column. Trigger: text section layout. Decision: headline+copy in the left ~40%, right side left empty. Reason: emptiness signals confidence — the page doesn't need to fill space to justify itself.
