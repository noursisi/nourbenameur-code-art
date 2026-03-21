/**
 * Mouse interaction module.
 * Handles scroll (zoom / detail), drag (camera pan), cursor tracking,
 * double-click reset, and cursor-mode visibility.
 */

import { state, set, markDirty, onChange } from '../state.js';

/**
 * Exported mouse position (normalised 0–1 over canvas area).
 * Exposed as an object so callers always read the live value.
 */
export const mouse = { x: 0.5, y: 0.5 };

// Keep individual named exports for convenience (live via the 'mouse' object)
export function getMouseX() { return mouse.x; }
export function getMouseY() { return mouse.y; }

/**
 * Wire all mouse/wheel interactions onto the canvas area element.
 *
 * @param {HTMLElement} canvasArea   - The #canvas-area div
 * @param {object}      engine       - Engine instance (unused directly, kept for future)
 * @param {object}      registry     - Algorithm registry (unused directly)
 * @param {Function}    getActiveAlgo - () => current Algorithm instance
 * @param {Function}    rebuildParams - (algo, state) => rebuild params UI
 */
export function initMouse(canvasArea, engine, registry, getActiveAlgo, rebuildParams) {

  // ── Cursor position tracking ─────────────────────────────────────────────

  canvasArea.addEventListener('mousemove', e => {
    const rect = canvasArea.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width;
    mouse.y = (e.clientY - rect.top)  / rect.height;
    // Actual cursorMap call happens in the render loop (app.js tick)
  });

  // ── Drag (camera pan) ────────────────────────────────────────────────────

  let dragging  = false;
  let dragStartX = 0, dragStartY = 0;
  let panStartX  = 0, panStartY  = 0;

  canvasArea.addEventListener('mousedown', e => {
    if (state.cursorMode) return; // skip drag when cursor animation is active
    dragging   = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    panStartX  = state.camPanX;
    panStartY  = state.camPanY;
  });

  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    state.camPanX = panStartX + dx;
    state.camPanY = panStartY + dy;
    markDirty();
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });

  // ── Scroll (zoom or detail) ───────────────────────────────────────────────

  canvasArea.addEventListener('wheel', e => {
    e.preventDefault();

    if (state.scrollMode === 'zoom') {
      // Multiply zoom by 1.1 or 0.9 per scroll tick
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.1, Math.min(50, (state.camZoom || 1) * factor));
      set('camZoom', newZoom);
    } else {
      // Detail mode: increment/decrement the algorithm's detailParam
      const algo = getActiveAlgo();
      if (!algo?.detailParam) return;

      const p   = algo.detailParam;
      const dir = e.deltaY < 0 ? 1 : -1;
      const cur = state[p.id] ?? p.min;
      const next = Math.max(p.min, Math.min(p.max, cur + dir * p.step));
      const snapped = Math.round(next / p.step) * p.step;
      set(p.id, parseFloat(snapped.toFixed(6)));

      // Rebuild params panel to reflect new value
      if (rebuildParams) rebuildParams(algo, state);
    }
  }, { passive: false });

  // ── Double-click: reset camera ────────────────────────────────────────────

  canvasArea.addEventListener('dblclick', () => {
    set('camZoom', 1);
    set('camPanX', 0);
    set('camPanY', 0);
  });

  // ── Cursor mode: hide cursor over canvas area ─────────────────────────────

  // Watch state.cursorMode changes to toggle the cursor-hidden class
  onChange(() => {
    canvasArea.classList.toggle('cursor-hidden', !!state.cursorMode);
  });
}
