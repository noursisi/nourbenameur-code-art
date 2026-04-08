/**
 * SVG export — uses the algorithm's collectSVG() method if available,
 * or generates SVG from image processor needlework effect,
 * otherwise signals the caller to fall back to PNG.
 */

import { imageProcessor } from '../interaction/image-processor.js';

/**
 * Generate SVG dot grid from the image processor's needlework effect.
 * Samples the source image on a grid and places uniform circles.
 */
function collectNeedleworkSVG(W, H, state) {
  const source = imageProcessor._source;
  if (!source) return null;

  const dotSize   = state.ip_nw_dotsize   ?? 6;
  const spacing   = state.ip_nw_spacing   ?? 1;
  const threshold = state.ip_nw_threshold ?? 0.4;
  const invert    = state.ip_nw_invert    ?? 0;

  const iw = source.videoWidth || source.naturalWidth || source.width;
  const ih = source.videoHeight || source.naturalHeight || source.height;
  if (!iw || !ih) return null;

  // Render source at CSS resolution (no DPR) — SVG is resolution-independent
  const offscreen = document.createElement('canvas');
  offscreen.width = Math.round(W);
  offscreen.height = Math.round(H);
  const ctx = offscreen.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Draw source fitted exactly as the shader sees it (at CSS scale)
  const fitScale = Math.min(W / iw, H / ih) * (state.ip_scale || 1);
  const dw = iw * fitScale;
  const dh = ih * fitScale;
  const dx = (W - dw) / 2 + (state.ip_offsetX || 0);
  const dy = (H - dh) / 2 + (state.ip_offsetY || 0);
  ctx.drawImage(source, dx, dy, dw, dh);

  const pixels = ctx.getImageData(0, 0, Math.round(W), Math.round(H)).data;
  const pixW = Math.round(W);

  const cellSize = dotSize + spacing;
  const radius = dotSize / 2;
  const cols = Math.floor(W / cellSize);
  const rows = Math.floor(H / cellSize);

  let circles = '';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = (col + 0.5) * cellSize;
      const cy = (row + 0.5) * cellSize;

      const sx = Math.min(Math.floor(cx), pixW - 1);
      const sy = Math.min(Math.floor(cy), Math.round(H) - 1);
      const idx = (sy * pixW + sx) * 4;

      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      let bright = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

      if (invert > 0.5) bright = 1 - bright;

      if (bright >= threshold) {
        circles += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${radius}"/>\n`;
      }
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
    // Pixel-based algorithm — silently fall back to PNG
    return false; // signal caller to do PNG
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
