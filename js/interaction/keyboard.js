/**
 * keyboard.js — Global keyboard shortcuts for Code Art Studio.
 *
 * Shortcuts only fire when no text input/textarea/select is focused.
 *
 *   Space  — play / pause
 *   R      — randomize current algorithm params
 *   D      — toggle scroll mode (detail ↔ zoom)
 *   C      — toggle cursor animation
 *   S      — toggle symmetry
 *   T      — toggle transparent background
 *   0      — reset view (camZoom=1, camPanX=0, camPanY=0)
 *   Escape — stop recording if recording
 */

import { state, set, markDirty } from '../state.js';
import { isRecording, stopRecording } from '../export/video.js';

/** Returns true when a text-like element has focus (suppress shortcuts). */
function isTyping() {
  const tag = document.activeElement?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

/**
 * Initialise keyboard shortcuts.
 *
 * @param {object} deps
 * @param {function} deps.getActiveAlgo  — returns current algorithm instance
 * @param {function} deps.rebuildParams  — (algo, state) => void, refreshes param panel
 * @param {function} deps.updatePlayUI   — syncs play/pause button text
 */
export function initKeyboard({ getActiveAlgo, rebuildParams, updatePlayUI }) {
  document.addEventListener('keydown', e => {
    if (isTyping()) return;

    const key = e.key;

    switch (key) {
      case ' ': {
        e.preventDefault();
        set('playing', !state.playing);
        updatePlayUI();
        break;
      }

      case 'r':
      case 'R': {
        const algo = getActiveAlgo();
        if (algo && typeof algo.randomize === 'function') {
          algo.randomize(state, set);
          const paramsContainer = document.getElementById('param-controls');
          if (paramsContainer) rebuildParams(algo, state);
        }
        break;
      }

      case 'd':
      case 'D': {
        const next = state.scrollMode === 'detail' ? 'zoom' : 'detail';
        set('scrollMode', next);
        // Update button active states
        document.getElementById('btn-scroll-detail')?.classList.toggle('active', next === 'detail');
        document.getElementById('btn-scroll-zoom')?.classList.toggle('active', next === 'zoom');
        markDirty();
        break;
      }

      case 'c':
      case 'C': {
        const newCursor = !state.cursorMode;
        set('cursorMode', newCursor);
        const cursorToggle = document.getElementById('cursor-toggle');
        if (cursorToggle) cursorToggle.classList.toggle('on', newCursor);
        markDirty();
        break;
      }

      case 's':
      case 'S': {
        const newSym = !state.sym;
        set('sym', newSym);
        const symToggle = document.getElementById('sym-toggle');
        if (symToggle) symToggle.classList.toggle('on', newSym);
        markDirty();
        break;
      }

      case 't':
      case 'T': {
        const newTransparent = !state.transparent;
        set('transparent', newTransparent);
        const tToggle = document.getElementById('transparent-toggle');
        if (tToggle) tToggle.classList.toggle('on', newTransparent);
        const cb = document.getElementById('checkerboard');
        if (cb) cb.classList.toggle('visible', newTransparent);
        markDirty();
        break;
      }

      case '0': {
        set('camZoom', 1);
        set('camPanX', 0);
        set('camPanY', 0);
        markDirty();
        break;
      }

      case 'Escape': {
        if (isRecording()) {
          stopRecording();
        }
        break;
      }
    }
  });
}
