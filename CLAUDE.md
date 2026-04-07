# Code Art Studio

Generative art studio — interactive canvas with 20 mathematical algorithms, real-time parameter controls, post-processing effects, and export capabilities.

## Project Structure

- `index.html` — Main shell, loads `js/app.js` as ES module
- `style.css` — Complete dark theme
- `js/app.js` — Entry point, wires UI, render loop
- `js/engine.js` — Render pipeline: clear → image-behind → algorithm → symmetry → post-process → image-front → grain
- `js/state.js` — Central state with all parameter defaults

### Algorithms (`js/algorithms/`)
- `base.js` — Algorithm interface (metadata, params, render, animate, cursorMap, detailParam, collectSVG)
- `registry.js` — Algorithm registry, lazy instantiation
- `fractals/` — julia (WebGL, power/palettes/orbit traps), lsystem (10 rules, tapering, leaves, wind), koch (variable angle, fill, invert), dragon (color gradient, multi-fold)
- `nature/` — phyllotaxis, flow-field (color by direction), attractor (color modes, trails), attractor-zoo (3D rotation, velocity color), magnetic-field (directional color, line styles)
- `physics/` — harmonograph (color gradient, compound), lissajous (amplitude per axis), spiral (multi-arm), chladni (WebGL, palettes, SVG export), interference (WebGL, layouts, decay), moire (scale, contrast, center)
- `data-art/` — contour (SVG export), spirograph, pixel-organic (WebGL), dot-matrix (colors, shapes, 8 patterns, SVG), ascii-render (color modes), penrose (color modes, gap width)
- `camera-art/` — text-silhouette, pixel-mosaic, body-particles

### Effects (`js/effects/`)
- `symmetry.js` — Universal radial symmetry (offscreen + rotate)
- `post-process.js` — Tint, glow, blur (operates on offscreen copy)
- `grain.js` — Film grain

### WebGL (`js/webgl/`)
- `context.js` — GL setup, program compilation, FBO/texture helpers
- `shader-lib.js` — Shared GLSL (noise, FBM, rotation)
- `quad.js` — Fullscreen quad for fragment shader rendering

### Interaction (`js/interaction/`)
- `mouse.js` — Drag/pan, scroll (detail vs zoom), cursor animation
- `keyboard.js` — Keyboard shortcuts (space=play, r=random, s=symmetry, d=scroll mode, c=cursor, t=transparent, 0=reset view, Esc=stop recording)
- `image-layer.js` — Image import, blend modes

### Export (`js/export/`)
- `png.js` — 2x high-res PNG
- `svg.js` — SVG for line-based algorithms
- `video.js` — MediaRecorder (MP4/webm)

## Key Architectural Decisions

- **No build step** — ES modules served directly, deploy to Vercel as static
- **WebGL for pixel-heavy algorithms** — Julia, Chladni, Voronoi, Reaction-Diffusion, Pixel Organic, Rorschach render via GLSL shaders for 60fps
- **Canvas 2D for line-based algorithms** — L-System, Koch, Harmonograph, etc. draw paths
- **Offscreen compositing** — WebGL renders to separate canvas, composited via drawImage. Effects operate on offscreen copies to avoid bleeding into background.
- **Flat state** — All params use prefix convention (e.g. `julia_cr`, `lsystem_angle`)

## Adding a New Algorithm

1. Create `js/algorithms/<category>/<name>.js`
2. Extend `Algorithm` from `base.js`
3. Implement: `metadata`, `params`, `render(ctx, W, H, state)`, `detailParam`, `cursorMap`, `animate`
4. For WebGL: follow `julia.js` pattern (get GL canvas from engine, compile shader, render quad, drawImage to 2D ctx)
5. For SVG export: implement `collectSVG(W, H, state)` returning SVG path elements as string
6. Register in `registry.js`
7. Add default param values to `state.js`

## Deployment

Push to `main` → auto-deploys to Vercel at nourbenameur-code-art.vercel.app

## Development

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

No npm, no build, no dependencies. Just a browser and a text editor.
