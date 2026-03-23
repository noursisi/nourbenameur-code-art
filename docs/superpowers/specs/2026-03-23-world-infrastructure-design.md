# Code Art Studio — World Infrastructure Design

## Overview

Elevate the existing generative art algorithms by building a rich infrastructure layer underneath them. Algorithms keep their math but gain access to spatial exploration, camera intelligence, physics, gestures, rich renderers, and time evolution via a unified `World` object.

**Core principle:** The algorithms are the star. Camera is one powerful input, not the whole app. Everything enhances the math — it should feel like a creative instrument, not a filter app.

## The World Object

Every algorithm receives `render(ctx, world)` instead of `render(ctx, W, H, state)`.

```
world.state      — all existing params (backward compat)
world.W, world.H — canvas size
world.space      — spatial canvas module
world.camera     — camera intelligence module
world.physics    — physics world module
world.gesture    — gesture engine module
world.renderer   — rich renderers module
world.time       — time & evolution module
```

### Backward Compatibility

- **All algorithms always receive `render(ctx, world)`** — no signature detection (fragile with JS)
- `world.W`, `world.H`, `world.state` provide the old values, so migration is just renaming params
- Old algorithms are migrated in a single pass: `render(ctx, W, H, state)` → `render(ctx, world)` with `const { W, H, state } = world`
- Algorithms opt into new features by declaring `capabilities: ['camera', 'physics', 'gesture']` — engine only initializes modules an algorithm declares it needs
- `animate(state)` becomes `animate(world)` — same migration pattern, world.state contains all existing params

### World Lifecycle

- **World persists across frames** — created once when the app starts, updated each frame
- Each module maintains its own state (physics particles, gesture paths, time history)
- When switching algorithms: engine calls `algo.destroy()` (if defined) to clean up module state (e.g., clear particles), then `algo.init(world)` (if defined) for setup
- Modules reset their algorithm-specific state on algo switch, but preserve shared state (camera feed, gesture tracking)

---

## Module 1: Spatial Canvas (`world.space`)

Algorithms render in world coordinates on an infinite canvas. Pan/zoom handled by the space module.

### API
- `world.space.detail` — zoom-dependent detail level (algorithms decide what "more detail" means)
- `world.space.toWorld(screenX, screenY)` → world coordinates
- `world.space.toScreen(worldX, worldY)` → screen coordinates
- `world.space.viewport` — visible region in world space (for culling off-screen work)
- `world.space.zoom` — current zoom level
- `world.space.pan` — current pan offset in world coords

### Behavior
- Smooth momentum on pan and zoom (flick to scroll, pinch releases with drift)
- Level of detail: fractals add iterations, particle systems spawn more, flow fields get finer
- All coordinate systems unified — gestures, camera, algorithms share the same world space
- **Replaces existing `camZoom`/`camPanX`/`camPanY`** — old state keys become aliases that read/write `world.space` values. No dual system; one source of truth.

---

## Module 2: Camera Intelligence (`world.camera`)

Camera becomes an analyzed data source. Three tiers of increasing complexity.

### Tier 1 — Pixel Data (no ML, GPU-accelerated, every frame)
- `camera.pixels` — raw video frame as ImageData
- `camera.brightness(x, y)` — 0–1 brightness at **normalized coordinate** (0–1 range, where 0,0 is top-left of video frame)
- `camera.edge(x, y)` — edge strength (Sobel filter on GPU), same normalized coords
- `camera.color(x, y)` — sampled RGB color, same normalized coords
- `camera.motion(x, y)` — frame-to-frame pixel difference, same normalized coords
- `camera.toVideo(worldX, worldY)` — convert world coordinate to video 0–1 coordinate (camera is anchored to viewport, not world space — moving/zooming changes what the camera "sees" in world coords)
- `camera.toWorld(videoX, videoY)` — convert video 0–1 coordinate to world coordinate

**Camera-to-world mapping:** The camera frame maps to the current viewport. `camera.brightness(0.5, 0.5)` always samples the center of the video, regardless of pan/zoom. Algorithms that want camera data at a world position use `camera.toVideo()` to convert first. This is the simplest model and matches how a webcam actually works — it sees what's on screen.

### Tier 2 — Body Understanding (MediaPipe, ~15fps interpolated to 60)
- `camera.pose` — 33 skeleton landmarks
- `camera.hands[]` — array of hands, each with 21 finger joints
- `camera.silhouette` — binary body vs background mask
- `camera.faces` — 468-point face mesh

### Tier 3 — Derived Intelligence (computed from Tier 2)
- `camera.velocity` — speed + direction of each body part
- `camera.gesture` — high-level: "waving", "pointing", "open palm", "fist"
- `camera.presence` — is someone there, how much of frame

### When Camera is Off
All values return null/empty. Algorithms check and fall back to pure-math mode. Camera enhances but is never required.

---

## Module 3: Physics World (`world.physics`)

Particle system with real physics.

### API
- `world.physics.spawn(x, y, options)` — create particle with mass, velocity, friction, color, size
- `world.physics.addForce(x, y, type, strength, radius)` — types: attract, repel, orbit, directional
- `world.physics.particles` — array of live particles (position, velocity, age, custom data)
- `world.physics.clear()` — remove all particles
- `world.physics.bounds` — collision boundaries (canvas edge, custom shapes, camera silhouette)

### Behavior
- **Engine calls `world.physics.step()` once per frame**, before calling algorithm render. Algorithms never call step() themselves — they spawn particles, add forces, and read positions, but the engine owns the simulation tick. This prevents multi-layer double-stepping.
- Particles have mass, velocity, friction, lifetime
- Force fields can be placed by algorithms, gestures, or camera body parts
- Collision with boundaries (bounce, wrap, destroy)
- Algorithms own their particles — spawn, control, render them however they want
- Forces are cleared each frame (algorithms/gestures re-add them) but particles persist until they expire or are cleared

---

## Module 4: Gesture Engine (`world.gesture`)

Touch/mouse input interpreted as expressive gestures.

### API
- `world.gesture.drags[]` — active drag paths with positions, velocity, pressure
- `world.gesture.pinch` — pinch state (center, scale, rotation)
- `world.gesture.swipes[]` — completed swipe gestures with direction and speed
- `world.gesture.taps[]` — tap/click positions
- `world.gesture.active` — number of active touch points

### Behavior
- Velocity-aware: fast swipe ≠ slow drag
- Drag creates forces along path
- Pinch warps local space
- Two-finger rotate spins the field
- Mouse and touch both work (mouse = single touch point)
- Gestures translate to world coordinates via `world.space`

---

## Module 5: Rich Renderers (`world.renderer`)

Algorithms can render with more than lines and dots.

### API
- `world.renderer.text(str, x, y, options)` — place text fragment with size, color, rotation, opacity
- `world.renderer.textScatter(texts[], positions[], options)` — batch scatter text fragments
- `world.renderer.block(x, y, w, h, options)` — geometric block with color, rotation, opacity
- `world.renderer.dot(x, y, radius, options)` — colored dot with optional glow
- `world.renderer.gradient(x, y, w, h, colors[])` — gradient fill region
- `world.renderer.trail(points[], options)` — fading trail/afterimage along path

### Why use `world.renderer` instead of `ctx` directly?
- `world.renderer` methods **auto-transform from world coordinates to screen coordinates** via `world.space`. Drawing with `ctx` directly means the algorithm must handle coordinate transforms itself.
- Algorithms can still use `ctx` directly for custom rendering — `world.renderer` is a convenience layer, not a replacement.
- Batched for performance (text scatter can handle thousands of fragments)
- Renderers respect the current blend mode and layer settings
- Algorithms choose their visual language per-render — same math, different materiality

---

## Module 6: Time & Evolution (`world.time`)

Algorithms can evolve over time, not just loop.

### API
- `world.time.elapsed` — total time since algorithm started
- `world.time.delta` — time since last frame
- `world.time.phase` — current phase name if algorithm defines phases
- `world.time.progress` — 0–1 progress through current phase
- `world.time.drift(param, speed, range)` — slowly drift a parameter over time
- `world.time.history(key, frames)` — get last N frames of a value (for trails)

### Behavior
- Algorithms can define phase sequences: `['intro', 'build', 'peak', 'decay']` with durations
- Parameters can auto-drift (slow sine wave, random walk, etc.)
- History buffer enables trails and afterimages
- Phase transitions can be smooth (crossfade) or sharp

---

## Algorithm Composability

- **Layer enhancement (priority):** each layer runs a different algorithm with its own params. Layers composite via `drawImage` with blend modes (existing system, already works).
- **Shared physics (optional per-layer flag):** layers can opt into a shared physics world so particles from one layer interact with forces from another. Default: each layer gets isolated physics.
- **Chaining (deferred to later):** algorithm-to-algorithm piping (output of A → input texture of B) is a future enhancement. The layer blend system covers most composability needs for now. When we do chaining, it would work via offscreen canvases: algorithm A renders to a texture, algorithm B receives it as `world.inputTexture`.

---

## Implementation Strategy

Build infrastructure modules one at a time. Each module is independent and testable.

### Priority Order
1. **World object + backward compat wrapper** — foundation everything else plugs into
2. **Spatial canvas** — infinite pan/zoom, world coordinates (upgrades existing cam system)
3. **Camera Tier 1** — pixel sampling (brightness, edge, color, motion) — quick win, enables inspo-like art
4. **Rich renderers** — text scatter, blocks, dots — visual payoff, makes algorithms look different immediately
5. **Physics world** — particles with forces — makes everything feel alive
6. **Gesture engine** — expressive touch/mouse input
7. **Camera Tier 2+3** — MediaPipe pose/hands — body-reactive art
8. **Time & evolution** — phases, drift, history
9. **Algorithm composability** — chaining, shared physics

### Approach per Module
- Each module is a standalone JS file in `js/world/`
- World object assembles them: `js/world/index.js`
- World persists across frames (created once at app start, modules update each frame)
- All existing algorithms migrated in a single pass to new `render(ctx, world)` signature (mechanical change, no logic changes)

---

## New Algorithms to Build (after infrastructure)

Designed specifically for the new capabilities:

1. **Text Silhouette** — camera brightness → scattered text (like inspo image 1)
2. **Pixel Mosaic** — camera color → geometric blocks (like inspo image 2)
3. **Body Particles** — pose skeleton → particle emitters at joints
4. **Gesture Painter** — drag/swipe → persistent force trails that affect particles
5. **Living Flow Field** — flow field + physics particles + camera body as obstacle

---

## Technical Notes

- No build step — stays as ES modules
- **MediaPipe:** loaded from CDN only when camera Tier 2+ activated. Show loading indicator during download (~5MB). Pin to specific version. If CDN unreachable, Tier 2+3 degrade gracefully (return null, same as camera-off). Tier 1 still works (no MediaPipe needed).
- **WebGL context management:** Camera Tier 1 GPU processing (Sobel, etc.) gets its own dedicated offscreen GL canvas, separate from the algorithm WebGL canvas. No context-switching conflicts.
- Physics runs on CPU (simple verlet integration, no library needed for particle counts we'll hit)
- Target: 60fps with camera + physics + 10k particles on modern hardware
