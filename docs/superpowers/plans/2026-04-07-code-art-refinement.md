# Code Art Studio Refinement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Code Art Studio from a bloated algorithm showcase into a focused, intuitive, powerful art-making tool by removing ugly/useless algorithms, redesigning the UI for usability, and deepening the creative control on every remaining algorithm.

**Architecture:** Three-phase approach: (1) purge 14 algorithms to declutter, (2) redesign the panel/layout for usability with bigger text, collapsible sections, and better organization, (3) upgrade each remaining algorithm with more parameters, better visuals, and richer interactivity. No build step changes, no new dependencies.

**Tech Stack:** Vanilla JS (ES modules), Canvas 2D, WebGL/GLSL, CSS. Static deploy to Vercel.

---

## Phase 1: The Purge

### Task 1: Delete garbage algorithms and clean state

**Files:**
- Modify: `js/algorithms/registry.js` — remove 14 imports and registrations
- Modify: `js/state.js` — remove all parameter defaults for deleted algorithms
- Delete: 14 algorithm files (listed below)

**Algorithms to delete:**
1. `js/algorithms/fractals/sierpinski.js` (sierpinski)
2. `js/algorithms/fractals/fern.js` (fern)
3. `js/algorithms/nature/reaction-diffusion.js` (reaction-diffusion)
4. `js/algorithms/nature/voronoi.js` (voronoi)
5. `js/algorithms/nature/dla.js` (dla)
6. `js/algorithms/nature/perlin-worms.js` (perlin-worms)
7. `js/algorithms/data-art/neural-web.js` (neural-web)
8. `js/algorithms/data-art/pixel-dissolve.js` (pixel-dissolve)
9. `js/algorithms/data-art/langton.js` (langton)
10. `js/algorithms/data-art/data-topology.js` (data-topology)
11. `js/algorithms/data-art/bifurcation.js` (bifurcation)
12. `js/algorithms/data-art/filigree.js` (filigree)
13. `js/algorithms/data-art/rorschach.js` (rorschach — too similar to pixel-organic)
14. `js/algorithms/data-art/cellular-automata.js` (cellular-automata — stuck in corner, not fun)

- [ ] **Step 1: Remove imports and registrations from registry.js**

Remove these import lines and their corresponding `registry.register()` calls from `js/algorithms/registry.js`:

```js
// DELETE these imports:
import { Fern }                from './fractals/fern.js';
import { Sierpinski }          from './fractals/sierpinski.js';
import { ReactionDiffusion }   from './nature/reaction-diffusion.js';
import { Voronoi }             from './nature/voronoi.js';
import { DLA }                 from './nature/dla.js';
import { PerlinWorms }         from './nature/perlin-worms.js';
import { NeuralWeb }           from './data-art/neural-web.js';
import { PixelDissolve }       from './data-art/pixel-dissolve.js';
import { Langton }             from './data-art/langton.js';
import { DataTopology }        from './data-art/data-topology.js';
import { Bifurcation }         from './data-art/bifurcation.js';
import { Filigree }            from './data-art/filigree.js';
import { Rorschach }           from './data-art/rorschach.js';
import { CellularAutomata }    from './data-art/cellular-automata.js';

// DELETE these registrations:
registry.register('fern',       Fern);
registry.register('sierpinski', Sierpinski);
registry.register('reaction-diffusion',  ReactionDiffusion);
registry.register('voronoi',             Voronoi);
registry.register('dla',            DLA);
registry.register('perlin-worms',   PerlinWorms);
registry.register('neural-web',     NeuralWeb);
registry.register('pixel-dissolve', PixelDissolve);
registry.register('langton',        Langton);
registry.register('data-topology',  DataTopology);
registry.register('bifurcation',    Bifurcation);
registry.register('filigree',       Filigree);
registry.register('rorschach',      Rorschach);
registry.register('cellular-automata', CellularAutomata);
```

- [ ] **Step 2: Remove parameter defaults from state.js**

Remove all state defaults prefixed with the deleted algorithm IDs. Search for and delete lines containing these prefixes: `fern_`, `sierpinski_`, `rd_`, `voronoi_`, `dla_`, `pw_`, `nweb_`, `pd_`, `lang_`, `dt_`, `bif_`, `fil_`, `ror_`, `ca_`.

- [ ] **Step 3: Delete the 14 algorithm files**

```bash
cd /Users/nourbenameur/code-art
rm js/algorithms/fractals/sierpinski.js
rm js/algorithms/fractals/fern.js
rm js/algorithms/nature/reaction-diffusion.js
rm js/algorithms/nature/voronoi.js
rm js/algorithms/nature/dla.js
rm js/algorithms/nature/perlin-worms.js
rm js/algorithms/data-art/neural-web.js
rm js/algorithms/data-art/pixel-dissolve.js
rm js/algorithms/data-art/langton.js
rm js/algorithms/data-art/data-topology.js
rm js/algorithms/data-art/bifurcation.js
rm js/algorithms/data-art/filigree.js
rm js/algorithms/data-art/rorschach.js
rm js/algorithms/data-art/cellular-automata.js
```

- [ ] **Step 4: Update index.html algo grid**

The algo grid in `index.html` (lines 98-131) contains hardcoded buttons. These are overwritten by `algo-grid.js` at runtime, but clean them up to match the new set. Replace the entire `<div class="algo-grid" id="algo-grid">` contents to only list the 20 remaining algorithms in their new categories.

- [ ] **Step 5: Verify the app loads without errors**

```bash
cd /Users/nourbenameur/code-art && python3 -m http.server 8080 &
# Open http://localhost:8080 in browser, check console for import errors
```

Expected: No import errors, no missing algorithm references. The algo grid should show only the remaining 20 algorithms.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove 14 low-quality algorithms — sierpinski, fern, reaction-diffusion, voronoi, dla, perlin-worms, neural-web, pixel-dissolve, langton, data-topology, bifurcation, filigree, rorschach, cellular-automata"
```

---

## Phase 2: UI Redesign

### Task 2: Redesign panel layout and typography

**Files:**
- Modify: `style.css` — larger fonts, better spacing, collapsible sections, improved contrast
- Modify: `index.html` — restructure panel sections, remove clutter, add collapse toggles

The current panel is 310px with 8px section headers and 7px category labels. Everything is too dark, too small, and too cramped. The redesign:
- Panel width: 310px → 360px
- Section headers: 8px → 12px, with better contrast (#333 → #666)
- Labels/values: 10px → 11px
- Algo buttons: 8px → 10px with more padding
- Category labels: 7px → 9px
- All sections collapsible (click header to toggle)
- Better visual hierarchy with subtle section backgrounds

- [ ] **Step 1: Update panel width and base typography in style.css**

In `style.css`, change the grid template and panel styles:

```css
/* Change grid-template-columns from 1fr 310px to 1fr 360px */
.studio {
  display: grid;
  grid-template-columns: 1fr 360px;
  height: 100vh;
}

/* Panel background slightly lighter for readability */
.panel {
  background: #0a0a0a;
  border-left: 1px solid #1a1a1a;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  height: 100vh;
}

/* Panel header bigger */
.panel-header h1 {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 3px;
  color: #666;
}

/* Section headers — much more visible, clickable */
.panel-section h2 {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #555;
  margin-bottom: 10px;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Collapse indicator */
.panel-section h2::after {
  content: '−';
  font-size: 14px;
  color: #333;
  font-weight: 300;
  transition: transform 0.2s;
}

.panel-section.collapsed h2::after {
  content: '+';
}

.panel-section.collapsed .controls,
.panel-section.collapsed .algo-grid {
  display: none;
}

/* Section padding increase */
.panel-section {
  padding: 14px 20px;
  border-bottom: 1px solid #151515;
  flex-shrink: 0;
}

/* Labels bigger */
.slider-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #555;
}

.slider-label .val {
  color: #666;
  font-family: "Courier New", Courier, monospace;
  font-size: 11px;
}

/* Toggle labels */
.toggle-row label {
  font-size: 11px;
  color: #555;
  user-select: none;
}
```

- [ ] **Step 2: Update algorithm grid styles**

```css
/* Algo grid — bigger buttons, better readability */
.algo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.algo-btn {
  background: #0e0e0e;
  border: 1px solid #1a1a1a;
  color: #555;
  padding: 8px 6px;
  font-size: 10px;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  border-radius: 3px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  text-align: center;
}

.algo-btn:hover {
  border-color: #444;
  color: #999;
  background: #141414;
}

.algo-btn.active {
  border-color: #555;
  color: #ddd;
  background: #1a1a1a;
}

/* Category labels — visible dividers */
.cat-label {
  grid-column: span 2;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #333;
  padding-top: 8px;
  padding-bottom: 2px;
  border-top: 1px solid #181818;
}
```

- [ ] **Step 3: Update button styles**

```css
.btn {
  background: #0e0e0e;
  border: 1px solid #1e1e1e;
  color: #666;
  padding: 8px 10px;
  font-size: 10px;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  border-radius: 3px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  user-select: none;
  text-align: center;
}

.btn:hover {
  border-color: #444;
  color: #aaa;
}

.btn.active {
  border-color: #666;
  color: #ccc;
  background: #1e1e1e;
}
```

- [ ] **Step 4: Add collapsible section behavior in app.js**

Add this at the end of `js/app.js`, before the render loop:

```js
// ── Collapsible sections ─────────────────────────────────────────────────────
document.querySelectorAll('.panel-section h2').forEach(h2 => {
  h2.addEventListener('click', () => {
    h2.parentElement.classList.toggle('collapsed');
  });
});
```

- [ ] **Step 5: Restructure index.html panel sections**

Reorganize the panel to reduce section count. Merge "Interaction" into "Actions". Remove "Image Layer" section header cruft. The new section order:

1. **Algorithm** — the grid (always visible, first thing you see)
2. **Parameters** — per-algorithm controls
3. **Style** — colors, glow, blur, grain, line weight, transparent
4. **Symmetry** — toggle + folds
5. **Layers** — multi-layer controls
6. **Image** — image processor + image layer combined
7. **Export** — PNG, SVG, video recording, play/pause, randomize, reset

Move play/pause, randomize, and reset into the Export/Actions section. Remove the separate "Interaction" section — fold scroll mode and cursor animation into the Parameters section or make them per-algorithm.

- [ ] **Step 6: Improve slider track visibility**

```css
/* Slider track — slightly more visible */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 3px;
  background: #222;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #666;
  cursor: pointer;
  transition: background 0.15s;
}

input[type="range"]::-webkit-slider-thumb:hover {
  background: #999;
}
```

- [ ] **Step 7: Verify layout looks right and commit**

Open in browser, verify:
- Panel is wider and more readable
- All section headers are clickable (collapse/expand)
- Algorithm grid buttons are bigger and clearer
- Sliders are more visible
- No broken layouts or overflow

```bash
git add -A
git commit -m "feat: redesign panel UI — bigger text, collapsible sections, better contrast and spacing"
```

---

## Phase 3: Algorithm Upgrades

### Task 3: Upgrade Julia Set — more variations and color control

**Files:**
- Modify: `js/algorithms/fractals/julia.js`
- Modify: `js/state.js` — add new Julia params

Julia currently has 4 params (cr, ci, iter, scale). It needs:
- **Power parameter** (z^n + c where n = 2-5) for Multibrot variants
- **Color palette** control (not just wb/bw/silver — add gradient palettes)
- **Orbit trap** mode for different visual styles
- Wider iteration range (up to 500)

- [ ] **Step 1: Add new Julia state defaults**

In `js/state.js`, add after existing julia params:
```js
julia_power: 2,        // z^n power (2=standard, 3-5=multibrot)
julia_palette: 0,      // 0=classic, 1=fire, 2=ocean, 3=aurora, 4=monochrome
julia_trap: 0,         // 0=none, 1=circle, 2=cross, 3=point
```

- [ ] **Step 2: Update Julia shader to support power and palettes**

In `js/algorithms/fractals/julia.js`, update the fragment shader to:
- Accept `u_power` uniform (float)
- Implement `cpow(z, n)` for complex power (use polar form: r^n * e^(i*n*theta))
- Add 5 color palettes as functions that map iteration count to RGB
- Accept `u_palette` uniform (int)
- Accept `u_trap` uniform (int) and track min distance to trap shape

```glsl
// Complex power: z^n using polar form
vec2 cpow(vec2 z, float n) {
    float r = length(z);
    float theta = atan(z.y, z.x);
    float rn = pow(r, n);
    return vec2(rn * cos(n * theta), rn * sin(n * theta));
}

// Color palettes
vec3 palette(float t, int pal) {
    if (pal == 1) { // Fire
        return vec3(min(1.0, t * 3.0), t * t, t * t * t * 0.5);
    } else if (pal == 2) { // Ocean
        return vec3(t * t * 0.3, t * 0.7, min(1.0, t * 1.5));
    } else if (pal == 3) { // Aurora
        float s = sin(t * 6.28);
        return vec3(0.5 + 0.5 * sin(t * 6.28), 0.5 + 0.5 * sin(t * 6.28 + 2.09), 0.5 + 0.5 * sin(t * 6.28 + 4.19));
    } else if (pal == 4) { // Monochrome smooth
        return vec3(t);
    }
    // Default: classic smooth
    return vec3(t, t, t);
}
```

- [ ] **Step 3: Update Julia params array and metadata**

Update the `get params()` getter to include the new controls:
```js
get params() {
    return [
        { id: 'julia_cr',      label: 'Real(c)',     min: -2, max: 2, step: 0.005 },
        { id: 'julia_ci',      label: 'Imag(c)',     min: -2, max: 2, step: 0.005 },
        { id: 'julia_iter',    label: 'Iterations',  min: 20, max: 500, step: 1 },
        { id: 'julia_scale',   label: 'Zoom',        min: 0.5, max: 40, step: 0.5 },
        { id: 'julia_power',   label: 'Power',       min: 2, max: 5, step: 1 },
        { id: 'julia_palette', label: 'Palette',     min: 0, max: 4, step: 1 },
        { id: 'julia_trap',    label: 'Orbit Trap',  min: 0, max: 3, step: 1 },
    ];
}
```

- [ ] **Step 4: Update Julia randomize to explore interesting parameter spaces**

```js
randomize(state, set) {
    // Known beautiful Julia set coordinates
    const presets = [
        { cr: -0.7269, ci: 0.1889 },
        { cr: -0.8, ci: 0.156 },
        { cr: 0.285, ci: 0.01 },
        { cr: -0.4, ci: 0.6 },
        { cr: 0.355, ci: 0.355 },
        { cr: -0.54, ci: 0.54 },
        { cr: -0.1, ci: 0.651 },
        { cr: -1.476, ci: 0.0 },
    ];
    const p = presets[Math.floor(Math.random() * presets.length)];
    // Add small random perturbation
    set('julia_cr', p.cr + (Math.random() - 0.5) * 0.05);
    set('julia_ci', p.ci + (Math.random() - 0.5) * 0.05);
    set('julia_power', Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 2 : 2);
    set('julia_palette', Math.floor(Math.random() * 5));
    set('julia_iter', 100 + Math.floor(Math.random() * 200));
}
```

- [ ] **Step 5: Commit**

```bash
git add js/algorithms/fractals/julia.js js/state.js
git commit -m "feat: upgrade Julia Set — power parameter, 5 color palettes, orbit traps, better randomize"
```

---

### Task 4: Upgrade L-System — richer rules, branch tapering, color

**Files:**
- Modify: `js/algorithms/fractals/lsystem.js`
- Modify: `js/state.js`

L-System currently has 5 rules and basic line drawing. It needs:
- **More rule variants** (10+ botanical morphologies)
- **Branch tapering** (line weight decreases with recursion depth)
- **Branch color gradient** (trunk → tip color shift)
- **Leaf markers** (small circles/dots at branch tips for foliage)
- **Wind parameter** (asymmetric angle offset for organic feel)

- [ ] **Step 1: Add new L-System state defaults**

```js
lsystem_taper: 0.7,     // branch width multiplier per depth level (0.3-1.0)
lsystem_wind: 0,        // asymmetric angle offset (-15 to 15 degrees)
lsystem_leaves: 0,      // 0=none, 1=dots, 2=circles
lsystem_leafSize: 3,    // leaf marker size (1-8)
lsystem_rule: 0,        // expand to 0-9 (10 rule variants)
```

- [ ] **Step 2: Add 5 new L-System rule variants**

In the `_rules` array in `lsystem.js`, add after existing 5 rules:

```js
// Rule 5: Willow — drooping branches
{ axiom: 'F', rules: { F: 'FF-[-F+F+F]+[+F-F-F]' }, angle: 22 },
// Rule 6: Bush — dense low growth
{ axiom: 'F', rules: { F: 'F[+FF][-FF]F[-F][+F]F' }, angle: 20 },
// Rule 7: Seaweed — flowing organic
{ axiom: 'F', rules: { F: 'FF+[+F-F-F]-[-F+F+F]' }, angle: 25 },
// Rule 8: Fractal plant — Koch-like branching
{ axiom: 'X', rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }, angle: 25 },
// Rule 9: Canopy — wide spreading
{ axiom: 'F', rules: { F: 'F[+F]F[-F][F]' }, angle: 30 },
```

- [ ] **Step 3: Implement branch tapering in render**

In the turtle graphics interpreter section of `render()`, track stack depth and adjust line width:

```js
// Before the drawing loop:
let stackDepth = 0;
const baseLW = s.lineWeight || 1;
const taper = s.lsystem_taper || 0.7;

// In the character loop:
case '[':
    stack.push({ x, y, angle: a, depth: stackDepth });
    stackDepth++;
    ctx.lineWidth = baseLW * Math.pow(taper, stackDepth);
    break;
case ']':
    const saved = stack.pop();
    x = saved.x; y = saved.y; a = saved.angle;
    stackDepth = saved.depth;
    ctx.lineWidth = baseLW * Math.pow(taper, stackDepth);
    // Draw leaf at branch tip if enabled
    if (s.lsystem_leaves > 0) {
        ctx.beginPath();
        const leafR = s.lsystem_leafSize || 3;
        if (s.lsystem_leaves === 1) {
            ctx.arc(x, y, leafR, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.arc(x, y, leafR, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    break;
```

- [ ] **Step 4: Add wind parameter to angle calculation**

```js
// In the character loop, modify + and - cases:
case '+': a -= (s.lsystem_angle + s.lsystem_wind) * Math.PI / 180; break;
case '-': a += (s.lsystem_angle - s.lsystem_wind) * Math.PI / 180; break;
```

Wind > 0 makes branches lean right, < 0 lean left. Creates natural asymmetry.

- [ ] **Step 5: Update params and commit**

Update params array to expose new controls, then commit:

```bash
git add js/algorithms/fractals/lsystem.js js/state.js
git commit -m "feat: upgrade L-System — 10 rules, branch tapering, leaves, wind"
```

---

### Task 5: Upgrade Koch — variable angle, fill, multi-shape

**Files:**
- Modify: `js/algorithms/fractals/koch.js`
- Modify: `js/state.js`

Koch is limited to standard 60-degree peaks. Add:
- **Peak angle** parameter (10-120 degrees) — changes the shape dramatically
- **Fill mode** — solid fill with alpha instead of just stroke
- **Inner/outer** toggle — peaks can go inward or outward
- **Rotation speed** control (0 = static, user controls orientation)

- [ ] **Step 1: Add Koch state defaults**

```js
koch_angle: 60,       // peak angle in degrees (10-120)
koch_fill: 0,         // 0=stroke, 1=fill
koch_invert: 0,       // 0=outward peaks, 1=inward
koch_rotSpeed: 0.3,   // rotation speed (0=static)
```

- [ ] **Step 2: Implement variable peak angle in Koch recursion**

The current Koch recursion hardcodes 60-degree triangular peaks. Replace the peak calculation to use `koch_angle`:

```js
// In the recursive subdivision function:
// Instead of fixed 60-degree equilateral peak:
const angleRad = (s.koch_angle || 60) * Math.PI / 180;
const invert = s.koch_invert ? -1 : 1;

// p1 = 1/3 along edge, p2 = 2/3 along edge
// peak = rotated point at specified angle
const dx = p2.x - p1.x;
const dy = p2.y - p1.y;
const peak = {
    x: p1.x + dx * 0.5 - dy * Math.sin(angleRad) * invert * 0.5,
    y: p1.y + dy * 0.5 + dx * Math.sin(angleRad) * invert * 0.5
};
```

- [ ] **Step 3: Add fill mode**

After drawing the path, conditionally fill:

```js
if (s.koch_fill) {
    ctx.globalAlpha = 0.15;
    ctx.fill();
    ctx.globalAlpha = 1.0;
}
ctx.stroke();
```

- [ ] **Step 4: Add rotation speed control and update params**

Replace hardcoded `this._rotation = time * 0.3` with `this._rotation = time * s.koch_rotSpeed`.

Update params:
```js
get params() {
    return [
        { id: 'koch_depth',    label: 'Depth',      min: 0, max: 7, step: 1 },
        { id: 'koch_sides',    label: 'Sides',      min: 3, max: 8, step: 1 },
        { id: 'koch_angle',    label: 'Peak Angle',  min: 10, max: 120, step: 1 },
        { id: 'koch_fill',     label: 'Fill',        min: 0, max: 1, step: 1 },
        { id: 'koch_invert',   label: 'Invert',      min: 0, max: 1, step: 1 },
        { id: 'koch_rotSpeed', label: 'Rotation',    min: 0, max: 2, step: 0.1 },
    ];
}
```

- [ ] **Step 5: Commit**

```bash
git add js/algorithms/fractals/koch.js js/state.js
git commit -m "feat: upgrade Koch — variable peak angle, fill mode, invert, rotation control"
```

---

### Task 6: Upgrade Dragon Curve — color gradient, thickness, multi-fold

**Files:**
- Modify: `js/algorithms/fractals/dragon.js`
- Modify: `js/state.js`

- [ ] **Step 1: Add state defaults**

```js
dragon_colorGrad: 0,    // 0=single color, 1=gradient along path
dragon_folds: 1,        // 1-4 simultaneous dragon curves rotated
dragon_rotSpeed: 0.35,  // rotation speed (0=static)
```

- [ ] **Step 2: Implement path color gradient**

When `dragon_colorGrad` is on, interpolate color along the path from foreground to a complementary hue:

```js
// In render, when drawing segments:
if (s.dragon_colorGrad) {
    const total = points.length;
    for (let i = 0; i < total - 1; i++) {
        const t = i / total;
        const r = Math.round(fg.r * (1 - t) + fg.r * 0.3 * t);
        const g = Math.round(fg.g * (1 - t) + fg.g * 1.5 * t);
        const b = Math.round(fg.b * (1 - t) + 255 * t);
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[i+1].x, points[i+1].y);
        ctx.stroke();
    }
} else {
    // Original single-color path drawing
}
```

- [ ] **Step 3: Implement multi-fold (multiple rotated copies)**

```js
// In render, after computing points:
const folds = s.dragon_folds || 1;
for (let f = 0; f < folds; f++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((f / folds) * Math.PI * 2);
    ctx.translate(-cx, -cy);
    // draw the dragon curve path
    ctx.restore();
}
```

- [ ] **Step 4: Update params and commit**

```bash
git add js/algorithms/fractals/dragon.js js/state.js
git commit -m "feat: upgrade Dragon Curve — color gradient, multi-fold, rotation control"
```

---

### Task 7: Upgrade Attractor Zoo — higher res, 3D rotation, color by velocity

**Files:**
- Modify: `js/algorithms/nature/attractor-zoo.js`
- Modify: `js/state.js`

The density buffer is capped at 800x800. This needs to go higher. Also add:
- **Full 3D rotation** (X and Y axis, not just Y)
- **Color by velocity** — faster-moving points get warmer colors
- **Trail mode** — show recent trajectory as a fading line

- [ ] **Step 1: Add state defaults**

```js
az_rotX: 0,            // X-axis rotation angle
az_rotY: 0,            // Y-axis rotation (currently time-driven)
az_colorMode: 0,       // 0=density, 1=velocity, 2=position
az_resolution: 1,      // 0.5=half, 1=full, 2=double density buffer
```

- [ ] **Step 2: Increase density buffer resolution**

Change the max buffer size from 800 to canvas-matching:

```js
// Replace fixed 800x800 with adaptive sizing
const scale = s.az_resolution || 1;
const bufW = Math.min(Math.round(W * scale), 1600);
const bufH = Math.min(Math.round(H * scale), 1200);
```

- [ ] **Step 3: Add velocity-based coloring**

Track velocity (distance between consecutive points) and store in a parallel buffer:

```js
// During iteration, compute velocity:
const dx = nx - x;
const dy = ny - y;
const dz = nz - z;
const vel = Math.sqrt(dx*dx + dy*dy + dz*dz);

// Map velocity to color channel in density buffer:
// densityR for density, densityG for velocity
```

- [ ] **Step 4: Add dual-axis rotation**

Replace Y-only rotation with proper Euler rotation:

```js
const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

// Apply Y rotation then X rotation:
const rx = x * cosY - z * sinY;
const ry1 = y;
const rz = x * sinY + z * cosY;
const ry = ry1 * cosX - rz * sinX;
```

- [ ] **Step 5: Update params and commit**

```bash
git add js/algorithms/nature/attractor-zoo.js js/state.js
git commit -m "feat: upgrade Attractor Zoo — higher resolution, 3D rotation, velocity coloring"
```

---

### Task 8: Upgrade Magnetic Field — colors, forms, energy

**Files:**
- Modify: `js/algorithms/nature/magnetic-field.js`
- Modify: `js/state.js`

- [ ] **Step 1: Add state defaults**

```js
mag_colorMode: 0,      // 0=mono, 1=field direction, 2=field strength, 3=pole proximity
mag_lineStyle: 0,      // 0=solid, 1=dashed, 2=dotted, 3=tapered
mag_energy: 1,         // animation energy multiplier (0.1-5)
mag_poleSize: 8,       // pole visual size (2-20)
```

- [ ] **Step 2: Implement field-direction coloring**

Map field vector angle at each point to HSL hue:

```js
// In line tracing loop:
if (s.mag_colorMode === 1) {
    const angle = Math.atan2(fy, fx);
    const hue = ((angle / Math.PI) * 180 + 180) % 360;
    ctx.strokeStyle = `hsl(${hue}, 70%, 60%)`;
} else if (s.mag_colorMode === 2) {
    const strength = Math.sqrt(fx*fx + fy*fy);
    const bright = Math.min(100, strength * 20);
    ctx.strokeStyle = `hsl(0, 0%, ${bright}%)`;
} else if (s.mag_colorMode === 3) {
    // Color by nearest pole — warm for +, cool for -
    const nearestPole = findNearestPole(px, py, poles);
    const hue = nearestPole.charge > 0 ? 0 : 220;
    ctx.strokeStyle = `hsl(${hue}, 60%, 55%)`;
}
```

- [ ] **Step 3: Implement line styles**

```js
if (s.mag_lineStyle === 1) ctx.setLineDash([4, 4]);
else if (s.mag_lineStyle === 2) ctx.setLineDash([1, 3]);
else if (s.mag_lineStyle === 3) {
    // Tapered: decrease lineWidth along trace
    ctx.lineWidth = lw * (1 - step / totalSteps);
}
else ctx.setLineDash([]);
```

- [ ] **Step 4: Add energy multiplier to pole animation**

Multiply the sinusoidal drift amplitude by `s.mag_energy`:

```js
pole.x += Math.sin(t * 0.3 + i * 2.1) * 0.3 * s.mag_energy;
pole.y += Math.cos(t * 0.4 + i * 1.7) * 0.3 * s.mag_energy;
```

- [ ] **Step 5: Update params and commit**

```bash
git add js/algorithms/nature/magnetic-field.js js/state.js
git commit -m "feat: upgrade Magnetic Field — directional colors, line styles, energy control"
```

---

### Task 9: Upgrade Dot Matrix — colors, more patterns, size modes

**Files:**
- Modify: `js/algorithms/data-art/dot-matrix.js`
- Modify: `js/state.js`

User loves this one and wants it much more interactive and editable.

- [ ] **Step 1: Add state defaults**

```js
dm_colorMode: 0,       // 0=mono, 1=position gradient, 2=value gradient, 3=rainbow
dm_shape: 0,           // 0=circle, 1=square, 2=diamond, 3=cross
dm_invert: 0,          // invert pattern values
dm_animate: 1,         // animation on/off
dm_animSpeed: 1,       // animation speed multiplier (0.1-5)
dm_pattern: 0,         // expand to 0-7 (add 3 new patterns)
```

- [ ] **Step 2: Add 3 new patterns**

```js
// Pattern 5: Spiral — distance from center with angular offset
case 5: {
    const dx = col - cols/2, dy = row - rows/2;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const angle = Math.atan2(dy, dx);
    value = (Math.sin(dist * 0.3 - angle * 2 + time) + 1) / 2;
    break;
}
// Pattern 6: Interference — two-source wave
case 6: {
    const d1 = Math.sqrt((col - cols*0.3)**2 + (row - rows*0.3)**2);
    const d2 = Math.sqrt((col - cols*0.7)**2 + (row - rows*0.7)**2);
    value = (Math.sin(d1 * 0.5 + time) + Math.sin(d2 * 0.5 + time) + 2) / 4;
    break;
}
// Pattern 7: Organic — FBM noise with time
case 7: {
    value = fbm(col * 0.08, row * 0.08, time * 0.3);
    break;
}
```

- [ ] **Step 3: Implement color modes**

```js
if (colorMode === 1) {
    // Position gradient: hue from position
    const hue = ((col / cols) * 180 + (row / rows) * 180) % 360;
    ctx.fillStyle = `hsl(${hue}, 70%, ${50 + value * 30}%)`;
} else if (colorMode === 2) {
    // Value gradient: brightness maps to hue
    const hue = value * 240; // blue to red
    ctx.fillStyle = `hsl(${hue}, 80%, 55%)`;
} else if (colorMode === 3) {
    // Rainbow: time-shifted hue
    const hue = ((col + row) * 5 + time * 50) % 360;
    ctx.fillStyle = `hsla(${hue}, 75%, 55%, ${0.3 + value * 0.7})`;
}
```

- [ ] **Step 4: Implement shape variants**

```js
switch (shape) {
    case 0: // Circle
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        break;
    case 1: // Square
        ctx.rect(cx - r, cy - r, r * 2, r * 2);
        break;
    case 2: // Diamond
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        break;
    case 3: // Cross
        const w = r * 0.35;
        ctx.rect(cx - w, cy - r, w * 2, r * 2);
        ctx.rect(cx - r, cy - w, r * 2, w * 2);
        break;
}
```

- [ ] **Step 5: Add SVG export support**

```js
collectSVG(world) {
    // Generate SVG circles/rects for each dot
    const s = world.state;
    let svg = '';
    // ... iterate grid and output <circle> or <rect> elements
    return svg;
}
```

- [ ] **Step 6: Update params and commit**

```bash
git add js/algorithms/data-art/dot-matrix.js js/state.js
git commit -m "feat: upgrade Dot Matrix — colors, shapes, 8 patterns, animation control, SVG export"
```

---

### Task 10: Upgrade Chladni — color control and SVG export

**Files:**
- Modify: `js/algorithms/physics/chladni.js`
- Modify: `js/state.js`

User specifically wants color control and SVG export.

- [ ] **Step 1: Add state defaults**

```js
chladni_palette: 0,    // 0=mono, 1=heat, 2=ocean, 3=neon
chladni_lineWidth: 0.06, // nodal line width (0.01-0.15)
chladni_invert: 0,     // swap nodal lines and anti-nodal regions
```

- [ ] **Step 2: Add color palettes to Chladni shader**

Same palette approach as Julia — add uniform and palette functions:

```glsl
uniform int u_palette;

vec3 chladniColor(float val, float dist, int pal) {
    if (pal == 1) { // Heat
        return vec3(1.0 - dist, 0.3 * (1.0 - dist), dist * 0.1);
    } else if (pal == 2) { // Ocean
        return vec3(dist * 0.2, 0.3 + dist * 0.4, 0.5 + dist * 0.5);
    } else if (pal == 3) { // Neon
        float t = 1.0 - dist;
        return vec3(t * 0.8, t * 1.2, t * 2.0);
    }
    return vec3(1.0 - dist); // mono
}
```

- [ ] **Step 3: Add SVG export via marching squares**

Implement `collectSVG()` that traces the nodal lines (where val ~= 0) using marching squares on a grid:

```js
collectSVG(world) {
    const s = world.state;
    const m = s.chladni_m, n = s.chladni_n;
    const res = 400; // grid resolution
    let paths = '';

    // Evaluate Chladni function on grid
    const grid = [];
    for (let j = 0; j <= res; j++) {
        grid[j] = [];
        for (let i = 0; i <= res; i++) {
            const x = i / res, y = j / res;
            grid[j][i] = Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y)
                       - Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y);
        }
    }

    // March squares to find zero crossings, output SVG path segments
    // ... (standard marching squares implementation)
    return paths;
}
```

- [ ] **Step 4: Update params and commit**

```bash
git add js/algorithms/physics/chladni.js js/state.js
git commit -m "feat: upgrade Chladni — color palettes, line width control, SVG export"
```

---

### Task 11: Fix Contour Map SVG export

**Files:**
- Modify: `js/algorithms/data-art/contour.js`

User reports SVG export doesn't work for contour map.

- [ ] **Step 1: Debug collectSVG in contour.js**

Read the current `collectSVG()` implementation. The issue is likely that the SVG path generation doesn't match the render output, or it returns null/empty.

- [ ] **Step 2: Fix or rewrite collectSVG**

Ensure the marching-squares contour lines are captured as SVG `<path>` elements with proper coordinate mapping.

- [ ] **Step 3: Commit**

```bash
git add js/algorithms/data-art/contour.js
git commit -m "fix: contour map SVG export"
```

---

### Task 12: Upgrade Interference — interactive source placement

**Files:**
- Modify: `js/algorithms/physics/interference.js`
- Modify: `js/state.js`

- [ ] **Step 1: Add state defaults**

```js
intf_layout: 0,        // 0=golden angle, 1=line, 2=circle, 3=random
intf_amplitude: 1.0,   // wave amplitude (0.1-3.0)
intf_decay: 0,         // distance decay (0=none, adds 1/r falloff)
intf_palette: 0,       // 0=mono, 1=rainbow phase, 2=heat
```

- [ ] **Step 2: Add source layout options to shader**

```glsl
// Layout 0: golden angle (current)
// Layout 1: line — sources evenly spaced along horizontal
// Layout 2: circle — sources on a ring
// Layout 3: random — seeded pseudo-random positions

vec2 getSourcePos(int i, int layout, int count, float time) {
    if (layout == 1) {
        float t = float(i) / float(count - 1);
        return vec2(0.1 + t * 0.8, 0.5 + sin(time + t * 6.28) * 0.1);
    } else if (layout == 2) {
        float angle = float(i) / float(count) * 6.2832 + time * 0.2;
        return vec2(0.5 + cos(angle) * 0.3, 0.5 + sin(angle) * 0.3);
    }
    // ... golden angle default
}
```

- [ ] **Step 3: Add amplitude and decay**

```glsl
float wave = amplitude * sin(dist / wavelength * 6.2832 - time * speed);
if (decay > 0.0) wave *= 1.0 / (1.0 + dist * decay * 20.0);
```

- [ ] **Step 4: Update params and commit**

```bash
git add js/algorithms/physics/interference.js js/state.js
git commit -m "feat: upgrade Interference — source layouts, amplitude, decay, palettes"
```

---

### Task 13: Upgrade Moire — more editable patterns

**Files:**
- Modify: `js/algorithms/physics/moire.js`
- Modify: `js/state.js`

- [ ] **Step 1: Add state defaults**

```js
moire_rotSpeed: 0.7,    // rotation speed multiplier (0-3)
moire_scale: 1.0,       // pattern scale (0.5-3)
moire_contrast: 0.5,    // alpha/contrast (0.1-1.0)
moire_centerX: 0.5,     // center offset X (0-1)
moire_centerY: 0.5,     // center offset Y (0-1)
```

- [ ] **Step 2: Implement controls**

Wire scale, contrast, center offset into the pattern drawing functions. Make rotation speed controllable instead of hardcoded.

- [ ] **Step 3: Commit**

```bash
git add js/algorithms/physics/moire.js js/state.js
git commit -m "feat: upgrade Moire — rotation speed, scale, contrast, center offset controls"
```

---

### Task 14: Upgrade Penrose — modern look, color, no forced rotation

**Files:**
- Modify: `js/algorithms/data-art/penrose.js`
- Modify: `js/state.js`

- [ ] **Step 1: Add state defaults**

```js
pen_colorMode: 0,       // 0=mono, 1=type-based, 2=position gradient
pen_rotSpeed: 0.05,     // rotation speed (0=static)
pen_lineWidth: 0.5,     // stroke width (0.2-3)
pen_gapWidth: 1,        // gap between tiles (0-3)
```

- [ ] **Step 2: Implement color by tile type**

```js
if (colorMode === 1) {
    // Thick tiles = warm, thin tiles = cool
    ctx.fillStyle = tri.type === 'THICK'
        ? `hsla(35, 50%, 50%, 0.4)`
        : `hsla(210, 50%, 50%, 0.25)`;
} else if (colorMode === 2) {
    // Position-based gradient
    const hue = (tri.center.x / W * 180 + tri.center.y / H * 180) % 360;
    ctx.fillStyle = `hsla(${hue}, 40%, 45%, 0.35)`;
}
```

- [ ] **Step 3: Make rotation optional**

Replace `angle = time * 0.05` with `angle = time * s.pen_rotSpeed` so user can set it to 0 for static.

- [ ] **Step 4: Commit**

```bash
git add js/algorithms/data-art/penrose.js js/state.js
git commit -m "feat: upgrade Penrose — color modes, adjustable rotation, line/gap width"
```

---

### Task 15: Upgrade Clifford Attractor — trajectories, color, circle points

**Files:**
- Modify: `js/algorithms/nature/attractor.js`
- Modify: `js/state.js`

- [ ] **Step 1: Add state defaults**

```js
att_colorMode: 0,       // 0=mono, 1=velocity, 2=position, 3=iteration
att_pointShape: 0,      // 0=square (current), 1=circle, 2=pixel
att_trail: 0,           // 0=off, 1=show trajectory lines
```

- [ ] **Step 2: Replace square rendering with circle option**

```js
if (pointShape === 1) {
    ctx.beginPath();
    ctx.arc(px, py, 0.8, 0, Math.PI * 2);
    ctx.fill();
} else if (pointShape === 2) {
    ctx.fillRect(px, py, 1, 1); // single pixel
} else {
    ctx.fillRect(px - 0.5, py - 0.5, 1.2, 1.2); // current
}
```

- [ ] **Step 3: Add velocity coloring**

Track velocity between consecutive iterations and map to hue:

```js
const vel = Math.sqrt((nx-x)**2 + (ny-y)**2);
const hue = Math.min(vel * 100, 240); // slow=blue, fast=red
ctx.fillStyle = `hsla(${hue}, 70%, 55%, ${alpha})`;
```

- [ ] **Step 4: Commit**

```bash
git add js/algorithms/nature/attractor.js js/state.js
git commit -m "feat: upgrade Clifford Attractor — color modes, point shapes, velocity visualization"
```

---

### Task 16: Polish remaining algorithms (Harmonograph, Lissajous, Spiral, Flow Field, ASCII)

**Files:**
- Modify: `js/algorithms/physics/harmonograph.js`
- Modify: `js/algorithms/physics/lissajous.js`
- Modify: `js/algorithms/physics/spiral.js`
- Modify: `js/algorithms/nature/flow-field.js`
- Modify: `js/algorithms/data-art/ascii-render.js`
- Modify: `js/state.js`

These need lighter-touch improvements.

- [ ] **Step 1: Harmonograph — add pendulum count and color**

Add `harm_pendulums` (2-4 compound pendulums) and `harm_colorGrad` (gradient along path).

- [ ] **Step 2: Lissajous — add amplitude per axis**

Add `liss_ampX` and `liss_ampY` (0.1-1.0) for asymmetric figures.

- [ ] **Step 3: Spiral — add multi-arm and direction**

Add `spiral_arms` (1-8 simultaneous spirals) and `spiral_inward` toggle.

- [ ] **Step 4: Flow Field — add color by direction and particle size**

Add `flow_colorMode` (0=mono, 1=direction hue) and `flow_particleSize` (0.5-3).

- [ ] **Step 5: ASCII — improve character density and add color option**

Add `ascii_colorMode` (0=mono, 1=green terminal, 2=amber, 3=rainbow).

- [ ] **Step 6: Commit all**

```bash
git add js/algorithms/physics/*.js js/algorithms/nature/flow-field.js js/algorithms/data-art/ascii-render.js js/state.js
git commit -m "feat: polish harmonograph, lissajous, spiral, flow field, ascii — more controls and color"
```

---

### Task 17: Final cleanup and push

- [ ] **Step 1: Update algorithm categories in algo-grid metadata**

Ensure each remaining algorithm has the right category for the grid:
- **Fractals:** Julia Set, L-System, Koch, Dragon Curve
- **Nature:** Phyllotaxis, Flow Field, Clifford Attractor, Attractor Zoo, Magnetic Field
- **Physics:** Harmonograph, Lissajous, Golden Spiral, Chladni, Interference, Moire
- **Generative:** Contour Map, Spirograph, Pixel Organic, Dot Matrix, Penrose, ASCII Art

- [ ] **Step 2: Update CLAUDE.md to reflect new algorithm list**

Remove references to deleted algorithms, update the algorithm listing.

- [ ] **Step 3: Test all algorithms load and render**

Open the app, click through every algorithm, verify:
- No console errors
- All parameters work
- All new controls are visible in the panel
- SVG export works for Chladni and Contour
- Collapsible sections work

- [ ] **Step 4: Push to main for deployment**

```bash
git push origin main
```

Expected: Auto-deploys to code-art-taupe.vercel.app
