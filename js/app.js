/**
 * app.js — Entry point.
 * Wires engine, UI panels, algorithm registry, and the render loop.
 */

import { state, set, markDirty, isDirty, markClean } from './state.js';
import { engine } from './engine.js';
import { registry } from './algorithms/registry.js';
import { buildAlgoGrid } from './ui/algo-grid.js';
import { buildParams } from './ui/params.js';
import { initMouse, mouse } from './interaction/mouse.js';
import { loadImage, removeImage } from './interaction/image-layer.js';
import { exportPNG } from './export/png.js';
import { exportSVG } from './export/svg.js';
import { startRecording, stopRecording, isRecording } from './export/video.js';
import { initKeyboard } from './interaction/keyboard.js';

// ── Initialise engine ──────────────────────────────────────────────────────────

engine.resize();
window.addEventListener('resize', () => {
  engine.resize();
  markDirty();
});

// ── Active algorithm ───────────────────────────────────────────────────────────

let activeAlgo = null;
let algoGridCtrl = null;

function selectAlgorithm(id) {
  const algo = registry.get(id, engine);
  if (!algo) return;

  activeAlgo = algo;
  engine.setAlgorithm(algo);
  set('algo', id);

  // Reset view
  set('camZoom', 1);
  set('camPanX', 0);
  set('camPanY', 0);

  // Rebuild params panel
  const paramsContainer = document.getElementById('param-controls');
  if (paramsContainer) buildParams(paramsContainer, algo, state);

  // Update algo grid active state
  if (algoGridCtrl) algoGridCtrl.setActive(id);

  // Update HUD
  updateHUD();
  markDirty();
}

// ── Build algorithm grid ───────────────────────────────────────────────────────

const algoGridEl = document.getElementById('algo-grid');
if (algoGridEl) {
  algoGridCtrl = buildAlgoGrid(algoGridEl, registry, selectAlgorithm);
}

// ── Boot with default algorithm ────────────────────────────────────────────────

selectAlgorithm(state.algo || 'lsystem');

// Remove loading early so the app is interactive even if later init fails
document.getElementById('loading')?.remove();

// ── Mouse interaction ─────────────────────────────────────────────────────────

initMouse(
  document.getElementById('canvas-area'),
  engine,
  registry,
  () => activeAlgo,
  (algo, s) => {
    const paramsContainer = document.getElementById('param-controls');
    if (paramsContainer) buildParams(paramsContainer, algo, s);
  }
);

// ── Wire Style controls ────────────────────────────────────────────────────────

// ── Background color ──
function wireColorRow(pickerId, presetSelector, dataAttr, stateKey) {
  const picker = document.getElementById(pickerId);
  if (picker) {
    picker.addEventListener('input', () => {
      set(stateKey, picker.value);
      // Deactivate preset swatches
      document.querySelectorAll(presetSelector + ' .swatch').forEach(s => s.classList.remove('active'));
    });
  }
  document.querySelectorAll(presetSelector + ' .swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      const val = sw.dataset[dataAttr];
      set(stateKey, val);
      if (picker) picker.value = val.startsWith('#') ? val : '#000000';
      document.querySelectorAll(presetSelector + ' .swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });
  });
}

wireColorRow('bg-color-picker', '#bg-presets', 'bg', 'bgColor');
wireColorRow('fg-color-picker', '#fg-presets', 'fg', 'fgColor');

// Glow color
const glowPicker = document.getElementById('glow-color-picker');
if (glowPicker) {
  glowPicker.addEventListener('input', () => {
    set('glowColor', glowPicker.value);
    document.querySelectorAll('#glow-presets .swatch').forEach(s => s.classList.remove('active'));
  });
}
document.querySelectorAll('#glow-presets .swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    const val = sw.dataset.glow;
    set('glowColor', val);
    if (val !== 'same' && glowPicker) glowPicker.value = val;
    document.querySelectorAll('#glow-presets .swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
  });
});

// Glow slider
_wireExistingSlider('sl-glow', 'val-glow', 'glow', v => String(v));
// Blur slider
_wireExistingSlider('sl-blur', 'val-blur', 'blur', v => String(v));
// Grain slider
_wireExistingSlider('sl-grain', 'val-grain', 'grain', v => v.toFixed(2));
// Line weight slider
_wireExistingSlider('sl-lineWeight', 'val-lineWeight', 'lineWeight', v => v.toFixed(1));

// Transparent toggle (existing in HTML)
_wireExistingToggle('transparent-toggle', 'transparent', val => {
  const cb = document.getElementById('checkerboard');
  if (cb) cb.classList.toggle('visible', val);
});

// Symmetry toggle + folds slider
_wireExistingToggle('sym-toggle', 'sym');
_wireExistingSlider('sl-folds', 'val-folds', 'folds', v => String(Math.round(v)));

// ── Interaction controls ───────────────────────────────────────────────────────

// Scroll mode buttons
document.getElementById('btn-scroll-detail')?.addEventListener('click', () => {
  set('scrollMode', 'detail');
  document.getElementById('btn-scroll-detail')?.classList.add('active');
  document.getElementById('btn-scroll-zoom')?.classList.remove('active');
});

document.getElementById('btn-scroll-zoom')?.addEventListener('click', () => {
  set('scrollMode', 'zoom');
  document.getElementById('btn-scroll-zoom')?.classList.add('active');
  document.getElementById('btn-scroll-detail')?.classList.remove('active');
});

// Cursor animation toggle
_wireExistingToggle('cursor-toggle', 'cursorMode');

// ── Image layer controls ──────────────────────────────────────────────────────

document.getElementById('btn-import-image')?.addEventListener('click', () => {
  document.getElementById('file-input')?.click();
});

document.getElementById('file-input')?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  loadImage(file).then(() => {
    document.getElementById('image-controls').style.display = '';
    markDirty();
  });
});

document.getElementById('btn-remove-image')?.addEventListener('click', () => {
  removeImage();
  document.getElementById('image-controls').style.display = 'none';
  markDirty();
});

// Image layer position
document.getElementById('btn-img-behind')?.addEventListener('click', () => {
  set('img_layer', 'behind');
  document.getElementById('btn-img-behind')?.classList.add('active');
  document.getElementById('btn-img-front')?.classList.remove('active');
});
document.getElementById('btn-img-front')?.addEventListener('click', () => {
  set('img_layer', 'front');
  document.getElementById('btn-img-front')?.classList.add('active');
  document.getElementById('btn-img-behind')?.classList.remove('active');
});

// Image opacity / scale
_wireExistingSlider('sl-img-opacity', 'val-img-opacity', 'img_opacity', v => v.toFixed(2));
_wireExistingSlider('sl-img-scale',   'val-img-scale',   'img_scale',   v => v.toFixed(2));

// Blend mode
document.querySelectorAll('#blend-btns .btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#blend-btns .btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    set('img_blend', btn.dataset.blend);
  });
});

// ── Action buttons ─────────────────────────────────────────────────────────────

const playPauseBtn = document.getElementById('btn-play-pause');
const playStatus   = document.getElementById('play-status');

function updatePlayUI() {
  if (state.playing) {
    playPauseBtn.textContent = 'Pause';
    playStatus.textContent = 'PLAYING';
    playStatus.className = 'status-playing';
  } else {
    playPauseBtn.textContent = 'Play';
    playStatus.textContent = 'PAUSED';
    playStatus.className = 'status-paused';
  }
}

playPauseBtn?.addEventListener('click', () => {
  set('playing', !state.playing);
  updatePlayUI();
});

document.getElementById('btn-randomize')?.addEventListener('click', () => {
  if (activeAlgo && typeof activeAlgo.randomize === 'function') {
    activeAlgo.randomize(state, set);
    // Rebuild params to reflect new values
    const paramsContainer = document.getElementById('param-controls');
    if (paramsContainer) buildParams(paramsContainer, activeAlgo, state);
  }
});

document.getElementById('btn-reset-view')?.addEventListener('click', () => {
  set('camZoom', 1);
  set('camPanX', 0);
  set('camPanY', 0);
});

document.getElementById('btn-export-png')?.addEventListener('click', () => {
  exportPNG(engine, state);
});

document.getElementById('btn-export-svg')?.addEventListener('click', () => {
  const didSVG = exportSVG(engine, state, activeAlgo);
  if (!didSVG) {
    exportPNG(engine, state);
  }
});

const recordBtn = document.getElementById('btn-record');
recordBtn?.addEventListener('click', () => {
  if (isRecording()) {
    stopRecording();
  } else {
    startRecording(
      engine.canvas,
      state.rec_duration,
      state,
      () => {
        // onStart
        if (recordBtn) {
          recordBtn.textContent = 'Stop';
          recordBtn.classList.add('active');
        }
        updatePlayUI();
      },
      () => {
        // onStop
        if (recordBtn) {
          recordBtn.textContent = 'Record';
          recordBtn.classList.remove('active');
        }
      }
    );
  }
});

// Record duration slider
_wireExistingSlider('sl-rec-duration', 'val-rec-duration', 'rec_duration', v => `${Math.round(v)}s`);

// ── HUD ───────────────────────────────────────────────────────────────────────

function updateHUD() {
  const meta = activeAlgo?.metadata;
  document.getElementById('hud-algo').textContent     = meta?.name || '';
  document.getElementById('hud-equation').textContent = meta?.eq   || '';
  document.getElementById('hud-mode').textContent =
    `scroll: ${state.scrollMode}`;
  document.getElementById('hud-zoom').textContent =
    `zoom: ${(state.camZoom || 1).toFixed(2)}x`;
  document.getElementById('hud-help').textContent =
    'scroll: adjust  drag: pan  dbl-click: reset  |  space=play · r=random · s=symmetry · d=scroll mode';
}

// ── Mouse interaction is handled by js/interaction/mouse.js ──────────────────
// initMouse() is called above after selectAlgorithm().

// ── Render loop ───────────────────────────────────────────────────────────────

function tick() {
  if (state.playing) {
    state.time += 0.016 * state.speed;
    if (activeAlgo) activeAlgo.animate(state);
    markDirty();
  }

  // Cursor mode: map current mouse position to algorithm params
  if (state.cursorMode && activeAlgo?.cursorMap) {
    activeAlgo.cursorMap(mouse.x, mouse.y, state);
    markDirty();
  }

  if (isDirty()) {
    engine.render(state);
    markClean();
    updateHUD();
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

initKeyboard({
  getActiveAlgo: () => activeAlgo,
  rebuildParams: (algo, s) => {
    const paramsContainer = document.getElementById('param-controls');
    if (paramsContainer) buildParams(paramsContainer, algo, s);
  },
  updatePlayUI,
});

// ── Remove loading indicator ──────────────────────────────────────────────────

try { document.getElementById('loading')?.remove(); } catch(e) { console.error(e); }

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wire an existing HTML range input to state. */
function _wireExistingSlider(inputId, valId, stateKey, fmt) {
  const input = document.getElementById(inputId);
  const valEl = document.getElementById(valId);
  if (!input) return;
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    set(stateKey, v);
    if (valEl) valEl.textContent = fmt ? fmt(v) : String(v);
    markDirty();
  });
}

/** Wire an existing HTML toggle div to state. */
function _wireExistingToggle(toggleId, stateKey, onToggle = null) {
  const el = document.getElementById(toggleId);
  if (!el) return;
  el.addEventListener('click', () => {
    const newVal = !state[stateKey];
    set(stateKey, newVal);
    el.classList.toggle('on', newVal);
    markDirty();
    if (onToggle) onToggle(newVal);
  });
}
