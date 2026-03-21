/**
 * Sierpinski Triangle — recursive triangle removal.
 * sierpinski_scale controls zoom level.
 */

import { Algorithm } from '../base.js';

function drawSierpinski(ctx, ax, ay, bx, by, cx2, cy, depth) {
  if (depth === 0) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx2, cy);
    ctx.closePath();
    ctx.fill();
    return;
  }
  // Midpoints of each side
  const mabx = (ax + bx) / 2;
  const maby = (ay + by) / 2;
  const mbcx = (bx + cx2) / 2;
  const mbcy = (by + cy) / 2;
  const mcax = (cx2 + ax) / 2;
  const mcay = (cy + ay) / 2;

  drawSierpinski(ctx, ax, ay, mabx, maby, mcax, mcay, depth - 1);
  drawSierpinski(ctx, mabx, maby, bx, by, mbcx, mbcy, depth - 1);
  drawSierpinski(ctx, mcax, mcay, mbcx, mbcy, cx2, cy, depth - 1);
}

export class Sierpinski extends Algorithm {
  constructor(engine) {
    super(engine);
    this._rotation = 0;
  }

  get metadata() {
    return {
      name: 'Sierpinski Triangle',
      eq: 'Recursive midpoint removal',
      cat: 'Fractals',
      desc: 'Repeatedly removing the central triangle from each remaining triangle produces the Sierpinski fractal with Hausdorff dimension log(3)/log(2) ≈ 1.585.',
    };
  }

  get params() {
    return [
      { id: 'sierpinski_depth', label: 'Depth', min: 1, max: 8,   step: 1   },
      { id: 'sierpinski_scale', label: 'Zoom',  min: 0.3, max: 3, step: 0.05 },
    ];
  }

  get detailParam() {
    return { id: 'sierpinski_depth', min: 1, max: 8, step: 1 };
  }

  get cursorMap() {
    return (mx, _my, s) => {
      s.sierpinski_depth = Math.round(1 + mx * 7);
    };
  }

  animate(s) {
    // Continuously rotate the triangle
    this._rotation = s.time * 0.25;
  }

  render(ctx, W, H, s) {
    const depth = Math.max(1, Math.min(8, Math.round(s.sierpinski_depth)));
    const zoom = Math.max(0.3, Math.min(3, s.sierpinski_scale || 1));
    const fg = this.engine.fg(s);
    const camZoom = (s.camZoom || 1) * zoom;
    const panX = s.camPanX || 0;
    const panY = s.camPanY || 0;

    const size = Math.min(W, H) * 0.82;
    const radius = size / 2;
    const cx = W / 2 + panX;
    const cy = H / 2 + panY;

    // Rotate triangle vertices by animation angle
    const rot = this._rotation;
    function vertex(i) {
      const angle = rot + (i / 3) * Math.PI * 2 - Math.PI / 2;
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    }

    const [ax, ay] = vertex(0);
    const [bx, by] = vertex(1);
    const [cx2, cy2] = vertex(2);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.fillStyle = fg;
    drawSierpinski(ctx, ax, ay, bx, by, cx2, cy2, depth);

    ctx.restore();
  }
}
