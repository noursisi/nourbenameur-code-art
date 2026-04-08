/**
 * SVG export — uses the algorithm's collectSVG() method if available,
 * or generates SVG from image processor needlework effect,
 * otherwise signals the caller to fall back to PNG.
 */

import { imageProcessor } from '../interaction/image-processor.js';

/**
 * Generate SVG dot grid from the image processor's needlework effect.
 * Downsamples source to grid resolution for clean, balanced dot placement.
 */
function collectNeedleworkSVG(W, H, state) {
  const source = imageProcessor._source;
  if (!source) return null;

  const dotSize   = state.ip_nw_dotsize   ?? 6;
  const spacing   = state.ip_nw_spacing   ?? 1;
  const threshold = state.ip_nw_threshold ?? 0.4;
  const invert    = state.ip_nw_invert    ?? 0;
  const inv = Number(invert) >= 1;

  const iw = source.videoWidth || source.naturalWidth || source.width;
  const ih = source.videoHeight || source.naturalHeight || source.height;
  if (!iw || !ih) return null;

  const cellSize = dotSize + spacing;
  const radius = dotSize / 2;
  const cols = Math.floor(W / cellSize);
  const rows = Math.floor(H / cellSize);

  const fitScale = Math.min(W / iw, H / ih) * (state.ip_scale || 1);
  const dw = iw * fitScale;
  const dh = ih * fitScale;
  const dx = (W - dw) / 2 + (state.ip_offsetX || 0);
  const dy = (H - dh) / 2 + (state.ip_offsetY || 0);

  // Downsample to grid resolution
  const gridStartCol = Math.max(0, Math.floor(dx / cellSize));
  const gridEndCol   = Math.min(cols, Math.ceil((dx + dw) / cellSize));
  const gridStartRow = Math.max(0, Math.floor(dy / cellSize));
  const gridEndRow   = Math.min(rows, Math.ceil((dy + dh) / cellSize));
  const gridCols = gridEndCol - gridStartCol;
  const gridRows = gridEndRow - gridStartRow;

  if (gridCols <= 0 || gridRows <= 0) return null;

  const offscreen = document.createElement('canvas');
  offscreen.width = gridCols;
  offscreen.height = gridRows;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, gridCols, gridRows);
  const srcX = ((gridStartCol * cellSize) - dx) / dw * iw;
  const srcY = ((gridStartRow * cellSize) - dy) / dh * ih;
  const srcW = (gridCols * cellSize) / dw * iw;
  const srcH = (gridRows * cellSize) / dh * ih;
  ctx.drawImage(source, srcX, srcY, srcW, srcH, 0, 0, gridCols, gridRows);
  const pixels = ctx.getImageData(0, 0, gridCols, gridRows).data;

  let circles = '';

  for (let gr = 0; gr < gridRows; gr++) {
    for (let gc = 0; gc < gridCols; gc++) {
      const idx = (gr * gridCols + gc) * 4;
      const a = pixels[idx + 3];
      let bright;
      if (a < 10) {
        bright = 1.0;
      } else {
        bright = (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114) / 255;
      }
      if (inv) bright = 1 - bright;
      if (bright < threshold) continue;

      const col = gridStartCol + gc;
      const row = gridStartRow + gr;
      const cx = (col + 0.5) * cellSize;
      const cy = (row + 0.5) * cellSize;
      circles += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${radius}"/>\n`;
    }
  }

  if (!circles) return null;
  return `  <g fill="#fff">\n${circles}  </g>`;
}

export function exportSVG(engine, state, algorithm) {
  const W = engine.W;
  const H = engine.H;

  // Check if image processor is active with needlework effect
  let svgData = null;
  if (state.ip_enabled && state.ip_effect === 'needlework' && imageProcessor.hasSource()) {
    svgData = collectNeedleworkSVG(W, H, state);
  }

  // Fall back to algorithm SVG
  if (!svgData) {
    svgData = algorithm.collectSVG ? algorithm.collectSVG(engine.world) : null;
  }

  if (!svgData) {
    return false;
  }

  const bg = state.bgColor || '#000000';
  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n`;
  if (!state.transparent) {
    svg += `  <rect width="${W}" height="${H}" fill="${bg}"/>\n`;
  }
  svg += svgData;
  svg += '\n</svg>';

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  const name = state.ip_effect === 'needlework' ? 'needlework' : state.algo;
  link.download = `code-art-${name}-${Date.now()}.svg`;
  link.href = URL.createObjectURL(blob);
  link.click();
  return true;
}
