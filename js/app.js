/**
 * app.js — Entry point.
 * Wires engine, UI panels, algorithm registry, layers, image processor, camera, and the render loop.
 */
window.__codeArtDebug = true;
window.onerror = (msg, src, line, col) => {
  const el = document.getElementById('loading');
  if (el) el.textContent = `ERROR: ${msg} at ${src}:${line}`;
};

import { state, set, markDirty, isDirty, markClean } from './state.js';
import { engine } from './engine.js';
import { registry } from './algorithms/registry.js';
import { buildAlgoGrid } from './ui/algo-grid.js';
import { buildParams } from './ui/params.js';
import { initMouse, mouse } from './interaction/mouse.js';
import { loadImage, removeImage } from './interaction/image-layer.js';
import { imageProcessor } from './interaction/image-processor.js';
import { toggleCamera, isCameraActive } from './interaction/camera.js';
import { initLayers, getLayers, getActiveLayer, setActiveLayer, addLayer, removeLayer, updateLayer } from './layers.js';
import { exportPNG } from './export/png.js';
import { exportSVG } from './export/svg.js';
import { startRecording, stopRecording, isRecording } from './export/video.js';
import { initKeyboard } from './interaction/keyboard.js';
import { createSlider } from './ui/panel.js';

// ── Initialise engine ──────────────────────────────────────────────────────────

engine.resize();
window.addEventListener('resize', () => {
  engine.resize();
  markDirty();
});

// ── Initialise layers ────────────────────────────────────────────────────────

initLayers();

// ── Active algorithm ───────────────────────────────────────────────────────────

let activeAlgo = null;
let algoGridCtrl = null;

function selectAlgorithm(id) {
  const algo = registry.get(id, engine);
  if (!algo) return;

  activeAlgo = algo;
  engine.setAlgorithm(algo);
  set('algo', id);

  // Update active layer's algo
  const activeLayer = getActiveLayer();
  if (activeLayer) {
    activeLayer.algo = id;
    engine.setLayerAlgorithm(activeLayer.id, algo);
  }

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
  rebuildLayerUI();
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

// ── Image Processor controls ─────────────────────────────────────────────────

const ipControls = document.getElementById('ip-controls');
const ipEffectGrid = document.getElementById('ip-effect-grid');
const ipParamControls = document.getElementById('ip-param-controls');

// Upload image for processing
document.getElementById('btn-ip-upload')?.addEventListener('click', () => {
  document.getElementById('ip-file-input')?.click();
});

document.getElementById('ip-file-input')?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  imageProcessor.loadImage(file).then(() => {
    set('ip_enabled', true);
    if (ipControls) ipControls.style.display = '';
    const toggle = document.getElementById('ip-enabled-toggle');
    if (toggle) toggle.classList.add('on');
    markDirty();
  });
});

// Camera toggle
document.getElementById('btn-ip-camera')?.addEventListener('click', async () => {
  const result = await toggleCamera();
  const btn = document.getElementById('btn-ip-camera');
  if (isCameraActive()) {
    if (btn) { btn.classList.add('active'); btn.textContent = 'Stop Cam'; }
    set('ip_enabled', true);
    if (ipControls) ipControls.style.display = '';
    const toggle = document.getElementById('ip-enabled-toggle');
    if (toggle) toggle.classList.add('on');
  } else {
    if (btn) { btn.classList.remove('active'); btn.textContent = 'Camera'; }
  }
  markDirty();
});

// Enable/disable processing toggle
document.getElementById('ip-enabled-toggle')?.addEventListener('click', () => {
  const newVal = !state.ip_enabled;
  set('ip_enabled', newVal);
  document.getElementById('ip-enabled-toggle')?.classList.toggle('on', newVal);
});

// Mix with algorithm toggle
document.getElementById('ip-mix-toggle')?.addEventListener('click', () => {
  const newVal = !state.ip_mixWithAlgo;
  set('ip_mixWithAlgo', newVal);
  document.getElementById('ip-mix-toggle')?.classList.toggle('on', newVal);
});

// Remove source
document.getElementById('btn-ip-remove')?.addEventListener('click', () => {
  imageProcessor.clear();
  set('ip_enabled', false);
  if (ipControls) ipControls.style.display = 'none';
  markDirty();
});

// Build distortion effect grid
if (ipEffectGrid) {
  const distortions = imageProcessor.constructor.getDistortions();
  const btnMap = new Map();

  for (const [key, dist] of Object.entries(distortions)) {
    const btn = document.createElement('button');
    btn.className = 'distortion-btn';
    btn.textContent = dist.name;
    if (key === (state.ip_effect || 'displacement')) btn.classList.add('active');

    btn.addEventListener('click', () => {
      btnMap.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      set('ip_effect', key);
      buildIPParams(key);
    });

    btnMap.set(key, btn);
    ipEffectGrid.appendChild(btn);
  }
}

// Build distortion-specific params
function buildIPParams(effectKey) {
  if (!ipParamControls) return;
  ipParamControls.innerHTML = '';
  const distortions = imageProcessor.constructor.getDistortions();
  const dist = distortions[effectKey];
  if (!dist || !dist.params) return;

  for (const p of dist.params) {
    const decimals = p.step < 1 ? (String(p.step).split('.')[1]?.length || 1) : 0;
    const fmt = decimals > 0 ? v => v.toFixed(decimals) : null;
    createSlider(ipParamControls, p.label, p.id, p.min, p.max, p.step, fmt);
  }
}

// Build initial params
buildIPParams(state.ip_effect || 'displacement');

// ── Layer UI ─────────────────────────────────────────────────────────────────

const BLEND_MODES = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'difference', label: 'Diff' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'lighter', label: 'Add' },
];

function rebuildLayerUI() {
  const container = document.getElementById('layer-list');
  if (!container) return;
  container.innerHTML = '';

  const layers = getLayers();

  for (const layer of layers) {
    const item = document.createElement('div');
    item.className = 'layer-item' + (layer.id === state.activeLayer ? ' active' : '');

    // Visibility toggle
    const vis = document.createElement('div');
    vis.className = 'layer-vis' + (layer.visible ? ' on' : '');
    vis.textContent = layer.visible ? 'V' : '';
    vis.title = 'Toggle visibility';
    vis.addEventListener('click', e => {
      e.stopPropagation();
      updateLayer(layer.id, 'visible', !layer.visible);
      rebuildLayerUI();
    });

    // Name
    const name = document.createElement('span');
    name.className = 'layer-name';
    const algoMeta = registry.has(layer.algo) ? registry.get(layer.algo, engine)?.metadata : null;
    name.textContent = algoMeta?.name || layer.algo;

    // Opacity slider
    const opacity = document.createElement('input');
    opacity.type = 'range';
    opacity.className = 'layer-opacity';
    opacity.min = '0';
    opacity.max = '1';
    opacity.step = '0.05';
    opacity.value = String(layer.opacity);
    opacity.addEventListener('input', e => {
      e.stopPropagation();
      updateLayer(layer.id, 'opacity', parseFloat(opacity.value));
    });

    // Blend mode select
    const blend = document.createElement('select');
    blend.className = 'layer-blend';
    for (const m of BLEND_MODES) {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.label;
      if (layer.blend === m.value) opt.selected = true;
      blend.appendChild(opt);
    }
    blend.addEventListener('change', e => {
      e.stopPropagation();
      updateLayer(layer.id, 'blend', blend.value);
    });

    // Delete button
    const del = document.createElement('button');
    del.className = 'layer-del';
    del.textContent = 'x';
    del.title = 'Delete layer';
    del.addEventListener('click', e => {
      e.stopPropagation();
      removeLayer(layer.id);
      // Set engine algorithm from new active layer
      const newActive = getActiveLayer();
      if (newActive) {
        const algo = registry.get(newActive.algo, engine);
        if (algo) {
          activeAlgo = algo;
          engine.setAlgorithm(algo);
        }
      }
      rebuildLayerUI();
    });

    // Click to make active
    item.addEventListener('click', () => {
      setActiveLayer(layer.id);
      // Switch to this layer's algorithm
      if (layer.algo && registry.has(layer.algo)) {
        selectAlgorithm(layer.algo);
      }
      rebuildLayerUI();
    });

    item.appendChild(vis);
    item.appendChild(name);
    item.appendChild(opacity);
    item.appendChild(blend);
    if (layers.length > 1) item.appendChild(del);

    container.appendChild(item);
  }
}

// Add Layer button
document.getElementById('btn-add-layer')?.addEventListener('click', () => {
  const layers = getLayers();
  if (layers.length >= 3) return;
  const layer = addLayer(state.algo || 'lsystem');
  if (layer) {
    // Set the algorithm for the new layer
    const algo = registry.get(layer.algo, engine);
    if (algo) engine.setLayerAlgorithm(layer.id, algo);
    rebuildLayerUI();
  }
});

// Initial layer UI build
rebuildLayerUI();

// Ensure first layer has its algo set on engine
{
  const firstLayer = getActiveLayer();
  if (firstLayer) {
    const algo = registry.get(firstLayer.algo, engine);
    if (algo) engine.setLayerAlgorithm(firstLayer.id, algo);
  }
}

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

  const layers = getLayers();
  const layerInfo = layers.length > 1 ? ` | layers: ${layers.length}` : '';

  document.getElementById('hud-mode').textContent =
    `scroll: ${state.scrollMode}${layerInfo}`;
  document.getElementById('hud-zoom').textContent =
    `zoom: ${(state.camZoom || 1).toFixed(2)}x`;
  document.getElementById('hud-help').textContent =
    'scroll: adjust  drag: pan  dbl-click: reset  |  space=play r=random s=symmetry d=scroll mode';
}

// ── Mouse interaction is handled by js/interaction/mouse.js ──────────────────
// initMouse() is called above after selectAlgorithm().

// ── Render loop ───────────────────────────────────────────────────────────────

function tick() {
  if (state.playing) {
    state.time += 0.016 * state.speed;
    if (activeAlgo) activeAlgo.animate(state);

    // Animate all layer algorithms
    const layers = getLayers();
    if (layers.length > 1) {
      for (const layer of layers) {
        if (!layer.visible) continue;
        const algo = engine.getLayerAlgorithm(layer.id);
        if (algo && algo !== activeAlgo) algo.animate(state);
      }
    }

    markDirty();
  }

  // Camera: continuously mark dirty for live feed
  if (state.cameraActive && state.ip_enabled) {
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
