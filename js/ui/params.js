/**
 * Params panel — dynamically builds parameter sliders for the active algorithm.
 */

import { state } from '../state.js';
import { createSlider } from './panel.js';

/**
 * Clears and rebuilds the params container for the given algorithm.
 * @param {HTMLElement} container  - #param-controls
 * @param {object} algorithm       - Algorithm instance (has .params and .metadata)
 * @param {object} s               - state reference
 */
export function buildParams(container, algorithm, s) {
  container.innerHTML = '';

  if (!algorithm) {
    const empty = document.createElement('div');
    empty.className = 'desc';
    empty.textContent = 'No algorithm selected.';
    container.appendChild(empty);
    return;
  }

  const params = algorithm.params;

  params.forEach(p => {
    // Choose a formatter based on step size
    let fmt = null;
    if (p.step < 1) {
      const decimals = String(p.step).split('.')[1]?.length || 1;
      fmt = v => v.toFixed(decimals);
    }
    createSlider(container, p.label, p.id, p.min, p.max, p.step, fmt);
  });

  // Description
  const meta = algorithm.metadata;
  if (meta && meta.desc) {
    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = meta.desc;
    container.appendChild(desc);
  }
}

/** Alias — clears and rebuilds */
export function rebuildParams(container, algorithm, s) {
  buildParams(container, algorithm, s);
}
