/**
 * Multi-Layer Compositing System
 *
 * Manages a stack of layers, each with its own algorithm, opacity, blend mode,
 * and optional image processing. Layers render bottom-to-top.
 */

import { state, set, markDirty } from './state.js';

/**
 * @typedef {Object} Layer
 * @property {number} id
 * @property {string} algo - algorithm id or '__image__' for image-only layer
 * @property {boolean} visible
 * @property {number} opacity
 * @property {string} blend - CanvasRenderingContext2D globalCompositeOperation value
 * @property {boolean} useImageProcessor - whether image processor output is drawn on this layer
 */

let nextId = 1;

/** Initialize the default layer from current state */
export function initLayers() {
  if (!state.layers || state.layers.length === 0) {
    state.layers = [
      { id: 0, algo: state.algo || 'lsystem', visible: true, opacity: 1, blend: 'source-over', useImageProcessor: false },
    ];
    state.activeLayer = 0;
    nextId = 1;
  }
}

/** Get all layers */
export function getLayers() {
  return state.layers;
}

/** Get the active layer */
export function getActiveLayer() {
  return state.layers.find(l => l.id === state.activeLayer) || state.layers[0];
}

/** Set a layer as active */
export function setActiveLayer(id) {
  state.activeLayer = id;
  markDirty();
}

/** Add a new layer (max 3) */
export function addLayer(algo = 'lsystem') {
  if (state.layers.length >= 3) return null;
  const layer = {
    id: nextId++,
    algo,
    visible: true,
    opacity: 0.8,
    blend: 'source-over',
    useImageProcessor: false,
  };
  state.layers.push(layer);
  state.activeLayer = layer.id;
  markDirty();
  return layer;
}

/** Remove a layer by id (always keep at least 1) */
export function removeLayer(id) {
  if (state.layers.length <= 1) return false;
  const idx = state.layers.findIndex(l => l.id === id);
  if (idx === -1) return false;
  state.layers.splice(idx, 1);
  // If we removed the active layer, select the first
  if (state.activeLayer === id) {
    state.activeLayer = state.layers[0].id;
  }
  markDirty();
  return true;
}

/** Update a property on a layer */
export function updateLayer(id, key, value) {
  const layer = state.layers.find(l => l.id === id);
  if (!layer) return;
  layer[key] = value;
  // If the algo changed on active layer, sync to state.algo
  if (key === 'algo' && id === state.activeLayer) {
    state.algo = value;
  }
  markDirty();
}

/** Move layer up/down */
export function moveLayer(id, direction) {
  const idx = state.layers.findIndex(l => l.id === id);
  if (idx === -1) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= state.layers.length) return;
  [state.layers[idx], state.layers[newIdx]] = [state.layers[newIdx], state.layers[idx]];
  markDirty();
}
