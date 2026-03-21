/**
 * High-resolution PNG export — renders at 2x the current canvas size.
 */

export function exportPNG(engine, state) {
  const oldW = engine.W;
  const oldH = engine.H;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width  = oldW * 2;
  exportCanvas.height = oldH * 2;
  const exportCtx = exportCanvas.getContext('2d');

  // Temporarily swap engine context
  const origCtx    = engine.ctx;
  const origCanvas = engine.canvas;
  engine.canvas = exportCanvas;
  engine.ctx    = exportCtx;
  engine.W      = oldW * 2;
  engine.H      = oldH * 2;

  // Render at 2x
  engine.render(state);

  // Download
  const link = document.createElement('a');
  link.download = `code-art-${state.algo}-${Date.now()}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();

  // Restore
  engine.canvas = origCanvas;
  engine.ctx    = origCtx;
  engine.W      = oldW;
  engine.H      = oldH;
  engine.render(state); // re-render at normal size
}
