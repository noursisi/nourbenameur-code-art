# World Infrastructure Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the World object foundation, spatial canvas, camera pixel analysis (Tier 1), and rich renderers — then prove it works with a Text Silhouette demo algorithm that turns the webcam feed into scattered typography.

**Architecture:** New `js/world/` directory with one module per file. `World` object assembles modules and is created once at app start. Engine passes `world` to all algorithms. All existing algorithms are migrated to the new `render(ctx, world)` signature in a single mechanical pass (no logic changes). New demo algorithms use camera + renderer to create inspo-like art.

**Tech Stack:** Vanilla ES modules, Canvas 2D, WebGL (dedicated offscreen canvas for camera GPU processing), no build step, no dependencies.

**Spec:** `docs/superpowers/specs/2026-03-23-world-infrastructure-design.md`

---

### Task 1: Create World object shell

**Files:**
- Create: `js/world/index.js`

This is the central object that assembles all modules and gets passed to algorithms.

- [ ] **Step 1: Create `js/world/index.js`**

```js
/**
 * World — the unified context object passed to every algorithm.
 * Assembles all infrastructure modules.
 */

export class World {
  constructor(engine) {
    this.engine = engine;
    this.W = 0;
    this.H = 0;
    this.state = null;

    // Modules (added as they're built)
    this.space = null;
    this.camera = null;
    this.physics = null;
    this.gesture = null;
    this.renderer = null;
    this.time = null;
  }

  /** Called once per frame before algorithm render */
  update(W, H, state) {
    this.W = W;
    this.H = H;
    this.state = state;

    // Update modules that exist
    if (this.space) this.space.update(W, H, state);
    if (this.camera) this.camera.update();
    if (this.physics) this.physics.step();
    if (this.time) this.time.update();
    if (this.gesture) this.gesture.update();
    if (this.renderer) this.renderer.update(W, H, this.space);
  }

  /** Called when switching algorithms — resets algorithm-specific module state */
  resetForAlgo() {
    if (this.physics) this.physics.clear();
    if (this.time) this.time.reset();
  }
}
```

- [ ] **Step 2: Verify the file loads without errors**

Run: `cd /Users/nourbenameur/code-art && python3 -c "print('ok')"`

Open browser console at localhost:8082, confirm no new errors.

- [ ] **Step 3: Commit**

```bash
git add js/world/index.js
git commit -m "feat: add World object shell (js/world/index.js)"
```

---

### Task 2: Wire World into engine and app

**Files:**
- Modify: `js/engine.js` — import World, create instance, call world.update() in render pipeline, pass world to algorithms
- Modify: `js/app.js` — pass world to animate(), update selectAlgorithm to call world.resetForAlgo()

The engine creates the World once and updates it each frame. Algorithms receive `(ctx, world)` instead of `(ctx, W, H, state)`.

- [ ] **Step 1: Modify `js/engine.js`**

Add at top:
```js
import { World } from './world/index.js';
```

Add to constructor after `this._layerAlgos`:
```js
this.world = new World(this);
```

In `render(s)` method, add after `if (W === 0 || H === 0) return;`:
```js
// Update world for this frame
this.world.update(W, H, s);
```

In `_renderSingleLayer`, change the algorithm render calls from:
```js
this._algorithm.render(offCtx, W, H, s);
```
to:
```js
this._algorithm.render(offCtx, this.world);
```

And the non-symmetry path from:
```js
this._algorithm.render(ctx, W, H, s);
```
to:
```js
this._algorithm.render(ctx, this.world);
```

In `_renderMultiLayer`, change:
```js
algo.render(offCtx, W, H, layerState);
```
to:
```js
// Create a layer-scoped world view with this layer's state overrides
const layerWorld = Object.create(this.world);
layerWorld.state = layerState;
algo.render(offCtx, layerWorld);
```

- [ ] **Step 2: Modify `js/app.js`**

In the render loop `tick()`, change:
```js
if (activeAlgo) activeAlgo.animate(state);
```
to:
```js
if (activeAlgo) activeAlgo.animate(engine.world);
```

And:
```js
if (algo && algo !== activeAlgo) algo.animate(state);
```
to:
```js
if (algo && algo !== activeAlgo) algo.animate(engine.world);
```

Change cursor map call from:
```js
activeAlgo.cursorMap(mouse.x, mouse.y, state);
```
to:
```js
activeAlgo.cursorMap(mouse.x, mouse.y, engine.world.state);
```

In `selectAlgorithm`, add after `engine.setAlgorithm(algo)`:
```js
engine.world.resetForAlgo();
```

- [ ] **Step 3: Verify app still loads (will break algorithms — expected, fixed in Task 3)**

- [ ] **Step 4: Commit**

```bash
git add js/engine.js js/app.js
git commit -m "feat: wire World into engine render pipeline"
```

---

### Task 3: Migrate all algorithms to new signature

**Files:**
- Modify: `js/algorithms/base.js` — update render/animate/collectSVG/randomize/cursorMap signatures
- Modify: ALL 35 algorithm files — mechanical find-replace
- Modify: `js/export/svg.js` — update collectSVG call
- Modify: `js/export/png.js` — if it calls render directly

Every algorithm's `render(ctx, W, H, state)` becomes `render(ctx, world)` with destructuring at the top: `const { W, H, state } = world;`. Same for `animate(state)` → `animate(world)` with `const { state } = world;`.

- [ ] **Step 1: Update base class `js/algorithms/base.js`**

Change `animate(state) {}` to `animate(world) {}`.

Change `render(ctx, W, H, state) {}` to `render(ctx, world) {}`.

Change `collectSVG(W, H, state)` to `collectSVG(world)`.

Change `randomize(state, setFn)` to `randomize(world, setFn)` — body uses `world.state` for param access. Actually, keep `randomize(state, setFn)` since it's called from app.js with explicit state. Only change render/animate/collectSVG.

- [ ] **Step 2: Migrate all 35 algorithm files**

For each algorithm file, apply this mechanical transformation:

**For `render` method:**
```
// Before:
render(ctx, W, H, state) {
  // uses ctx, W, H, state

// After:
render(ctx, world) {
  const { W, H, state } = world;
  // rest unchanged
```

**For `animate` method (where it exists):**
```
// Before:
animate(state) {
  // uses state

// After:
animate(world) {
  const { state } = world;
  // rest unchanged
```

**For `collectSVG` method (where it exists):**
```
// Before:
collectSVG(W, H, state) {

// After:
collectSVG(world) {
  const { W, H, state } = world;
```

**For `cursorMap` getter:** Keep as `(mx, my, state) => void` — cursorMap is called from app.js which passes `world.state` explicitly.

Algorithm files to migrate (35 total):
- `js/algorithms/fractals/`: julia.js, lsystem.js, fern.js, koch.js, sierpinski.js, dragon.js
- `js/algorithms/nature/`: phyllotaxis.js, flow-field.js, attractor.js, reaction-diffusion.js, voronoi.js, attractor-zoo.js, dla.js, perlin-worms.js, magnetic-field.js
- `js/algorithms/physics/`: harmonograph.js, lissajous.js, spiral.js, chladni.js, moire.js, interference.js
- `js/algorithms/data-art/`: contour.js, filigree.js, spirograph.js, pixel-organic.js, rorschach.js, dot-matrix.js, pixel-dissolve.js, ascii-render.js, bifurcation.js, cellular-automata.js, langton.js, neural-web.js, penrose.js, data-topology.js

- [ ] **Step 3: Update `js/export/svg.js`**

Change call from `algo.collectSVG(W, H, state)` to `algo.collectSVG(engine.world)`.

- [ ] **Step 4: Update `js/export/png.js`**

Check if it calls algo.render() directly. If so, update to pass world.

- [ ] **Step 5: Test in browser**

Open localhost:8082. Verify:
- Default algorithm (L-System) renders correctly
- Switch between several algorithms — all render
- Play/pause animation works
- Scroll zoom works
- Pan works
- Cursor mode works
- Check console for errors

- [ ] **Step 6: Commit**

```bash
git add js/algorithms/ js/export/
git commit -m "feat: migrate all 35 algorithms to render(ctx, world) signature"
```

---

### Task 4: Spatial Canvas module

**Files:**
- Create: `js/world/space.js`
- Modify: `js/world/index.js` — import and attach Space
- Modify: `js/state.js` — keep camZoom/camPanX/camPanY as they are (Space reads from state)

The Space module provides coordinate transforms and viewport info. It reads from the existing `camZoom`/`camPanX`/`camPanY` state values (single source of truth). Algorithms can use `world.space.toWorld()` / `world.space.toScreen()` for coordinate transforms.

- [ ] **Step 1: Create `js/world/space.js`**

```js
/**
 * Space — spatial canvas with world coordinate system.
 * Reads zoom/pan from state. Provides coordinate transforms and viewport info.
 */

export class Space {
  constructor() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.W = 0;
    this.H = 0;

    // Momentum state
    this._velX = 0;
    this._velY = 0;
    this._velZoom = 0;
    this._friction = 0.92;
  }

  /** Detail level — higher zoom = more detail (1 at default, increases with zoom) */
  get detail() {
    return Math.max(1, Math.log2(this.zoom) + 1);
  }

  /** Visible region in world coordinates */
  get viewport() {
    const halfW = (this.W / 2) / this.zoom;
    const halfH = (this.H / 2) / this.zoom;
    const cx = this.panX;
    const cy = this.panY;
    return {
      left: cx - halfW,
      right: cx + halfW,
      top: cy - halfH,
      bottom: cy + halfH,
      width: halfW * 2,
      height: halfH * 2,
    };
  }

  /** Convert screen pixel coordinate to world coordinate */
  toWorld(screenX, screenY) {
    return {
      x: (screenX - this.W / 2) / this.zoom + this.panX,
      y: (screenY - this.H / 2) / this.zoom + this.panY,
    };
  }

  /** Convert world coordinate to screen pixel coordinate */
  toScreen(worldX, worldY) {
    return {
      x: (worldX - this.panX) * this.zoom + this.W / 2,
      y: (worldY - this.panY) * this.zoom + this.H / 2,
    };
  }

  /** Called each frame — sync with state */
  update(W, H, state) {
    this.W = W;
    this.H = H;
    this.zoom = state.camZoom || 1;
    this.panX = state.camPanX || 0;
    this.panY = state.camPanY || 0;
  }
}
```

- [ ] **Step 2: Wire into World**

In `js/world/index.js`, add:
```js
import { Space } from './space.js';
```

In constructor, replace `this.space = null;` with:
```js
this.space = new Space();
```

- [ ] **Step 3: Test in browser**

Open localhost:8082, open console, verify no errors. Pan and zoom should still work identically.

- [ ] **Step 4: Commit**

```bash
git add js/world/space.js js/world/index.js
git commit -m "feat: add Space module with world coordinate system"
```

---

### Task 5: Camera Tier 1 — pixel analysis

**Files:**
- Create: `js/world/camera.js`
- Modify: `js/world/index.js` — import and attach Camera
- Modify: `js/interaction/camera.js` — expose video element for Camera module to read

Camera Tier 1 provides `brightness(x,y)`, `color(x,y)`, `edge(x,y)`, `motion(x,y)` using normalized 0–1 coordinates. GPU-accelerated edge detection via a dedicated offscreen WebGL canvas. Frame differencing for motion detection.

- [ ] **Step 1: Create `js/world/camera.js`**

```js
/**
 * Camera Intelligence — Tier 1: pixel analysis.
 * Reads from the active video element (webcam or uploaded video).
 * Provides brightness, color, edge, motion sampling at normalized coordinates.
 */

export class Camera {
  constructor(engine) {
    this.engine = engine;
    this._video = null;
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
    this._pixels = null;
    this._prevPixels = null;
    this._width = 0;
    this._height = 0;
    this._active = false;

    // Edge detection (downscaled for performance)
    this._edgeData = null;
    this._edgeW = 0;
    this._edgeH = 0;
    // Downscale factor for edge/motion analysis (1/4 resolution)
    this._analysisScale = 0.25;
  }

  /** Is camera active and providing data? */
  get active() { return this._active && this._video && !this._video.paused; }

  /** Set the video source (called when camera starts) */
  setVideo(video) {
    this._video = video;
    this._active = !!video;
  }

  /** Clear video source (called when camera stops) */
  clearVideo() {
    this._video = null;
    this._active = false;
    this._pixels = null;
    this._prevPixels = null;
  }

  /** Called each frame — capture video frame and analyze */
  update() {
    if (!this.active) return;

    const v = this._video;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (w === 0 || h === 0) return;

    // Resize capture canvas if needed
    if (this._width !== w || this._height !== h) {
      this._width = w;
      this._height = h;
      this._canvas.width = w;
      this._canvas.height = h;
    }

    // Save previous frame for motion detection
    this._prevPixels = this._pixels;

    // Capture current frame
    this._ctx.drawImage(v, 0, 0, w, h);
    this._pixels = this._ctx.getImageData(0, 0, w, h);

    // Compute edge map (CPU Sobel on downscaled image for performance)
    this._computeEdges();
  }

  /** Raw pixel data as ImageData */
  get pixels() { return this._pixels; }

  /**
   * Sample brightness at normalized coordinate (0-1 range).
   * Returns 0-1 (0 = black, 1 = white).
   */
  brightness(nx, ny) {
    if (!this._pixels) return 0;
    const idx = this._sampleIndex(nx, ny);
    if (idx < 0) return 0;
    const d = this._pixels.data;
    return (d[idx] * 0.299 + d[idx + 1] * 0.587 + d[idx + 2] * 0.114) / 255;
  }

  /**
   * Sample color at normalized coordinate.
   * Returns {r, g, b} in 0-255 range.
   */
  color(nx, ny) {
    if (!this._pixels) return { r: 0, g: 0, b: 0 };
    const idx = this._sampleIndex(nx, ny);
    if (idx < 0) return { r: 0, g: 0, b: 0 };
    const d = this._pixels.data;
    return { r: d[idx], g: d[idx + 1], b: d[idx + 2] };
  }

  /**
   * Sample edge strength at normalized coordinate.
   * Returns 0-1 (0 = flat, 1 = strong edge).
   */
  edge(nx, ny) {
    if (!this._edgeData) return 0;
    const x = Math.floor(nx * (this._edgeW - 1));
    const y = Math.floor(ny * (this._edgeH - 1));
    if (x < 0 || x >= this._edgeW || y < 0 || y >= this._edgeH) return 0;
    return this._edgeData[y * this._edgeW + x];
  }

  /**
   * Sample motion at normalized coordinate.
   * Returns 0-1 (0 = no change, 1 = maximum change between frames).
   */
  motion(nx, ny) {
    if (!this._pixels || !this._prevPixels) return 0;
    const idx = this._sampleIndex(nx, ny);
    if (idx < 0) return 0;
    const d = this._pixels.data;
    const p = this._prevPixels.data;
    const dr = Math.abs(d[idx] - p[idx]);
    const dg = Math.abs(d[idx + 1] - p[idx + 1]);
    const db = Math.abs(d[idx + 2] - p[idx + 2]);
    return (dr + dg + db) / (255 * 3);
  }

  /** Convert world coordinate to video 0-1 coordinate */
  toVideo(worldX, worldY, space) {
    if (!space) return { x: 0.5, y: 0.5 };
    const screen = space.toScreen(worldX, worldY);
    return {
      x: screen.x / space.W,
      y: screen.y / space.H,
    };
  }

  /** Convert video 0-1 coordinate to world coordinate */
  toWorld(videoX, videoY, space) {
    if (!space) return { x: 0, y: 0 };
    return space.toWorld(videoX * space.W, videoY * space.H);
  }

  // ── Internal ──

  /** Convert normalized (0-1) coordinate to pixel data index */
  _sampleIndex(nx, ny) {
    if (!this._pixels) return -1;
    const x = Math.floor(Math.max(0, Math.min(1, nx)) * (this._width - 1));
    const y = Math.floor(Math.max(0, Math.min(1, ny)) * (this._height - 1));
    return (y * this._width + x) * 4;
  }

  /** Compute Sobel edge detection on downscaled image for performance */
  _computeEdges() {
    if (!this._pixels) return;

    // Downscale for performance (1280x720 → 320x180 = ~57k pixels, <1ms Sobel)
    const w = Math.floor(this._width * this._analysisScale);
    const h = Math.floor(this._height * this._analysisScale);
    if (w < 3 || h < 3) return;

    this._edgeW = w;
    this._edgeH = h;

    // Draw downscaled to a temp canvas
    if (!this._edgeCanvas) {
      this._edgeCanvas = document.createElement('canvas');
      this._edgeCtx = this._edgeCanvas.getContext('2d', { willReadFrequently: true });
    }
    this._edgeCanvas.width = w;
    this._edgeCanvas.height = h;
    this._edgeCtx.drawImage(this._video, 0, 0, w, h);
    const small = this._edgeCtx.getImageData(0, 0, w, h).data;

    if (!this._edgeData || this._edgeData.length !== w * h) {
      this._edgeData = new Float32Array(w * h);
    }

    // Grayscale
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      gray[i] = (small[idx] * 0.299 + small[idx + 1] * 0.587 + small[idx + 2] * 0.114) / 255;
    }

    // Sobel
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const tl = gray[(y - 1) * w + (x - 1)];
        const t  = gray[(y - 1) * w + x];
        const tr = gray[(y - 1) * w + (x + 1)];
        const l  = gray[y * w + (x - 1)];
        const r  = gray[y * w + (x + 1)];
        const bl = gray[(y + 1) * w + (x - 1)];
        const b  = gray[(y + 1) * w + x];
        const br = gray[(y + 1) * w + (x + 1)];

        const gx = -tl - 2 * l - bl + tr + 2 * r + br;
        const gy = -tl - 2 * t - tr + bl + 2 * b + br;
        this._edgeData[y * w + x] = Math.min(1, Math.sqrt(gx * gx + gy * gy));
      }
    }
  }
}
```

- [ ] **Step 2: Wire Camera into World**

In `js/world/index.js`:
```js
import { Camera } from './camera.js';
```

In constructor, replace `this.camera = null;` with:
```js
this.camera = new Camera(engine);
```

- [ ] **Step 3: Connect existing camera.js to World Camera**

In `js/interaction/camera.js`, after the video stream starts, call:
```js
import { engine } from '../engine.js';
// When camera starts:
engine.world.camera.setVideo(videoElement);
// When camera stops:
engine.world.camera.clearVideo();
```

Read the existing `camera.js` first to find the exact integration points.

- [ ] **Step 4: Test**

Open localhost:8082, turn on camera, open console. Verify:
- No errors
- `engine.world.camera.active` returns true when camera is on
- `engine.world.camera.brightness(0.5, 0.5)` returns a number between 0 and 1

- [ ] **Step 5: Commit**

```bash
git add js/world/camera.js js/world/index.js js/interaction/camera.js
git commit -m "feat: add Camera Tier 1 module with brightness/color/edge/motion"
```

---

### Task 6: Rich Renderer module

**Files:**
- Create: `js/world/renderer.js`
- Modify: `js/world/index.js` — import and attach Renderer

Provides `text()`, `textScatter()`, `block()`, `dot()`, `trail()` methods that auto-transform from world coordinates to screen coordinates via Space.

- [ ] **Step 1: Create `js/world/renderer.js`**

```js
/**
 * Renderer — rich drawing primitives in world coordinates.
 * Auto-transforms via Space module. Falls back to screen coords if no Space.
 */

export class Renderer {
  constructor() {
    this._space = null;
    this._W = 0;
    this._H = 0;
  }

  update(W, H, space) {
    this._W = W;
    this._H = H;
    this._space = space;
  }

  /**
   * Convert coordinate to screen.
   * If screenCoords flag is set, pass through (coords are already screen pixels).
   * Otherwise, transform from world coords via Space module.
   */
  _toScreen(x, y, screenCoords) {
    if (screenCoords) return { x, y };
    if (this._space) return this._space.toScreen(x, y);
    return { x, y };
  }

  /** Scale a size to screen pixels (pass through if already in screen units) */
  _scaleSize(size, screenCoords) {
    if (screenCoords) return size;
    if (this._space) return size * this._space.zoom;
    return size;
  }

  /**
   * Draw a text fragment at world position.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} str
   * @param {number} x - world X
   * @param {number} y - world Y
   * @param {object} opts - { size, color, rotation, opacity, font, align, screenCoords }
   */
  text(ctx, str, x, y, opts = {}) {
    const sc = opts.screenCoords;
    const s = this._toScreen(x, y, sc);
    const size = this._scaleSize(opts.size || 14, sc);
    ctx.save();
    ctx.translate(s.x, s.y);
    if (opts.rotation) ctx.rotate(opts.rotation);
    if (opts.opacity !== undefined) ctx.globalAlpha = opts.opacity;
    ctx.font = `${size}px ${opts.font || 'monospace'}`;
    ctx.fillStyle = opts.color || '#ffffff';
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, 0, 0);
    ctx.restore();
  }

  /**
   * Batch scatter text fragments.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string[]} texts
   * @param {{x:number, y:number}[]} positions - world coordinates
   * @param {object} opts - { size, color, font, opacity, sizes[], colors[], rotations[], screenCoords }
   */
  textScatter(ctx, texts, positions, opts = {}) {
    const font = opts.font || 'monospace';
    const baseColor = opts.color || '#ffffff';
    const baseSize = opts.size || 14;
    const baseOpacity = opts.opacity !== undefined ? opts.opacity : 1;
    const sc = opts.screenCoords;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < texts.length; i++) {
      const p = positions[i];
      const s = this._toScreen(p.x, p.y, sc);
      const size = this._scaleSize(opts.sizes ? opts.sizes[i] : baseSize, sc);
      const color = opts.colors ? opts.colors[i] : baseColor;
      const opacity = opts.opacities ? opts.opacities[i] : baseOpacity;
      const rotation = opts.rotations ? opts.rotations[i] : 0;

      ctx.save();
      ctx.translate(s.x, s.y);
      if (rotation) ctx.rotate(rotation);
      ctx.globalAlpha = opacity;
      ctx.font = `${size}px ${font}`;
      ctx.fillStyle = color;
      ctx.fillText(texts[i], 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Draw a geometric block at world position.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - world X (center)
   * @param {number} y - world Y (center)
   * @param {number} w - world width
   * @param {number} h - world height
   * @param {object} opts - { color, rotation, opacity, radius, screenCoords }
   */
  block(ctx, x, y, w, h, opts = {}) {
    const sc = opts.screenCoords;
    const s = this._toScreen(x, y, sc);
    const sw = this._scaleSize(w, sc);
    const sh = this._scaleSize(h, sc);

    ctx.save();
    ctx.translate(s.x, s.y);
    if (opts.rotation) ctx.rotate(opts.rotation);
    if (opts.opacity !== undefined) ctx.globalAlpha = opts.opacity;
    ctx.fillStyle = opts.color || '#ffffff';

    if (opts.radius) {
      const r = Math.min(opts.radius, sw / 2, sh / 2);
      ctx.beginPath();
      ctx.roundRect(-sw / 2, -sh / 2, sw, sh, r);
      ctx.fill();
    } else {
      ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
    }
    ctx.restore();
  }

  /**
   * Draw a dot at world position.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - world X
   * @param {number} y - world Y
   * @param {number} radius - world-space radius
   * @param {object} opts - { color, opacity, glow, screenCoords }
   */
  dot(ctx, x, y, radius, opts = {}) {
    const sc = opts.screenCoords;
    const s = this._toScreen(x, y, sc);
    const sr = this._scaleSize(radius, sc);

    ctx.save();
    if (opts.opacity !== undefined) ctx.globalAlpha = opts.opacity;
    if (opts.glow) {
      ctx.shadowColor = opts.color || '#ffffff';
      ctx.shadowBlur = opts.glow;
    }
    ctx.fillStyle = opts.color || '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw a fading trail along a path.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x:number, y:number}[]} points - world coordinates
   * @param {object} opts - { color, width, fadeStart }
   */
  trail(ctx, points, opts = {}) {
    if (points.length < 2) return;
    const color = opts.color || '#ffffff';
    const width = this._scaleSize(opts.width || 2);
    const fadeStart = opts.fadeStart || 0;

    ctx.save();
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i < points.length; i++) {
      const t = i / (points.length - 1);
      const alpha = t < fadeStart ? 0 : (t - fadeStart) / (1 - fadeStart);
      const a = this._toScreen(points[i - 1].x, points[i - 1].y);
      const b = this._toScreen(points[i].x, points[i].y);

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}
```

- [ ] **Step 2: Wire Renderer into World**

In `js/world/index.js`:
```js
import { Renderer } from './renderer.js';
```

In constructor, replace `this.renderer = null;` with:
```js
this.renderer = new Renderer();
```

- [ ] **Step 3: Test**

Open browser, open console, verify no errors. Existing algorithms should work unchanged (they don't use renderer yet).

- [ ] **Step 4: Commit**

```bash
git add js/world/renderer.js js/world/index.js
git commit -m "feat: add Renderer module with text, block, dot, trail primitives"
```

---

### Task 7: Text Silhouette demo algorithm

**Files:**
- Create: `js/algorithms/camera-art/text-silhouette.js`
- Modify: `js/algorithms/registry.js` — register the new algorithm

This is the payoff — a new algorithm that samples `world.camera.brightness()` on a grid and places text fragments where brightness is above a threshold. Produces art similar to the Instagram inspo (image 1: body shape made of scattered text/dots).

- [ ] **Step 1: Create `js/algorithms/camera-art/text-silhouette.js`**

```js
/**
 * Text Silhouette — camera brightness drives scattered text placement.
 * Without camera: uses Perlin noise to generate a demo pattern.
 */

import { Algorithm } from '../base.js';

// Default text fragments (can be customized)
const DEFAULT_TEXTS = [
  'code', 'art', 'math', 'logic', 'form', 'void', 'data', 'pixel',
  'node', 'flow', 'wave', 'grid', 'mesh', 'loop', 'seed', 'root',
  'signal', 'noise', 'pattern', 'structure', 'chaos', 'order',
  'light', 'shadow', 'depth', 'surface', 'edge', 'field',
];

export class TextSilhouette extends Algorithm {
  get metadata() {
    return {
      name: 'Text Silhouette',
      eq: 'brightness → text',
      cat: 'Camera Art',
      desc: 'Camera brightness drives scattered text placement',
    };
  }

  get params() {
    return [
      { id: 'ts_cols', label: 'Columns', min: 10, max: 80, step: 1 },
      { id: 'ts_rows', label: 'Rows', min: 8, max: 60, step: 1 },
      { id: 'ts_threshold', label: 'Threshold', min: 0, max: 1, step: 0.05 },
      { id: 'ts_fontSize', label: 'Font Size', min: 4, max: 30, step: 1 },
      { id: 'ts_scatter', label: 'Scatter', min: 0, max: 1, step: 0.05 },
      { id: 'ts_dotMode', label: 'Dot Mode', min: 0, max: 1, step: 1 },
    ];
  }

  render(ctx, world) {
    const { W, H, state } = world;
    const cols = state.ts_cols || 40;
    const rows = state.ts_rows || 30;
    const threshold = state.ts_threshold ?? 0.3;
    const fontSize = state.ts_fontSize || 12;
    const scatter = state.ts_scatter || 0.2;
    const dotMode = state.ts_dotMode || 0;
    const cam = world.camera;
    const renderer = world.renderer;
    const hasCamera = cam && cam.active;

    const cellW = W / cols;
    const cellH = H / rows;

    const texts = [];
    const positions = [];
    const sizes = [];
    const colors = [];
    const opacities = [];
    const rotations = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Normalized position in video space (0-1)
        const nx = (col + 0.5) / cols;
        const ny = (row + 0.5) / rows;

        // Get brightness (from camera or generate demo pattern)
        let bright;
        if (hasCamera) {
          bright = cam.brightness(nx, ny);
        } else {
          // Demo mode: animated noise pattern
          const t = state.time || 0;
          bright = 0.5 + 0.5 * Math.sin(nx * 10 + t) * Math.cos(ny * 8 - t * 0.7);
        }

        // Only place text where brightness passes threshold
        if (bright < threshold) continue;

        // Screen position with scatter offset
        const sx = nx * W + (Math.random() - 0.5) * cellW * scatter;
        const sy = ny * H + (Math.random() - 0.5) * cellH * scatter;

        // Size proportional to brightness
        const size = fontSize * (0.5 + bright * 0.8);

        // Color from camera or from foreground
        let color;
        if (hasCamera) {
          const c = cam.color(nx, ny);
          color = `rgb(${c.r},${c.g},${c.b})`;
        } else {
          const fg = state.fgColor || '#ffffff';
          color = fg;
        }

        if (dotMode) {
          // Dot mode — render as circles (screen coords since camera maps to viewport)
          renderer.dot(ctx, sx, sy, size * 0.4, {
            color,
            opacity: 0.3 + bright * 0.7,
            screenCoords: true,
          });
        } else {
          // Text mode — scatter text fragments
          texts.push(DEFAULT_TEXTS[Math.floor(Math.random() * DEFAULT_TEXTS.length)]);
          positions.push({ x: sx, y: sy });
          sizes.push(size);
          colors.push(color);
          opacities.push(0.3 + bright * 0.7);
          rotations.push((Math.random() - 0.5) * scatter * 0.5);
        }
      }
    }

    // Batch render text (screen coords since camera maps to viewport)
    if (!dotMode && texts.length > 0) {
      renderer.textScatter(ctx, texts, positions, {
        font: 'monospace',
        sizes,
        colors,
        opacities,
        rotations,
        screenCoords: true,
      });
    }
  }
}
```

Note: This algorithm uses screen coordinates (camera maps to viewport, not world space). All renderer calls pass `screenCoords: true` to skip the world-to-screen transform. This is the correct pattern for camera-based algorithms. Algorithms that work in world space (e.g., physics particles) would omit `screenCoords` to get automatic transforms.

- [ ] **Step 2: Add default param values to `js/state.js`**

Add after the existing algorithm params:
```js
// Text Silhouette
ts_cols: 40, ts_rows: 30, ts_threshold: 0.3, ts_fontSize: 12, ts_scatter: 0.2, ts_dotMode: 0,
```

- [ ] **Step 3: Register in `js/algorithms/registry.js`**

Read the file first to understand the registration pattern, then add the Text Silhouette import and registration.

- [ ] **Step 4: Test without camera**

Open localhost:8082, select "Text Silhouette" from the algorithm grid. Should show an animated pattern of scattered text using the demo noise mode. Play/pause should animate it. Adjust threshold, scatter, font size sliders.

- [ ] **Step 5: Test with camera**

Turn on the camera. The text should now follow your body shape — bright areas get text, dark areas stay empty. Move around and see the text react. Toggle dot mode to see circles instead of text.

- [ ] **Step 6: Commit**

```bash
git add js/algorithms/camera-art/text-silhouette.js js/algorithms/registry.js js/state.js
git commit -m "feat: add Text Silhouette algorithm — camera brightness drives scattered text"
```

---

### Task 8: Pixel Mosaic demo algorithm

**Files:**
- Create: `js/algorithms/camera-art/pixel-mosaic.js`
- Modify: `js/algorithms/registry.js` — register
- Modify: `js/state.js` — add defaults

Second demo algorithm: samples camera colors on a grid and renders geometric blocks. Like inspo image 2 — pixelated colored blocks with text overlay.

- [ ] **Step 1: Create `js/algorithms/camera-art/pixel-mosaic.js`**

```js
/**
 * Pixel Mosaic — camera color sampled onto geometric blocks.
 * Without camera: uses gradient demo pattern.
 */

import { Algorithm } from '../base.js';

const OVERLAY_TEXTS = [
  'Concept', 'Rational', 'Formal', 'art', 'logic',
  'structure', 'essential', 'thought', 'judgement',
  'rational', 'irrational', 'absolute', 'mind',
];

export class PixelMosaic extends Algorithm {
  get metadata() {
    return {
      name: 'Pixel Mosaic',
      eq: 'color → blocks',
      cat: 'Camera Art',
      desc: 'Camera color sampled onto geometric blocks with text',
    };
  }

  get params() {
    return [
      { id: 'pm_cols', label: 'Columns', min: 5, max: 60, step: 1 },
      { id: 'pm_rows', label: 'Rows', min: 4, max: 45, step: 1 },
      { id: 'pm_gap', label: 'Gap', min: 0, max: 10, step: 1 },
      { id: 'pm_textDensity', label: 'Text Density', min: 0, max: 1, step: 0.05 },
      { id: 'pm_sizeVariation', label: 'Size Variation', min: 0, max: 1, step: 0.05 },
      { id: 'pm_roundness', label: 'Roundness', min: 0, max: 1, step: 0.05 },
    ];
  }

  render(ctx, world) {
    const { W, H, state } = world;
    const cols = state.pm_cols || 20;
    const rows = state.pm_rows || 15;
    const gap = state.pm_gap ?? 2;
    const textDensity = state.pm_textDensity ?? 0.15;
    const sizeVar = state.pm_sizeVariation ?? 0.3;
    const roundness = state.pm_roundness ?? 0;
    const cam = world.camera;
    const hasCamera = cam && cam.active;

    const cellW = W / cols;
    const cellH = H / rows;

    // Seed random for consistent frame (seeded from time for animation)
    const t = state.time || 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const nx = (col + 0.5) / cols;
        const ny = (row + 0.5) / rows;

        // Get color
        let r, g, b;
        if (hasCamera) {
          const c = cam.color(nx, ny);
          r = c.r; g = c.g; b = c.b;
        } else {
          // Demo gradient
          r = Math.floor(nx * 200 + Math.sin(t + col) * 55);
          g = Math.floor(ny * 150 + Math.cos(t * 0.7 + row) * 55);
          b = Math.floor(150 + Math.sin(t * 1.3 + col + row) * 105);
        }

        // Block size with variation
        const hash = Math.sin(col * 127.1 + row * 311.7) * 0.5 + 0.5;
        const sizeScale = 1 - sizeVar * hash;
        const bw = (cellW - gap) * sizeScale;
        const bh = (cellH - gap) * sizeScale;

        const cx = col * cellW + cellW / 2;
        const cy = row * cellH + cellH / 2;

        // Draw block
        ctx.save();
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        if (roundness > 0) {
          const rad = Math.min(roundness * bw * 0.5, bw / 2, bh / 2);
          ctx.beginPath();
          ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, rad);
          ctx.fill();
        } else {
          ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
        }
        ctx.restore();

        // Randomly overlay text
        if (Math.random() < textDensity) {
          const text = OVERLAY_TEXTS[Math.floor(Math.random() * OVERLAY_TEXTS.length)];
          const fontSize = Math.min(cellW, cellH) * 0.6;
          ctx.save();
          ctx.font = `${fontSize}px monospace`;
          ctx.fillStyle = `rgba(${255 - r},${255 - g},${255 - b},0.7)`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, cx, cy);
          ctx.restore();
        }
      }
    }
  }
}
```

- [ ] **Step 2: Add defaults to `js/state.js`**

```js
// Pixel Mosaic
pm_cols: 20, pm_rows: 15, pm_gap: 2, pm_textDensity: 0.15, pm_sizeVariation: 0.3, pm_roundness: 0,
```

- [ ] **Step 3: Register in `js/algorithms/registry.js`**

- [ ] **Step 4: Test without and with camera**

Without camera: should show an animated gradient mosaic with text overlays.
With camera: blocks sample your webcam colors, creating a pixelated self-portrait with scattered text.

- [ ] **Step 5: Commit**

```bash
git add js/algorithms/camera-art/pixel-mosaic.js js/algorithms/registry.js js/state.js
git commit -m "feat: add Pixel Mosaic algorithm — camera color as geometric blocks"
```

---

### Task 9: Push to production and verify

**Files:** None — deployment only.

- [ ] **Step 1: Push to both remotes**

```bash
git push origin main
git push opal main
```

- [ ] **Step 2: Deploy to nourbenameur-codeart Vercel project**

```bash
# Temporarily link to the correct project
cp .vercel/project.json .vercel/project.json.bak
npx vercel link --project nourbenameur-codeart --yes
npx vercel --prod
# Restore original project link
cp .vercel/project.json.bak .vercel/project.json
rm .vercel/project.json.bak
```

- [ ] **Step 3: Verify on production**

Open https://nourbenameur-codeart.vercel.app and verify:
- All existing algorithms still work
- "Text Silhouette" appears in the algorithm grid under "Camera Art"
- "Pixel Mosaic" appears in the algorithm grid under "Camera Art"
- Camera toggle works and feeds into the new algorithms
- Performance is acceptable (60fps target)

- [ ] **Step 4: Commit any fixes if needed**

---

## Phase 2 (next plan)

After Phase 1 is validated and the user confirms it feels right:

- **Physics World module** — particles, forces, collisions
- **Gesture Engine** — touch/mouse interpreted as expressive gestures
- **Camera Tier 2+3** — MediaPipe pose/hands for body-reactive art
- **Time & Evolution** — phases, drift, trails
- **Body Particles algorithm** — pose skeleton → particle emitters at joints
- **Gesture Painter algorithm** — drag/swipe → persistent force trails
- **Living Flow Field** — flow field + physics + camera body as obstacle
- **Upgrade existing algorithms** — add camera/physics/gesture support to flow-field, attractor, etc.
