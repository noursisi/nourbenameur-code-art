/**
 * High-resolution image export — renders at 2x the current canvas size.
 * Defaults to JPG @ 95% quality (smaller, photographic content stays sharp).
 * PNG is supported via {format:'png'} for transparent or line-art exports.
 */

export function exportPNG(engine, state, opts = {}) {
  const format = opts.format || (state.transparent ? 'png' : 'jpg');
  const quality = opts.quality ?? 0.95;

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

  // JPG cannot encode transparency — fill black behind to avoid white flash
  if (format === 'jpg') {
    exportCtx.fillStyle = state.bgColor || '#000000';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  }

  // Render at 2x
  engine.render(state);

  // Download
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const ext  = format === 'png' ? 'png' : 'jpg';
  const link = document.createElement('a');
  link.download = `code-art-${state.algo}-${Date.now()}.${ext}`;
  link.href = exportCanvas.toDataURL(mime, quality);
  link.click();

  // Restore
  engine.canvas = origCanvas;
  engine.ctx    = origCtx;
  engine.W      = oldW;
  engine.H      = oldH;
  engine.render(state); // re-render at normal size
}
