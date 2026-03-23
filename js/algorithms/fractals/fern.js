/**
 * Barnsley Fern — Iterated Function System (IFS).
 * Four affine transforms applied randomly produce the classic fern shape.
 * fern_variant selects from 4 different IFS coefficient sets.
 */

import { Algorithm } from '../base.js';

// IFS transform table: [a, b, c, d, e, f, probability]
// Variant 0: Classic Barnsley Fern
const VARIANTS = [
  // 0: Classic Barnsley Fern
  [
    [  0,      0,     0,    0.16,  0,    0,    0.01 ],
    [  0.85,   0.04, -0.04, 0.85,  0,    1.60, 0.85 ],
    [  0.20,  -0.26,  0.23, 0.22,  0,    1.60, 0.07 ],
    [ -0.15,   0.28,  0.26, 0.24,  0,    0.44, 0.07 ],
  ],
  // 1: Maple Leaf (wider, fuller spread)
  [
    [  0,      0,      0,    0.25,  0,   -0.4,  0.02 ],
    [  0.95,   0.005, -0.005, 0.93, -0.002, 0.5, 0.84 ],
    [  0.035, -0.2,    0.16,  0.04,  0,    0.25, 0.07 ],
    [ -0.04,   0.2,    0.16,  0.04,  0,    0.07, 0.07 ],
  ],
  // 2: Spiral Fern
  [
    [  0,      0,     0,    0.20,  0,    0,    0.02 ],
    [  0.79,   0.15, -0.15, 0.79,  0,    1.20, 0.86 ],
    [  0.16,  -0.22,  0.28, 0.14,  0,    1.20, 0.06 ],
    [ -0.14,   0.25,  0.22, 0.18,  0,    0.30, 0.06 ],
  ],
  // 3: Tree-like (branching, less fern-like)
  [
    [  0,      0,     0,    0.50,  0,    0,    0.05 ],
    [  0.42,  -0.42,  0.42, 0.42,  0,    0.20, 0.40 ],
    [  0.42,   0.42, -0.42, 0.42,  0,    0.20, 0.40 ],
    [  0.10,   0,     0,    0.10,  0,    0.20, 0.15 ],
  ],
];

function makeCumulative(transforms) {
  let acc = 0;
  return transforms.map(t => { acc += t[6]; return acc; });
}

function applyTransform(x, y, transforms, cum) {
  const r = Math.random();
  let i = 0;
  while (i < cum.length - 1 && r > cum[i]) i++;
  const [a, b, c, d, e, f] = transforms[i];
  return [a * x + b * y + e, c * x + d * y + f];
}

export class Fern extends Algorithm {
  constructor(engine) {
    super(engine);
    // Animated tweak applied to variant 0 main stem's b/c for subtle sway
    this._animOffset = 0;
  }

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
      { id: 'fern_points',  label: 'Points',  min: 10000, max: 200000, step: 5000 },
      { id: 'fern_variant', label: 'Variant', min: 0,     max: 3,      step: 1    },
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

  animate(world) { const { state: s } = world;
    // Slowly sway the leaf curvature (b and c of main stem transform)
    this._animOffset = Math.sin(s.time * 0.4) * 0.06;
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const n = Math.max(10000, Math.min(200000, Math.round(s.fern_points)));
    const variant = Math.max(0, Math.min(3, Math.round(s.fern_variant || 0)));
    const fg = this.engine.fg(s);

    // Build transforms — for variant 0 animate the sway
    let transforms = VARIANTS[variant].map(t => [...t]);
    if (variant === 0) {
      // Animate stem curvature (indices 1 and 2 control the leaf twist)
      transforms[1][1] =  0.04 + this._animOffset;
      transforms[1][2] = -0.04 + this._animOffset;
      transforms[2][1] = -0.26 - this._animOffset * 0.5;
      transforms[3][1] =  0.28 + this._animOffset * 0.5;
    } else if (variant === 2) {
      // Spiral: animate spin
      transforms[1][1] =  0.15 + this._animOffset;
      transforms[1][2] = -0.15 - this._animOffset;
    }
    const cum = makeCumulative(transforms);

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
    const dotSize = Math.max(1.5, s.lineWeight || 1);
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) {
      [x, y] = applyTransform(x, y, transforms, cum);
      const px = originX + x * scale;
      const py = originY - y * scale; // y flipped: IFS y grows up
      ctx.fillRect(px, py, dotSize, dotSize);
    }

    ctx.restore();
  }
}
