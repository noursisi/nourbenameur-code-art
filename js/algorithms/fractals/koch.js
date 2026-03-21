/**
 * Koch Snowflake — recursive subdivision of polygon sides.
 * koch_sides controls the number of sides (3 = triangle, 4 = square, etc.)
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
    this._rotation = 0;
  }

  get metadata() {
    return {
      name: 'Koch Snowflake',
      eq: 'Recursive edge subdivision',
      cat: 'Fractals',
      desc: 'Each edge of an equilateral polygon is recursively subdivided into four segments, creating infinite perimeter within finite area.',
    };
  }

  get params() {
    return [
      { id: 'koch_depth', label: 'Depth', min: 0, max: 7, step: 1 },
      { id: 'koch_sides', label: 'Sides', min: 3, max: 8, step: 1 },
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

  animate(s) {
    // Slowly rotate and cycle depth for dramatic animation
    this._rotation = s.time * 0.3;
  }

  render(ctx, W, H, s) {
    const depth = Math.max(0, Math.min(7, Math.round(s.koch_depth)));
    const sides = Math.max(3, Math.min(8, Math.round(s.koch_sides || 3)));
    const fg = this.engine.fg(s);
    const camZoom = s.camZoom || 1;
    const panX = s.camPanX || 0;
    const panY = s.camPanY || 0;

    // Regular polygon fitting in canvas
    const size = Math.min(W, H) * 0.72;
    const radius = size / 2;
    const cx = W / 2 + panX;
    const cy = H / 2 + panY;

    // Generate polygon vertices
    const vertices = [];
    for (let i = 0; i < sides; i++) {
      const angle = this._rotation + (i / sides) * Math.PI * 2 - Math.PI / 2;
      vertices.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }

    // Build Koch curve for each side
    const allPts = [];
    for (let i = 0; i < sides; i++) {
      const [ax, ay] = vertices[i];
      const [bx, by] = vertices[(i + 1) % sides];
      const sidePts = kochPoints(ax, ay, bx, by, depth);
      if (i === 0) {
        allPts.push(...sidePts);
      } else {
        allPts.push(...sidePts.slice(1));
      }
    }

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
    ctx.lineWidth = s.lineWeight || 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Cache SVG path
    this._svgPath = 'M ' + allPts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' L ') + ' Z';

    ctx.restore();
  }

  collectSVG(W, H, s) {
    if (!this._svgPath) return null;
    const fg = this.engine.fg(s);
    const bg = this.engine.bg(s);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <path d="${this._svgPath}" stroke="${fg}" stroke-width="${s.lineWeight || 1}" fill="none"/>
</svg>`;
  }
}
