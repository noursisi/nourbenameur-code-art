/**
 * Dragon Curve — paper-folding fractal via direction sequence.
 * Animation: continuously rotates the curve.
 */

import { Algorithm } from '../base.js';

/**
 * Build the direction array for a dragon curve of given depth.
 * At each iteration, interleave existing directions with R/L turns.
 */
function buildDirections(depth) {
  let dirs = [1]; // 1 = turn right, -1 = turn left
  for (let i = 1; i < depth; i++) {
    // New dirs = old dirs + [1] + reverse(old dirs mapped to opposite)
    const newDirs = [];
    for (let j = 0; j < dirs.length; j++) newDirs.push(dirs[j]);
    newDirs.push(1);
    for (let j = dirs.length - 1; j >= 0; j--) newDirs.push(-dirs[j]);
    dirs = newDirs;
  }
  return dirs;
}

/**
 * Build the list of points by walking the direction array.
 * Angle changes: +1 → turn left 90°, -1 → turn right 90°
 */
function buildPoints(dirs) {
  const pts = [[0, 0]];
  let x = 0, y = 0;
  let angle = 0; // in units of 90°, 0=right, 1=up, 2=left, 3=down
  const dx = [1, 0, -1, 0];
  const dy = [0, -1, 0, 1];

  for (let i = 0; i < dirs.length; i++) {
    // dirs[i] = 1 means turn left, -1 means turn right
    angle = ((angle + dirs[i] + 4) % 4);
    x += dx[angle];
    y += dy[angle];
    pts.push([x, y]);
  }
  return pts;
}

/**
 * Parse a hex color string like '#ffffff' or '#fff' into [r, g, b] 0-255.
 */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Linearly interpolate between two RGB triples.
 */
function lerpRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export class Dragon extends Algorithm {
  constructor(engine) {
    super(engine);
    this._rotation = 0;
    this._scalePulse = 1;
    // Cache for the built points (expensive to recompute at high depths)
    this._cachedDepth = -1;
    this._cachedPts = null;
  }

  get metadata() {
    return {
      name: 'Dragon Curve',
      eq: 'Paper-folding sequence',
      cat: 'Fractals',
      desc: 'Fold a strip of paper in half repeatedly and unfold at 90°. The resulting crease pattern produces a self-similar fractal boundary.',
    };
  }

  get params() {
    return [
      { id: 'dragon_depth', label: 'Iterations', min: 5, max: 18, step: 1 },
      { id: 'dragon_colorGrad', label: 'Color Gradient', min: 0, max: 1, step: 1 },
      { id: 'dragon_folds', label: 'Folds', min: 1, max: 4, step: 1 },
      { id: 'dragon_rotSpeed', label: 'Rotation', min: 0, max: 2, step: 0.05 },
    ];
  }

  get detailParam() {
    return { id: 'dragon_depth', min: 5, max: 18, step: 1 };
  }

  get cursorMap() {
    return (mx, _my, s) => {
      s.dragon_depth = Math.round(5 + mx * 13);
    };
  }

  animate(world) { const { state: s } = world;
    // Rotate and pulse scale for dramatic animation
    this._rotation = s.time * (s.dragon_rotSpeed !== undefined ? s.dragon_rotSpeed : 0.35);
    this._scalePulse = 0.85 + Math.sin(s.time * 0.5) * 0.15;
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const depth = Math.max(5, Math.min(18, Math.round(s.dragon_depth)));
    const fg = this.engine.fg(s);
    const camZoom = s.camZoom || 1;
    const panX = s.camPanX || 0;
    const panY = s.camPanY || 0;
    const colorGrad = s.dragon_colorGrad ? 1 : 0;
    const folds = Math.max(1, Math.min(4, Math.round(s.dragon_folds || 1)));

    // Cache point building (expensive at depth 18)
    if (this._cachedDepth !== depth) {
      const dirs = buildDirections(depth);
      this._cachedPts = buildPoints(dirs);
      this._cachedDepth = depth;
    }
    const pts = this._cachedPts;

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const bW = maxX - minX || 1;
    const bH = maxY - minY || 1;

    // Fit to 80% of canvas, with scale pulse
    const fitW = W * 0.80 * this._scalePulse;
    const fitH = H * 0.80 * this._scalePulse;
    const scale = Math.min(fitW / bW, fitH / bH);

    const cxMid = (minX + maxX) / 2;
    const cyMid = (minY + maxY) / 2;

    const lineWidth = Math.max(0.5, 1.5 * (1 / Math.sqrt(depth))) * (s.lineWeight || 1);

    // Pre-compute gradient colors if needed
    let fgRgb, tintRgb;
    if (colorGrad) {
      fgRgb = hexToRgb(s.fgColor || '#ffffff');
      // Complementary blue/cyan tint — a fixed deep cyan target
      tintRgb = [0, 200, 255];
    }

    const N = pts.length - 1; // number of segments

    // Helper: draw the dragon curve into the current context transform
    const drawCurve = () => {
      if (colorGrad) {
        // Draw each segment individually with interpolated color
        for (let i = 0; i < N; i++) {
          const t = N > 1 ? i / (N - 1) : 0;
          const [r, g, b] = lerpRgb(fgRgb, tintRgb, t);
          ctx.strokeStyle = `rgb(${r},${g},${b})`;
          ctx.beginPath();
          ctx.moveTo((pts[i][0] - cxMid) * scale, (pts[i][1] - cyMid) * scale);
          ctx.lineTo((pts[i + 1][0] - cxMid) * scale, (pts[i + 1][1] - cyMid) * scale);
          ctx.stroke();
        }
      } else {
        // Single path — fast
        ctx.strokeStyle = fg;
        ctx.beginPath();
        ctx.moveTo((pts[0][0] - cxMid) * scale, (pts[0][1] - cyMid) * scale);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo((pts[i][0] - cxMid) * scale, (pts[i][1] - cyMid) * scale);
        }
        ctx.stroke();
      }
    };

    ctx.save();
    ctx.translate(W / 2 + panX, H / 2 + panY);
    ctx.scale(camZoom, camZoom);
    ctx.rotate(this._rotation);

    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (folds === 1) {
      drawCurve();
    } else {
      // Draw folds evenly rotated around center (center is already at origin here)
      for (let f = 0; f < folds; f++) {
        ctx.save();
        ctx.rotate((f / folds) * Math.PI * 2);
        drawCurve();
        ctx.restore();
      }
    }

    ctx.restore();
  }
}
