/**
 * Koch Snowflake — recursive subdivision of polygon sides.
 * koch_sides controls the number of sides (3 = triangle, 4 = square, etc.)
 */

import { Algorithm } from '../base.js';

/**
 * Given two points A and B, return the 4 sub-segments of the Koch subdivision:
 * A → 1/3, 1/3 → peak, peak → 2/3, 2/3 → B
 *
 * peakAngleRad — angle of the peak in radians (default Math.PI/3 = 60°)
 * invert — 1 to flip the peak direction inward, -1 for outward (default -1)
 */
function subdivide(ax, ay, bx, by, peakAngleRad, invert) {
  const dx = bx - ax;
  const dy = by - ay;
  // Trisection points
  const p1x = ax + dx / 3;
  const p1y = ay + dy / 3;
  const p2x = ax + (2 * dx) / 3;
  const p2y = ay + (2 * dy) / 3;
  // Peak: rotate P1→P2 vector by ±angle around P1
  const edx = p2x - p1x;
  const edy = p2y - p1y;
  const cos_a = Math.cos(peakAngleRad);
  const sin_a = Math.sin(peakAngleRad);
  const dir = invert;
  const peakX = p1x + edx * cos_a - edy * sin_a * dir;
  const peakY = p1y + edx * sin_a * dir + edy * cos_a;
  return [p1x, p1y, peakX, peakY, p2x, p2y];
}

/**
 * Build array of Koch curve points from a single segment, recursively.
 */
function kochPoints(ax, ay, bx, by, depth, peakAngleRad, invert) {
  if (depth === 0) return [[ax, ay], [bx, by]];
  const [p1x, p1y, peakX, peakY, p2x, p2y] = subdivide(ax, ay, bx, by, peakAngleRad, invert);
  const seg1 = kochPoints(ax, ay, p1x, p1y, depth - 1, peakAngleRad, invert);
  const seg2 = kochPoints(p1x, p1y, peakX, peakY, depth - 1, peakAngleRad, invert);
  const seg3 = kochPoints(peakX, peakY, p2x, p2y, depth - 1, peakAngleRad, invert);
  const seg4 = kochPoints(p2x, p2y, bx, by, depth - 1, peakAngleRad, invert);
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
      { id: 'koch_angle', label: 'Peak Angle', min: 10, max: 120, step: 1 },
      { id: 'koch_fill', label: 'Fill', min: 0, max: 1, step: 1 },
      { id: 'koch_invert', label: 'Invert', min: 0, max: 1, step: 1 },
      { id: 'koch_rotSpeed', label: 'Rotation', min: 0, max: 2, step: 0.1 },
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

  animate(world) { const { state: s } = world;
    const rotSpeed = (s.koch_rotSpeed !== undefined) ? s.koch_rotSpeed : 0.3;
    this._rotation = s.time * rotSpeed;
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const depth = Math.max(0, Math.min(7, Math.round(s.koch_depth)));
    const sides = Math.max(3, Math.min(8, Math.round(s.koch_sides || 3)));
    const peakAngleDeg = (s.koch_angle !== undefined) ? s.koch_angle : 60;
    const peakAngleRad = (peakAngleDeg * Math.PI) / 180;
    const invertDir = (s.koch_invert) ? -1 : 1;
    const fillMode = !!(s.koch_fill);
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
      const sidePts = kochPoints(ax, ay, bx, by, depth, peakAngleRad, invertDir);
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

    // Fill mode: solid fill with 0.15 alpha
    if (fillMode) {
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = fg;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Cache SVG path
    this._svgPath = 'M ' + allPts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' L ') + ' Z';

    ctx.restore();
  }

  collectSVG(world) { const { W, H, state: s } = world;
    if (!this._svgPath) return null;
    const fg = this.engine.fg(s);
    const bg = this.engine.bg(s);
    const fillAttr = s.koch_fill ? `fill="${fg}" fill-opacity="0.15"` : 'fill="none"';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <path d="${this._svgPath}" stroke="${fg}" stroke-width="${s.lineWeight || 1}" ${fillAttr}/>
</svg>`;
  }
}
