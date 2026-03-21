/**
 * SVG export — uses the algorithm's collectSVG() method if available,
 * otherwise signals the caller to fall back to PNG.
 */

export function exportSVG(engine, state, algorithm) {
  const W = engine.W;
  const H = engine.H;
  const svgData = algorithm.collectSVG ? algorithm.collectSVG(W, H, state) : null;

  if (!svgData) {
    // Pixel-based algorithm — silently fall back to PNG
    return false; // signal caller to do PNG
  }

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n`;
  if (!state.transparent) {
    const bg = state.colorMode === 'wb' ? '#000'
             : state.colorMode === 'bw' ? '#f0efe8'
             : '#0a0a0a';
    svg += `  <rect width="${W}" height="${H}" fill="${bg}"/>\n`;
  }
  svg += svgData;
  svg += '\n</svg>';

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = `code-art-${state.algo}-${Date.now()}.svg`;
  link.href = URL.createObjectURL(blob);
  link.click();
  return true;
}
