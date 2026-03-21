/**
 * Koch Snowflake — recursive subdivision of triangle sides.
 */

import { Algorithm } from '../base.js';

/**
 * Given two points A and B, return the 4 sub-segments of the Koch subdivision:
 * A → 1/3, 1/3 → peak, peak → 2/3, 2/3 → B
 */
function subdivide(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  // Trisection points
  const p1x = ax + dx / 3;
  const p1y = ay + dy / 3;
  const p2x = ax + (2 * dx) / 3;
  const p2y = ay + (2 * dy) / 3;
  // Peak: rotate midpoint 60° around p1
  const angle = Math.atan2(dy, dx) - Math.PI / 3;
  const len = Math.sqrt(dx * dx + dy * dy) / 3;
  const peakX = p1x + Math.cos(angle) * len;
  const peakY = p1y + Math.sin(angle) * len;
  return [p1x, p1y, peakX, peakY, p2x, p2y];
}

/**
 * Build array of Koch curve points from a single segment, recursively.
 */
function kochPoints(ax, ay, bx, by, depth) {
  if (depth === 0) return [[ax, ay], [bx, by]];
  const [p1x, p1y, peakX, peakY, p2x, p2y] = subdivide(ax, ay, bx, by);
  const seg1 = kochPoints(ax, ay, p1x, p1y, depth - 1);
  const seg2 = kochPoints(p1x, p1y, peakX, peakY, depth - 1);
  const seg3 = kochPoints(peakX, peakY, p2x, p2y, depth - 1);
  const seg4 = kochPoints(p2x, p2y, bx, by, depth - 1);
  // Merge without duplicating shared endpoints
  return [...seg1, ...seg2.slice(1), ...seg3.slice(1), ...seg4.slice(1)];
}

export class Koch extends Algorithm {
  constructor(engine) {
    super(engine);
    this._svgPath = '';
  }

  get metadata() {
    return {
      name: 'Koch Snowflake',
      eq: 'Recursive edge subdivision',
      cat: 'Fractals',
      desc: 'Each edge of an equilateral triangle is recursively subdivided into four segments, creating infinite perimeter within finite area.',
    };
  }

  get params() {
    return [
      { id: 'koch_depth', label: 'Depth', min: 0, max: 7, step: 1 },
    ];
  }

  get detailParam() {
    return { id: 'koch_depth', min: 0, max: 7, step: 1 };
  }

  get cursorMap() {
    return (mx, _my, s) => {
      s.koch_depth = Math.round(mx * 7);
    };
  }

  animate(_s) {}

  render(ctx, W, H, s) {
    const depth = Math.max(0, Math.min(7, Math.round(s.koch_depth)));
    const fg = this.engine.fg();
    const camZoom = s.camZoom || 1;
    const panX = s.camPanX || 0;
    const panY = s.camPanY || 0;

    // Equilateral triangle fitting in canvas
    const size = Math.min(W, H) * 0.72;
    const cx = W / 2 + panX;
    const cy = H / 2 + panY;

    // Triangle vertices (pointy-top)
    const h = (size * Math.sqrt(3)) / 2;
    const ax = cx,           ay = cy - h * 0.667;
    const bx = cx + size / 2, by = cy + h * 0.333;
    const cx2 = cx - size / 2, cy2 = cy + h * 0.333;

    const side1 = kochPoints(ax, ay, bx, by, depth);
    const side2 = kochPoints(bx, by, cx2, cy2, depth);
    const side3 = kochPoints(cx2, cy2, ax, ay, depth);

    const allPts = [...side1, ...side2.slice(1), ...side3.slice(1)];

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.beginPath();
    ctx.moveTo(allPts[0][0], allPts[0][1]);
    for (let i = 1; i < allPts.length; i++) {
      ctx.lineTo(allPts[i][0], allPts[i][1]);
    }
    ctx.closePath();

    ctx.strokeStyle = fg;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cache SVG path
    this._svgPath = 'M ' + allPts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' L ') + ' Z';

    ctx.restore();
  }

  collectSVG(W, H, s) {
    if (!this._svgPath) return null;
    const fg = this.engine.fg();
    const bg = this.engine.bg();
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <path d="${this._svgPath}" stroke="${fg}" stroke-width="1" fill="none"/>
</svg>`;
  }
}
