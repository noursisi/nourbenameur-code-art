# Code Art Studio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generative art studio web app — an interactive canvas with 18+ mathematical algorithms, real-time parameter controls, post-processing effects, image layers, and export capabilities.

**Architecture:** Static site (no build step) using ES modules. WebGL/GLSL shaders for pixel-heavy algorithms (Julia, Chladni, Rorschach, Reaction-Diffusion, Voronoi, Pixel Organic) for 60fps performance. Canvas 2D for line/path-based algorithms. A central `Engine` class manages the render pipeline: clear → image-behind → algorithm render → symmetry → post-processing (tint, glow, blur) → image-front → grain. The UI is a right-side panel built with vanilla JS.

**Tech Stack:** Vanilla JS (ES modules), WebGL 2 + GLSL shaders, Canvas 2D API, MediaRecorder API (video export), static deployment (Vercel)

---

## File Structure

```
code-art/
  index.html                    — Shell: canvas + panel markup, loads app.js
  style.css                     — All styling: layout, panel, controls, dark theme
  vercel.json                   — Cache headers (no-cache for dev)
  js/
    app.js                      — Entry: init engine, UI bindings, render loop
    engine.js                   — Render pipeline: clear → layers → algo → symmetry → effects
    state.js                    — Central state object + defaults, event emitter
    ui/
      panel.js                  — Build panel sections, slider/toggle/button factories
      algo-grid.js              — Algorithm selector grid
      params.js                 — Dynamic parameter controls per algorithm
    algorithms/
      registry.js               — Algorithm registry: metadata, params, category
      base.js                   — Base algorithm interface
      fractals/
        julia.js                — Julia set (WebGL)
        lsystem.js              — L-System tree (Canvas 2D, 5 rule variants)
        fern.js                 — Barnsley fern (Canvas 2D)
        koch.js                 — Koch snowflake (Canvas 2D)
        sierpinski.js           — Sierpinski triangle (Canvas 2D)
        dragon.js               — Dragon curve (Canvas 2D)
      nature/
        phyllotaxis.js          — Golden angle spirals (Canvas 2D)
        reaction-diffusion.js   — Gray-Scott model (WebGL)
        flow-field.js           — Noise-based particle flow (Canvas 2D)
        attractor.js            — Clifford strange attractor (Canvas 2D)
        voronoi.js              — Voronoi tessellation (WebGL)
      physics/
        chladni.js              — Chladni vibration patterns (WebGL)
        harmonograph.js         — Damped pendulum curves (Canvas 2D)
        lissajous.js            — Lissajous curves (Canvas 2D)
        spiral.js               — Golden/logarithmic spiral (Canvas 2D)
      data-art/
        contour.js              — Topographic isoline map (Canvas 2D)
        filigree.js             — Bezier filigree mandala (Canvas 2D)
        pixel-organic.js        — Pixel-snapped organic forms (WebGL)
        rorschach.js            — Symmetric ink blot (WebGL)
        spirograph.js           — Hypotrochoid curves (Canvas 2D)
    effects/
      post-process.js           — Tint, glow, blur pipeline (offscreen canvas)
      symmetry.js               — Universal radial symmetry (offscreen + rotate)
      grain.js                  — Film grain overlay
    export/
      png.js                    — High-res PNG export (2x render)
      svg.js                    — SVG path export for line-based algos
      video.js                  — MediaRecorder video capture
    webgl/
      context.js                — WebGL context setup, shared utilities
      shader-lib.js             — Common GLSL: noise, rotation, SDF helpers
      quad.js                   — Full-screen quad for fragment shader algos
    interaction/
      mouse.js                  — Drag/pan, scroll (detail vs zoom), cursor animation
      image-layer.js            — Image import, positioning, blend modes
```

## Phase 1: Foundation (Tasks 1-4)
Get a working canvas with one algorithm rendering, basic UI, and the render pipeline.

## Phase 2: WebGL + Interaction (Tasks 5-6)
WebGL infrastructure, Julia set, mouse/scroll/cursor interaction.

## Phase 3: All Algorithms (Tasks 7-10)
Add every algorithm, one category per task. Canvas 2D algorithms, then WebGL algorithms.

## Phase 4: Effects (Tasks 11-13)
Symmetry, post-processing, image layers.

## Phase 5: Export & Polish (Tasks 14-16)
PNG/SVG/Video export, keyboard shortcuts, mobile, deploy.

**WebGL compositing strategy:** WebGL algorithms render to a separate offscreen WebGL canvas. The engine composites the result onto the main 2D canvas using `ctx.drawImage(webglCanvas, 0, 0)`. This allows the 2D effects pipeline (symmetry, tint, glow, blur, grain) to work uniformly on all algorithms regardless of rendering backend.

---

### Task 1: Project Shell — HTML, CSS, Entry Point

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `vercel.json`
- Create: `js/app.js`
- Create: `js/state.js`

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
    ]}
  ]
}
```

- [ ] **Step 2: Create `index.html`**

Full HTML shell with:
- Canvas element (fills left side)
- Panel container (right sidebar, 310px)
- Panel sections: header, algorithm grid, parameters, symmetry, style (base color, tint, glow, blur, grain, line weight, transparent toggle), interaction (scroll mode, cursor animation), image layer, actions (play/pause, randomize, reset, export PNG/SVG/video with duration slider)
- Checkerboard overlay div for transparent mode
- HUD overlay (algo name, equation, zoom info)
- ES module script tag loading `js/app.js`
- No inline JS — all logic in modules

- [ ] **Step 3: Create `style.css`**

Complete dark theme styling:
- Studio grid layout: `1fr 310px`, full viewport height
- Canvas area: relative, overflow hidden, cursor grab
- Canvas: position absolute, 100% width/height
- Panel: dark bg (#080808), scrollable, thin scrollbar
- Panel sections with borders, collapsible
- Algorithm grid: 2 columns, active state
- Sliders: custom range inputs, dark theme
- Toggles: custom on/off
- Buttons: grid layout, hover/active states
- Color swatches: small circles with active border
- Checkerboard: CSS only, toggleable opacity
- HUD: monospace, low opacity, positioned over canvas
- No scrollbar on body, everything fits viewport

- [ ] **Step 4: Create `js/state.js`**

Central state with defaults for every parameter, plus simple event emitter:
```js
export const state = {
  algo: 'lsystem',
  playing: false, time: 0, speed: 0.5,
  scrollMode: 'detail', cursorMode: false,
  mouseX: 0.5, mouseY: 0.5,
  camZoom: 1, camPanX: 0, camPanY: 0,
  sym: false, folds: 8,
  colorMode: 'wb', tint: 'none', customTintRGB: [0,170,255],
  glow: 0, blur: 0, grain: 0, lineWeight: 1,
  transparent: false,
  // Per-algorithm params stored flat
  julia_cr: -0.7, julia_ci: 0.27, julia_iter: 80, julia_scale: 1,
  lsystem_angle: 25, lsystem_depth: 7, lsystem_rule: 0,
  // ... all algorithm params with prefix
};

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }
export function notify() { listeners.forEach(fn => fn()); }
export function set(key, val) { state[key] = val; notify(); }
```

- [ ] **Step 5: Create `js/app.js`**

Entry point: import state, set up resize handler, start render loop (requestAnimationFrame). For now, just clear canvas to black each frame.

- [ ] **Step 6: Verify it loads**

Open `index.html` in browser (or run `python3 -m http.server 8080` from project root). Should see dark canvas with empty panel.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: project shell — HTML, CSS, state, render loop"
```

---

### Task 2: Engine & Render Pipeline

**Files:**
- Create: `js/engine.js`
- Modify: `js/app.js`

- [ ] **Step 1: Create `js/engine.js`**

The Engine class manages the full render pipeline per frame:
```
clear → image-behind → algorithm.render() → symmetry → post-process → image-front → grain → HUD update
```

Key responsibilities:
- Holds references to canvas, 2D context, and WebGL context (lazy-init)
- `resize()` — sets canvas to fill area, stores W/H
- `render()` — runs the pipeline above
- `setAlgorithm(id)` — switches active algorithm, resets view
- Provides `getCtx2D()` and `getWebGL()` for algorithms to use
- Manages offscreen canvas for symmetry

- [ ] **Step 2: Wire engine into `js/app.js`**

Import Engine, create instance, call `engine.resize()` on window resize, call `engine.render()` in animation loop. Add `needsRender` flag — only render when state changes or playing.

- [ ] **Step 3: Verify — canvas clears to black, resizes with window**

- [ ] **Step 4: Commit**

```bash
git add js/engine.js js/app.js && git commit -m "feat: render engine with pipeline"
```

---

### Task 3: UI Panel — Controls Factory

**Files:**
- Create: `js/ui/panel.js`
- Create: `js/ui/algo-grid.js`
- Create: `js/ui/params.js`
- Modify: `js/app.js`

- [ ] **Step 1: Create `js/ui/panel.js`**

Factory functions for UI elements that bind to state:
- `createSlider(container, label, stateKey, min, max, step)` — creates label + range input, two-way binds to state
- `createToggle(container, label, stateKey)` — creates toggle switch
- `createButton(container, label, onClick, cssClass)` — button
- `createButtonGrid(container, buttons)` — 2-col grid of buttons
- `createSwatchRow(container, swatches, stateKey)` — color swatch row

All controls auto-update state and trigger `needsRender`.

- [ ] **Step 2: Create `js/ui/algo-grid.js`**

Builds the algorithm selector grid from registry. Groups by category with labels. Clicking sets `state.algo` and rebuilds params.

- [ ] **Step 3: Create `js/ui/params.js`**

Reads current algorithm's param definitions from registry, creates sliders dynamically. Called whenever algorithm changes. Shows algorithm description below params.

- [ ] **Step 4: Wire all UI into `js/app.js`**

Import UI modules, call builders to populate panel sections. Wire style controls (base color, tint swatches with custom picker, glow/blur/grain/lineWeight sliders, transparent toggle). Wire interaction controls (scroll mode buttons, cursor animation toggle). Wire action buttons (play/pause, randomize, reset view, export stubs).

- [ ] **Step 5: Verify — all panel controls render, sliders update state values**

- [ ] **Step 6: Commit**

```bash
git add js/ui/ js/app.js && git commit -m "feat: UI panel with controls, algo grid, dynamic params"
```

---

### Task 4: First Algorithm — L-System Tree

**Files:**
- Create: `js/algorithms/registry.js`
- Create: `js/algorithms/base.js`
- Create: `js/algorithms/fractals/lsystem.js`
- Modify: `js/engine.js`
- Modify: `js/app.js`

- [ ] **Step 1: Create `js/algorithms/base.js`**

Base interface:
```js
export class Algorithm {
  constructor(engine) { this.engine = engine; }
  get metadata() { return { name: '', eq: '', cat: '', desc: '' }; }
  get params() { return []; } // [{id, label, min, max, step}]
  get cursorMap() { return null; } // (mx, my, state) => {}
  get detailParam() { return null; } // {id, min, max, step} for scroll-detail
  animate(state) {} // called each frame when playing
  render(ctx, W, H, state) {} // draw to canvas
  collectSVG(W, H, state) { return null; } // return SVG path data or null
}
```

- [ ] **Step 2: Create `js/algorithms/registry.js`**

Map of algorithm ID → class. `getAlgorithm(id)` returns instance. `getAllMetadata()` returns list for UI grid.

- [ ] **Step 3: Create `js/algorithms/fractals/lsystem.js`**

L-System implementation:
- 5 rule variants
- Auto-fit bounding box (pre-calculate bounds, scale to fit W×0.85, H×0.85)
- camPanX/Y for dragging
- SVG path collection
- `detailParam`: lsystem_depth (1-12)
- `cursorMap`: mouseX → angle
- `animate`: oscillate angle

- [ ] **Step 4: Register L-System in registry, wire into engine**

Engine calls `algorithm.render(ctx, W, H, state)` in pipeline.

- [ ] **Step 5: Verify — L-System tree renders, sliders work, play animates, drag pans**

- [ ] **Step 6: Commit**

```bash
git add js/algorithms/ js/engine.js js/app.js && git commit -m "feat: L-System tree algorithm with auto-fit"
```

---

### Task 5: WebGL Infrastructure + Julia Set

> **WebGL compositing:** All WebGL algorithms render to an offscreen WebGL canvas. Engine calls `mainCtx.drawImage(glCanvas, 0, 0)` to composite into the 2D pipeline. `context.js` must expose `createFramebuffer()` and `createTexture()` helpers for ping-pong algorithms like Reaction-Diffusion.

**Files:**
- Create: `js/webgl/context.js`
- Create: `js/webgl/shader-lib.js`
- Create: `js/webgl/quad.js`
- Create: `js/algorithms/fractals/julia.js`
- Modify: `js/algorithms/registry.js`

- [ ] **Step 1: Create `js/webgl/context.js`**

WebGL 2 setup:
- Create/reuse WebGL canvas (separate from 2D canvas, overlaid or offscreen)
- `initGL(canvas)` — get context with antialiasing
- `createProgram(vertSrc, fragSrc)` — compile, link, error reporting
- Handle context loss gracefully

- [ ] **Step 2: Create `js/webgl/shader-lib.js`**

Common GLSL code as template strings:
- Simplex noise 2D/3D
- FBM (fractal Brownian motion)
- Rotation matrix
- SDF primitives (circle, box, line)
- Color utilities

- [ ] **Step 3: Create `js/webgl/quad.js`**

Full-screen quad renderer:
- Vertex buffer for 2-triangle quad
- `render(program, uniforms)` — set uniforms (resolution, time, params), draw
- Uniform setter helpers for float, vec2, vec3, int

- [ ] **Step 4: Create `js/algorithms/fractals/julia.js`**

Julia set as a GLSL fragment shader:
- Fragment shader: iterate z²+c per pixel, color based on escape time
- Uniforms: resolution, c_real, c_imag, max_iter, scale, pan, colorMode, transparent
- Transparent mode: alpha = brightness (dark→transparent, bright→opaque)
- No glow halo — clean alpha channel
- `detailParam`: julia_scale
- `cursorMap`: mouseX/Y → c_real/c_imag
- `animate`: orbit c through interesting parameter space
- Renders to offscreen WebGL canvas, engine composites onto main canvas

- [ ] **Step 5: Register Julia, verify — smooth 60fps rendering, transparent works cleanly**

- [ ] **Step 6: Commit**

```bash
git add js/webgl/ js/algorithms/fractals/julia.js js/algorithms/registry.js && git commit -m "feat: WebGL infrastructure + Julia set shader"
```

---

### Task 6: Interaction — Mouse, Scroll, Cursor Animation

> Moved before algorithms so interaction can be verified as each algorithm is added.

**Files:**
- Create: `js/interaction/mouse.js`
- Modify: `js/app.js`

- [ ] **Step 1: Create `js/interaction/mouse.js`**

All mouse/scroll handling:
- **Scroll handler**: checks `state.scrollMode`
  - `'detail'`: reads `algorithm.detailParam`, increments/decrements that state key
  - `'zoom'`: adjusts `state.camZoom`
- **Drag handler**: mousedown/move/up on canvas area, updates `camPanX/Y`, triggers re-render
- **Cursor animation**: tracks normalized mouseX/mouseY (0-1) over canvas. When `state.cursorMode`, calls `algorithm.cursorMap(mx, my, state)` each frame.
- **Double-click**: reset camZoom, camPanX/Y to defaults
- Cursor mode hides cursor on canvas area via CSS class

- [ ] **Step 2: Wire into app.js, verify all interaction modes**

Test: drag pans L-System, scroll-detail changes depth, scroll-zoom zooms Julia, cursor mode drives Julia c values with hidden cursor.

- [ ] **Step 3: Commit**

```bash
git add js/interaction/ js/app.js && git commit -m "feat: mouse interaction — drag, scroll modes, cursor animation"
```

---

### Task 7: Fractal Algorithms (Canvas 2D)

**Files:**
- Create: `js/algorithms/fractals/fern.js`
- Create: `js/algorithms/fractals/koch.js`
- Create: `js/algorithms/fractals/sierpinski.js`
- Create: `js/algorithms/fractals/dragon.js`
- Modify: `js/algorithms/registry.js`

- [ ] **Step 1: Implement Barnsley Fern**
IFS with point plotting. detailParam = point count. cursorMap: mx → point count.

- [ ] **Step 2: Implement Koch Snowflake**
Recursive subdivision. detailParam = depth. SVG-capable (collectSVG returns path data).

- [ ] **Step 3: Implement Sierpinski Triangle**
Recursive triangles. detailParam = depth. cursorMap: mx → depth.

- [ ] **Step 4: Implement Dragon Curve**
Paper-folding directions. detailParam = iterations. cursorMap: mx → iterations.

- [ ] **Step 5: Register all, verify each renders/animates/drags/responds to cursor**

- [ ] **Step 6: Commit**

```bash
git add js/algorithms/fractals/ js/algorithms/registry.js && git commit -m "feat: fractal algorithms — fern, koch, sierpinski, dragon"
```

---

### Task 8: Nature & Physics Algorithms (Canvas 2D)

**Files:**
- Create: `js/algorithms/nature/phyllotaxis.js`
- Create: `js/algorithms/nature/flow-field.js`
- Create: `js/algorithms/nature/attractor.js`
- Create: `js/algorithms/physics/harmonograph.js`
- Create: `js/algorithms/physics/lissajous.js`
- Create: `js/algorithms/physics/spiral.js`
- Modify: `js/algorithms/registry.js`

- [ ] **Step 1: Implement Phyllotaxis**
Golden angle point placement. detailParam = point count. SVG-capable (circle paths). cursorMap: mx → divergence angle, my → dot size.

- [ ] **Step 2: Implement Flow Field**
Noise-based particle trails using fbm. detailParam = particle count. cursorMap: mx → noise scale.

- [ ] **Step 3: Implement Clifford Attractor**
Point plotting with 4 params (a,b,c,d). detailParam = point count. cursorMap: mx → a, my → b.

- [ ] **Step 4: Implement Harmonograph**
Damped pendulum curves. SVG-capable. cursorMap: mx → freq1, my → freq2.

- [ ] **Step 5: Implement Lissajous**
Parametric curve. SVG-capable. cursorMap: mx → freqA, my → freqB.

- [ ] **Step 6: Implement Golden Spiral**
Logarithmic spiral. SVG-capable. cursorMap: mx → growth, my → turns.

- [ ] **Step 7: Register all, verify**

- [ ] **Step 8: Commit**

```bash
git add js/algorithms/nature/ js/algorithms/physics/ js/algorithms/registry.js && git commit -m "feat: nature & physics algorithms"
```

---

### Task 9: Data Art Algorithms (Canvas 2D)

**Files:**
- Create: `js/algorithms/data-art/contour.js`
- Create: `js/algorithms/data-art/filigree.js`
- Create: `js/algorithms/data-art/spirograph.js`
- Modify: `js/algorithms/registry.js`

- [ ] **Step 1: Implement Contour Map**
Noise field isoline rendering. detailParam = contour levels. cursorMap: mx → noise scale.

- [ ] **Step 2: Implement Filigree Mandala**
Bezier curves with radial repetition. SVG-capable. cursorMap: mx → petals, my → curvature.

- [ ] **Step 3: Implement Spirograph**
Hypotrochoid curve. SVG-capable. cursorMap: mx → inner radius, my → pen distance.

- [ ] **Step 4: Register all, verify**

- [ ] **Step 5: Commit**

```bash
git add js/algorithms/data-art/ js/algorithms/registry.js && git commit -m "feat: data art algorithms — contour, filigree, spirograph"
```

---

### Task 10: WebGL Algorithms

> Uses `context.js` helpers including `createFramebuffer()`/`createTexture()` for ping-pong rendering.

**Files:**
- Create: `js/algorithms/nature/reaction-diffusion.js`
- Create: `js/algorithms/nature/voronoi.js`
- Create: `js/algorithms/physics/chladni.js`
- Create: `js/algorithms/data-art/pixel-organic.js`
- Create: `js/algorithms/data-art/rorschach.js`
- Modify: `js/algorithms/registry.js`

- [ ] **Step 1: Reaction-Diffusion shader**
Gray-Scott model. Ping-pong FBOs (two textures, swap each step). Run N simulation steps per frame. Uses `context.createFramebuffer()` and `context.createTexture()`. Note: continues simulating even when paused (needs convergence).

- [ ] **Step 2: Voronoi shader**
Distance-field Voronoi in fragment shader. Render cell edges only. Transparent mode: edges opaque, cells transparent.

- [ ] **Step 3: Chladni shader**
`cos(mπx)cos(nπy) - cos(nπx)cos(mπy)` in fragment shader. Render nodal lines. cursorMap: mx → mode M, my → mode N.

- [ ] **Step 4: Pixel Organic shader**
FBM noise + threshold + pixel grid snap, all in shader. Mirror symmetry baked in.

- [ ] **Step 5: Rorschach shader**
FBM noise + threshold + Y-axis mirror in shader.

- [ ] **Step 6: Register all, verify 60fps on each**

- [ ] **Step 7: Commit**

```bash
git add js/algorithms/ && git commit -m "feat: WebGL algorithms — reaction-diffusion, voronoi, chladni, pixel-organic, rorschach"
```

---

### Task 11: Universal Symmetry

**Files:**
- Create: `js/effects/symmetry.js`
- Modify: `js/engine.js`

- [ ] **Step 1: Create `js/effects/symmetry.js`**

```js
export function applySymmetry(sourceCanvas, targetCtx, W, H, folds) {
  // Render N rotated + mirrored copies of sourceCanvas onto targetCtx
  targetCtx.save();
  targetCtx.translate(W/2, H/2);
  for (let i = 0; i < folds; i++) {
    targetCtx.save();
    targetCtx.rotate(i * 2 * Math.PI / folds);
    targetCtx.drawImage(sourceCanvas, -W/2, -H/2);
    if (i % 2 === 1) {
      targetCtx.scale(-1, 1);
      targetCtx.drawImage(sourceCanvas, -W/2, -H/2);
    }
    targetCtx.restore();
  }
  targetCtx.restore();
}
```

- [ ] **Step 2: Integrate into engine pipeline**

When `state.sym && state.folds > 1`:
1. Algorithm renders to offscreen canvas
2. `applySymmetry(offscreen, mainCtx, W, H, state.folds)` onto main canvas

- [ ] **Step 3: Verify — toggle symmetry on L-System, Julia, Harmonograph. All should work.**

- [ ] **Step 4: Commit**

```bash
git add js/effects/ js/engine.js && git commit -m "feat: universal radial symmetry"
```

---

### Task 12: Post-Processing — Tint, Glow, Blur, Grain

**Files:**
- Create: `js/effects/post-process.js`
- Create: `js/effects/grain.js`
- Modify: `js/engine.js`

- [ ] **Step 1: Create `js/effects/post-process.js`**

Key insight: ALL effects operate on an offscreen copy of the art, then composite back onto a clean background. This ensures glow/blur only affect the shape, not the background.

```
Pipeline:
1. Copy current canvas to artCanvas (offscreen)
2. Apply tint to artCanvas pixels (luminance × tint color)
3. Clear main canvas (fill bg or clearRect if transparent)
4. If glow > 0: draw blurred artCanvas with 'lighter' composite (bloom)
5. If blur > 0: draw artCanvas with CSS filter blur
6. Else: draw artCanvas normally (sharp)
```

Tint presets: `{cyan:[0,170,255], blue:[68,68,255], magenta:[255,68,255], red:[255,68,68], amber:[255,170,0], green:[68,255,68]}` plus custom from color picker.

- [ ] **Step 2: Create `js/effects/grain.js`**

Apply film grain: iterate imageData, add random noise scaled by grain amount. Skip transparent pixels.

- [ ] **Step 3: Wire into engine pipeline — effects run after symmetry, grain runs last**

- [ ] **Step 4: Verify — cyan tint on L-system, glow on Julia, blur on Harmonograph. Effects only on shape, not background.**

- [ ] **Step 5: Commit**

```bash
git add js/effects/ js/engine.js && git commit -m "feat: post-processing — tint, glow, blur, grain"
```

---

### Task 13: Image Layer

**Files:**
- Create: `js/interaction/image-layer.js`
- Modify: `js/engine.js`

- [ ] **Step 1: Create `js/interaction/image-layer.js`**

Manages imported image state:
- `loadImage(file)` — create Image from File, store in state
- `drawImageLayer(ctx, W, H, imgState)` — draw with opacity, scale, blend mode, position
- `removeImage()` — clear
- State: img object, layer ('behind'|'front'), opacity, scale, blend mode, offsetX/Y

- [ ] **Step 2: Wire into engine pipeline**

- If layer='behind': draw image after clear, before algorithm
- If layer='front': draw image after post-processing

- [ ] **Step 3: Wire UI — import button triggers file input, controls show when image loaded**

- [ ] **Step 4: Verify — import image, test behind/front, blend modes, opacity/scale**

- [ ] **Step 5: Commit**

```bash
git add js/interaction/ js/engine.js && git commit -m "feat: image layer with blend modes"
```

---

### Task 14: Export — PNG, SVG, Video

**Files:**
- Create: `js/export/png.js`
- Create: `js/export/svg.js`
- Create: `js/export/video.js`
- Modify: `js/app.js`

- [ ] **Step 1: Create `js/export/png.js`**

High-res export:
1. Create offscreen canvas at 2× current size
2. Temporarily set W/H to 2×, redirect engine to offscreen context
3. Run full render pipeline once
4. Download as PNG
5. Restore original size

- [ ] **Step 2: Create `js/export/svg.js`**

For SVG-capable algorithms only (check `algorithm.collectSVG()`):
- Call `algorithm.collectSVG(W, H, state)` to get path data
- Build SVG document with proper viewBox
- If not SVG-capable, show alert and fall back to PNG

- [ ] **Step 3: Create `js/export/video.js`**

MediaRecorder:
- Try MIME types in order: `video/mp4`, `video/webm;codecs=h264`, `video/webm;codecs=vp9`, `video/webm`
- `startRecording(canvas, duration)` — auto-starts playback, captures stream, auto-stops after duration
- `stopRecording()` — manual stop, triggers download
- High bitrate (12Mbps) for quality

- [ ] **Step 4: Wire export buttons in UI**

- [ ] **Step 5: Verify — export PNG (should be 2x res), export SVG from L-System, record 5s video of Julia animation**

- [ ] **Step 6: Commit**

```bash
git add js/export/ js/app.js && git commit -m "feat: export — high-res PNG, SVG, video recording"
```

---

### Task 15: Polish & Deploy

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: various

- [ ] **Step 1: Add keyboard shortcuts**

- Space: play/pause
- R: randomize
- D: toggle detail/zoom scroll mode
- C: toggle cursor animation
- S: toggle symmetry
- T: toggle transparent
- 0: reset view
- Escape: stop recording

- [ ] **Step 2: Add loading state**

Show "Loading..." in canvas while algorithms initialize (especially WebGL compile).

- [ ] **Step 3: Mobile responsiveness**

On screens < 768px: panel slides in from bottom as a drawer, canvas is full screen. Touch events for pan/pinch-zoom.

- [ ] **Step 4: Performance audit**

- Ensure `needsRender` flag prevents unnecessary frames
- WebGL algorithms should hit 60fps
- Canvas 2D algorithms should hit 30fps minimum
- Throttle heavy algorithms (reaction-diffusion) to acceptable framerate

- [ ] **Step 5: Initial commit and push to GitHub**

```bash
git add -A && git commit -m "feat: polish, keyboard shortcuts, responsive"
git push origin main
```

- [ ] **Step 6: Verify on Vercel — site loads, all features work**

---

### Task 16: CLAUDE.md + Project Docs

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create `CLAUDE.md`**

Project instructions for future agent sessions:
- Project overview and purpose
- File structure explanation
- How to add a new algorithm (extend base.js, register)
- How to add a new WebGL algorithm (shader template)
- Deployment: push to main, auto-deploys
- Key architectural decisions (WebGL for pixel algos, Canvas 2D for line algos, offscreen canvas for effects)
- No build step, ES modules only
- Testing: open in browser, use dev server

- [ ] **Step 2: Commit and push**

```bash
git add CLAUDE.md && git commit -m "docs: add CLAUDE.md for agent collaboration"
git push origin main
```
