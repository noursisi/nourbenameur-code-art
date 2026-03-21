/**
 * Barnsley Fern — Iterated Function System (IFS).
 * Four affine transforms applied randomly produce the classic fern shape.
 */

import { Algorithm } from '../base.js';

// IFS transform table: [a, b, c, d, e, f, probability]
const TRANSFORMS = [
  [  0,      0,     0,    0.16,  0,    0,    0.01 ],
  [  0.85,   0.04, -0.04, 0.85,  0,    1.60, 0.85 ],
  [  0.20,  -0.26,  0.23, 0.22,  0,    1.60, 0.07 ],
  [ -0.15,   0.28,  0.26, 0.24,  0,    0.44, 0.07 ],
];

// Cumulative probability thresholds
const CUM = (() => {
  let acc = 0;
  return TRANSFORMS.map(t => { acc += t[6]; return acc; });
})();

function applyTransform(x, y) {
  const r = Math.random();
  let i = 0;
  while (i < CUM.length - 1 && r > CUM[i]) i++;
  const [a, b, c, d, e, f] = TRANSFORMS[i];
  return [a * x + b * y + e, c * x + d * y + f];
}

export class Fern extends Algorithm {
  get metadata() {
    return {
      name: 'Barnsley Fern',
      eq: 'IFS affine transforms',
      cat: 'Fractals',
      desc: 'Four affine transforms chosen with fixed probabilities produce a self-similar fern shape through iterated function systems.',
    };
  }

  get params() {
    return [
      { id: 'fern_points', label: 'Points', min: 10000, max: 200000, step: 5000 },
    ];
  }

  get detailParam() {
    return { id: 'fern_points', min: 10000, max: 200000, step: 10000 };
  }

  get cursorMap() {
    return (mx, _my, s) => {
      s.fern_points = Math.round(10000 + mx * 190000);
    };
  }

  animate(_s) {}

  render(ctx, W, H, s) {
    const n = Math.max(10000, Math.min(200000, Math.round(s.fern_points)));
    const fg = this.engine.fg();

    // Fern IFS coords range roughly x:[-2.1820, 2.6558], y:[0, 9.9983]
    // Map to canvas with some padding
    const fernW = 4.8378;
    const fernH = 9.9983;
    const padding = 0.9;

    const fitW = W * padding;
    const fitH = H * padding;
    const scale = Math.min(fitW / fernW, fitH / fernH);

    // Center the fern: fern x-center ~0.22, y bottom = 0, top = 9.9983
    const panX = (s.camPanX || 0);
    const panY = (s.camPanY || 0);
    const camZoom = s.camZoom || 1;

    const originX = W / 2 - 0.22 * scale + panX;
    const originY = H * 0.97 + panY; // bottom of fern near canvas bottom

    ctx.save();
    // Apply camera zoom around centre
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2, -H / 2);

    // Plot points — use small rect for performance
    ctx.fillStyle = fg;
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) {
      [x, y] = applyTransform(x, y);
      const px = originX + x * scale;
      const py = originY - y * scale; // y flipped: IFS y grows up
      ctx.fillRect(px, py, 1.5, 1.5);
    }

    ctx.restore();
  }
}
