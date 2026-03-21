/**
 * Sierpinski Triangle — recursive triangle removal.
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
      { id: 'sierpinski_depth', label: 'Depth', min: 1, max: 8, step: 1 },
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

  animate(_s) {}

  render(ctx, W, H, s) {
    const depth = Math.max(1, Math.min(8, Math.round(s.sierpinski_depth)));
    const fg = this.engine.fg();
    const camZoom = s.camZoom || 1;
    const panX = s.camPanX || 0;
    const panY = s.camPanY || 0;

    const size = Math.min(W, H) * 0.82;
    const cx = W / 2 + panX;
    const cy = H / 2 + panY;
    const h = (size * Math.sqrt(3)) / 2;

    // Pointy-top equilateral triangle
    const ax = cx;
    const ay = cy - h * 0.667;
    const bx = cx + size / 2;
    const by = cy + h * 0.333;
    const cx2 = cx - size / 2;
    const cy2 = cy + h * 0.333;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.fillStyle = fg;
    drawSierpinski(ctx, ax, ay, bx, by, cx2, cy2, depth);

    ctx.restore();
  }
}
