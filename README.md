# Twenty: a field guide to graphic design styles

**Live:** https://twenty-navy.vercel.app

A motion website showcasing the 20 styles from the `graphic-design-styles` skill.
It has no build step: static HTML, CSS and JS, with libraries loaded from CDNs.

## Run it

```bash
python -m http.server 5173
```

Then open http://localhost:5173. Opening `index.html` straight from disk won't work,
because the browser blocks the HDR download over `file://`.

## What's where

| File | What it does |
|---|---|
| `index.html` | Page structure and the 20 hand-built posters (HTML + SVG) |
| `css/site.css` | Design tokens, layout, nav, sections, responsive and reduced-motion rules |
| `css/posters.css` | One recipe per style. Posters are size containers, so everything is in `cqw` and scales |
| `js/data.js` | The 20 styles: essence, must-haves, palette, fonts, and the 3D material per style. Also the matcher briefs |
| `js/core3d.js` | Babylon.js scene: liquid PBR core (GPU displacement), ring of 20 tiles, ribbon-field background, post-processing |
| `js/main.js` | Motion: loader, hero reveal, variable-width type, marquee, word lighting, pinned coverflow index, matcher, cursor |
| `js/posters.js` | Draws the Pixel Art poster pixel by pixel |
| `js/sections.js` | Palettes wall, Typefaces specimen, Spot-the-style quiz, Pairings |

## Signature systems

- **Legibility field:** every frame, the page's text blocks are drawn into a 1/6-resolution
  mask. A final Babylon post-process blurs it and compresses highlights: under text, no pixel
  may be brighter than a readable ceiling, and dark pixels are left untouched, so nothing
  gets blacked out. To tune it, change `ceilL` in the `legible` shader, `Core.legibility`
  (0–1), or the `LEGIBLE` selector list, all in `js/core3d.js`.
- **Smoothness:** these were measured on Intel UHD integrated graphics; the full page runs
  at about 58–68 fps, with 0.5% of frames over 34 ms.
  - The coverflow uses cached geometry and `quickSetter`, so there are no layout reads per
    frame.
  - Grain, the RGB split and the legibility pass share one final GPU pass.
  - Frosted-glass blur is only used on the two nav pills.
  - The root accent colour switches instantly (animating it restyled the whole document).
  - Style changes are split across two frames.
  - The resolution scaler calibrates in the first 12 s, then only steps down on sustained
    low fps, with a 4 s cooldown (every change reallocates all render targets).
  - Triggers re-measure when fonts load or the page height changes, but only once scrolling
    has been idle for 0.5 s. A re-measure costs about 90 ms, so it never runs mid-scroll.
  - Section titles never wrap on desktop, so their stretched arrival can't change the page
    height. The resolution scaler also only switches while the page is still.
  - Result: a full slow scroll has no frame over 50 ms (worst 43 ms).
- **Index snap:** when scrolling stops, the nearest card eases exactly into the focus
  point.
- **Pointer reach:** the liquid core swells toward the cursor with ripple rings. Click near
  it to splash.
- **Dive:** scrolling into the index plunges the camera through the core, with a flash and
  an RGB split.
- **Velocity:** scroll speed drives card skew, marquee shear, chromatic aberration, ring spin
  and background brightness.
- **Style change:** changing style throws a particle burst in the new palette, plus a
  shockwave through the dot matrix.
- **Live posters:** the poster in focus animates in its own style's language (`.live`
  rules at the end of `css/posters.css`). The pixel poster runs sprite frames in
  `js/posters.js`.
- **Index controls:** the active style is the card nearest the focus point. Arrow keys step
  through styles, and clicking a card lands it exactly in focus.
- **Test hook:** add `?qa` to the URL to expose `window.__lenis` for scripted scrolling.

## Tuning the 3D

- **Per-style material:** each style's `core` object in `js/data.js` sets it (`tint`, `metal`, `rough`, `amp`, `iri`).
- **Where the core sits in each section:** `POSES` / `MOBILE_POSES` in `js/main.js`, as fractions of the viewport.
- **Lighting:** swap the `.env` URL in `js/core3d.js`. `studio.env` gives harder, product-shot chrome.

## License

The site's code, copy and the twenty posters are original work. © 2026 Twenty, all rights
reserved. No open-source license is granted for them.

Third-party code, assets and fonts keep their own licenses. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the site's `/licenses` page:
- ThreeUI shader code: MIT (full text included).
- Babylon.js environment map: CC BY 4.0 (attributed).
- Babylon.js: Apache-2.0.
- GSAP: standard no-charge license.
- Lenis: MIT.
- Google Fonts: SIL OFL 1.1.
