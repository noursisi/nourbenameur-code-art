/**
 * SVG export — uses the algorithm's collectSVG() method if available,
 * or generates SVG from image processor needlework effect,
 * otherwise signals the caller to fall back to PNG.
 */

import { imageProcessor } from '../interaction/image-processor.js';

function collectNeedleworkSVG(W, H, state) {
  const source = imageProcessor._source;
  if (!source) return null;

  const dotSize   = state.ip_nw_dotsize   ?? 6;
  const spacing   = state.ip_nw_spacing   ?? 1;
  const threshold = state.ip_nw_threshold ?? 0.4;
  const inv = Number(state.ip_nw_invert ?? 0) >= 1;

  const iw = source.videoWidth || source.naturalWidth || source.width;
  const ih = source.videoHeight || source.naturalHeight || source.height;
  if (!iw || !ih) return null;

  const cellSize = dotSize + spacing;
  const radius = dotSize / 2;

  const fitScale = Math.min(W / iw, H / ih) * (state.ip_scale || 1);
  const dw = iw * fitScale;
  const dh = ih * fitScale;
  const dx = (W - dw) / 2 + (state.ip_offsetX || 0);
  const dy = (H - dh) / 2 + (state.ip_offsetY || 0);

  const imgCols = Math.floor(dw / cellSize);
  const imgRows = Math.floor(dh / cellSize);
  if (imgCols <= 0 || imgRows <= 0) return null;

  let pixels;
  try {
    const off = document.createElement('canvas');
    off.width = imgCols;
    off.height = imgRows;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, imgCols, imgRows);
    ctx.drawImage(source, 0, 0, imgCols, imgRows);
    pixels = ctx.getImageData(0, 0, imgCols, imgRows).data;
  } catch (e) {
    return null;
  }

  const gridW = imgCols * cellSize;
  const gridH = imgRows * cellSize;
  const offsetX = dx + (dw - gridW) / 2;
  const offsetY = dy + (dh - gridH) / 2;

  let circles = '';

  for (let row = 0; row < imgRows; row++) {
    for (let col = 0; col < imgCols; col++) {
      const idx = (row * imgCols + col) * 4;
      const bright = (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114) / 255;

      const placeDot = inv ? (bright <= threshold) : (bright >= threshold);
      if (!placeDot) continue;

      const cx = offsetX + (col + 0.5) * cellSize;
      const cy = offsetY + (row + 0.5) * cellSize;
      circles += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${radius}"/>\n`;
    }
  }

  if (!circles) return null;
  return `  <g fill="#fff">\n${circles}  </g>`;
}

export function exportSVG(engine, state, algorithm) {
  const W = engine.W;
  const H = engine.H;

  let svgData = null;
  if (state.ip_enabled && state.ip_effect === 'needlework' && imageProcessor.hasSource()) {
    svgData = collectNeedleworkSVG(W, H, state);
  }

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
