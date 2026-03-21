/**
 * UI Panel — factory functions for creating bound control elements.
 * All controls update state and mark dirty on change.
 */

import { state, set, markDirty } from '../state.js';

/**
 * Creates a slider row: label, value display, and range input.
 * @param {HTMLElement} container
 * @param {string} label
 * @param {string} stateKey
 * @param {number} min
 * @param {number} max
 * @param {number} step
 * @param {Function|null} format  - optional display formatter, e.g. v => v.toFixed(2)
 * @returns {HTMLElement} the slider-row div
 */
export function createSlider(container, label, stateKey, min, max, step, format = null) {
  const row = document.createElement('div');
  row.className = 'slider-row';

  const labelRow = document.createElement('div');
  labelRow.className = 'slider-label';

  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;

  const valSpan = document.createElement('span');
  valSpan.className = 'val';

  const currentVal = state[stateKey] !== undefined ? state[stateKey] : min;
  valSpan.textContent = format ? format(currentVal) : String(currentVal);

  labelRow.appendChild(labelSpan);
  labelRow.appendChild(valSpan);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(currentVal);

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    set(stateKey, v);
    valSpan.textContent = format ? format(v) : String(v);
    markDirty();
  });

  row.appendChild(labelRow);
  row.appendChild(input);

  if (container) container.appendChild(row);
  return row;
}

/**
 * Creates a toggle row.
 * @param {HTMLElement} container
 * @param {string} label
 * @param {string} stateKey
 * @param {Function|null} onToggle - optional callback(newValue)
 * @returns {HTMLElement} the toggle-row div
 */
export function createToggle(container, label, stateKey, onToggle = null) {
  const row = document.createElement('div');
  row.className = 'toggle-row';

  const lbl = document.createElement('label');
  lbl.textContent = label;

  const toggle = document.createElement('div');
  toggle.className = 'toggle';
  if (state[stateKey]) toggle.classList.add('on');

  toggle.addEventListener('click', () => {
    const newVal = !state[stateKey];
    set(stateKey, newVal);
    toggle.classList.toggle('on', newVal);
    markDirty();
    if (onToggle) onToggle(newVal);
  });

  row.appendChild(lbl);
  row.appendChild(toggle);

  if (container) container.appendChild(row);
  return row;
}

/**
 * Creates a single button.
 * @param {HTMLElement} container
 * @param {string} label
 * @param {Function} onClick
 * @param {string|null} cssClass - extra CSS class(es)
 * @returns {HTMLButtonElement}
 */
export function createButton(container, label, onClick, cssClass = null) {
  const btn = document.createElement('button');
  btn.className = 'btn' + (cssClass ? ' ' + cssClass : '');
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  if (container) container.appendChild(btn);
  return btn;
}

/**
 * Creates a button grid div containing multiple buttons.
 * @param {HTMLElement} container
 * @param {Array<{label, onClick, cssClass, id}>} buttons
 * @returns {HTMLElement} the btn-grid div
 */
export function createButtonGrid(container, buttons) {
  const grid = document.createElement('div');
  grid.className = 'btn-grid';

  buttons.forEach(({ label, onClick, cssClass, id }) => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (cssClass ? ' ' + cssClass : '');
    btn.textContent = label;
    if (id) btn.id = id;
    btn.addEventListener('click', onClick);
    grid.appendChild(btn);
  });

  if (container) container.appendChild(grid);
  return grid;
}

/**
 * Creates a row of color/value swatches.
 * @param {HTMLElement} container
 * @param {Array<{value, style, active}>} swatches
 * @param {Function} onSelect - called with the selected value
 * @returns {HTMLElement} the swatches div
 */
export function createSwatchRow(container, swatches, onSelect) {
  const wrap = document.createElement('div');
  wrap.className = 'swatches';

  const swatchEls = [];

  swatches.forEach(({ value, style, active }) => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    if (active) sw.classList.add('active');
    if (style) sw.setAttribute('style', style);
    sw.dataset.value = value;

    sw.addEventListener('click', () => {
      swatchEls.forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      onSelect(value);
      markDirty();
    });

    swatchEls.push(sw);
    wrap.appendChild(sw);
  });

  if (container) container.appendChild(wrap);
  return wrap;
}
