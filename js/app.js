import { state, isDirty, markClean, markDirty } from './state.js';

// ── Canvas setup ──────────────────────────────────────────────────────────────

const canvasArea = document.getElementById('canvas-area');
const canvas = document.getElementById('art');
const ctx = canvas.getContext('2d');

export { canvas, ctx };

// ── Resize ────────────────────────────────────────────────────────────────────

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvasArea.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(dpr, dpr);
  markDirty();
}

window.addEventListener('resize', resize);
resize();

// ── Render loop ───────────────────────────────────────────────────────────────

function tick() {
  if (isDirty()) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Clear to black (or transparent if that mode is active)
    if (state.transparent) {
      ctx.clearRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#020202';
      ctx.fillRect(0, 0, w, h);
    }

    markClean();
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
