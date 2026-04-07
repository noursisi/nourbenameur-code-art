/**
 * Clifford Strange Attractor
 * x' = sin(a*y) + c*cos(a*x)
 * y' = sin(b*x) + d*cos(b*y)
 */

import { Algorithm } from '../base.js';

export class Attractor extends Algorithm {
  get metadata() {
    return {
      name: 'Clifford Attractor',
      eq: "x'=sin(ay)+c*cos(ax), y'=sin(bx)+d*cos(by)",
      cat: 'Nature',
      desc: 'A strange attractor defined by four parameters. Small changes create wildly different fractal patterns.',
    };
  }

  get params() {
    return [
      { id: 'att_a',         label: 'a',      min: -3,    max: 3,      step: 0.01    },
      { id: 'att_b',         label: 'b',      min: -3,    max: 3,      step: 0.01    },
      { id: 'att_c',         label: 'c',      min: -3,    max: 3,      step: 0.01    },
      { id: 'att_d',         label: 'd',      min: -3,    max: 3,      step: 0.01    },
      { id: 'att_points',    label: 'Points', min: 10000, max: 300000, step: 10000   },
      { id: 'att_colorMode', label: 'Color',  min: 0,     max: 3,      step: 1       },
      { id: 'att_pointShape',label: 'Shape',  min: 0,     max: 2,      step: 1       },
      { id: 'att_trail',     label: 'Trail',  min: 0,     max: 1,      step: 1       },
    ];
  }

  get detailParam() {
    return { id: 'att_points', min: 10000, max: 300000, step: 10000 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.att_a = -3 + mx * 6;
      s.att_b = -3 + my * 6;
    };
  }

  animate(world) { const { state: s } = world;
    const t = s.time;
    s.att_a = -1.7 + Math.sin(t * 0.11) * 1.5 + Math.cos(t * 0.07) * 0.6;
    s.att_b =  1.3 + Math.cos(t * 0.09) * 1.4 + Math.sin(t * 0.13) * 0.5;
    s.att_c = -0.1 + Math.sin(t * 0.17) * 1.2;
    s.att_d = -1.21 + Math.cos(t * 0.13) * 1.1 + Math.sin(t * 0.19) * 0.4;
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const a = s.att_a, b = s.att_b, c = s.att_c, d = s.att_d;
    const n = Math.max(10000, Math.min(300000, Math.round(s.att_points)));
    const fg = this.engine.fg(s);
    const zoom = s.camZoom || 1;
    const panX = s.camPanX || 0;
    const panY = s.camPanY || 0;
    const colorMode  = Math.round(s.att_colorMode  || 0);
    const pointShape = Math.round(s.att_pointShape || 0);
    const trailOn    = Math.round(s.att_trail      || 0) === 1;

    // Iterate attractor — collect points, bounds, and optionally velocities
    let px = 0.1, py = 0.1;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const xs  = new Float32Array(n);
    const ys  = new Float32Array(n);
    // velocity array used for mode 1; zero-cost to allocate when not needed
    // (we always populate it so we don't branch inside a 300k loop)
    const vel = colorMode === 1 ? new Float32Array(n) : null;
    let velMin = Infinity, velMax = -Infinity;

    for (let i = 0; i < n; i++) {
      const nx = Math.sin(a * py) + c * Math.cos(a * px);
      const ny = Math.sin(b * px) + d * Math.cos(b * py);
      if (vel) {
        const dx = nx - px, dy = ny - py;
        const v  = Math.sqrt(dx * dx + dy * dy);
        vel[i] = v;
        if (v < velMin) velMin = v;
        if (v > velMax) velMax = v;
      }
      px = nx; py = ny;
      xs[i] = px; ys[i] = py;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    // Auto-fit to canvas
    const bW    = maxX - minX || 1;
    const bH    = maxY - minY || 1;
    const scale = Math.min(W * 0.85 / bW, H * 0.85 / bH) * zoom;
    const cx    = (minX + maxX) / 2;
    const cy    = (minY + maxY) / 2;

    const alpha   = Math.max(0.03, Math.min(0.6, 8000 / n));
    const dotSize = Math.max(1.5, s.lineWeight || 1);

    // Helper: convert screen coords from attractor space
    const toSX = xi => W / 2 + (xi - cx) * scale + panX;
    const toSY = yi => H / 2 + (yi - cy) * scale + panY;

    // Helper: draw one point according to chosen shape
    const drawPoint = (sx, sy) => {
      if (pointShape === 1) {
        // circle
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (pointShape === 2) {
        // pixel (1×1)
        ctx.fillRect(sx, sy, 1, 1);
      } else {
        // square (default)
        ctx.fillRect(sx, sy, dotSize, dotSize);
      }
    };

    // ── Color mode 0 (mono) ────────────────────────────────────────────────
    if (colorMode === 0) {
      ctx.fillStyle    = fg;
      ctx.globalAlpha  = alpha;
      ctx.strokeStyle  = fg;
      ctx.lineWidth    = 0.3;

      if (trailOn) {
        ctx.beginPath();
        ctx.moveTo(toSX(xs[0]), toSY(ys[0]));
        for (let i = 1; i < n; i++) {
          ctx.lineTo(toSX(xs[i]), toSY(ys[i]));
          // flush every 5000 segments to avoid a single enormous path
          if (i % 5000 === 0) { ctx.stroke(); ctx.beginPath(); ctx.moveTo(toSX(xs[i]), toSY(ys[i])); }
        }
        ctx.stroke();
      } else {
        for (let i = 0; i < n; i++) {
          drawPoint(toSX(xs[i]), toSY(ys[i]));
        }
      }

    // ── Color mode 1 (velocity — slow=blue, fast=red) ─────────────────────
    } else if (colorMode === 1) {
      ctx.globalAlpha = alpha;
      const velRange  = velMax - velMin || 1;

      if (trailOn) {
        // Draw in small batches, each batch uses median velocity colour
        const BATCH = 500;
        for (let i = 0; i < n - 1; i += BATCH) {
          const end = Math.min(i + BATCH, n - 1);
          // sample velocity at midpoint of batch for colour
          const mid  = Math.floor((i + end) / 2);
          const t    = (vel[mid] - velMin) / velRange;
          const hue  = 240 - t * 240; // 240=blue → 0=red
          ctx.strokeStyle = `hsl(${hue},100%,60%)`;
          ctx.lineWidth   = 0.3;
          ctx.beginPath();
          ctx.moveTo(toSX(xs[i]), toSY(ys[i]));
          for (let j = i + 1; j <= end; j++) {
            ctx.lineTo(toSX(xs[j]), toSY(ys[j]));
          }
          ctx.stroke();
        }
      } else {
        // Per-point colour — batch consecutive points of the same approximate hue
        const HUE_BUCKETS = 48; // quantise to 48 hue steps to reduce fillStyle changes
        let curBucket = -1;
        for (let i = 0; i < n; i++) {
          const t      = (vel[i] - velMin) / velRange;
          const hue    = 240 - t * 240;
          const bucket = Math.round(t * (HUE_BUCKETS - 1));
          if (bucket !== curBucket) {
            ctx.fillStyle = `hsl(${hue.toFixed(1)},100%,60%)`;
            curBucket = bucket;
          }
          drawPoint(toSX(xs[i]), toSY(ys[i]));
        }
      }

    // ── Color mode 2 (position — screen position → hue) ───────────────────
    } else if (colorMode === 2) {
      ctx.globalAlpha = alpha;
      // Quantise hue to reduce fillStyle changes (canvas 2D state switches are expensive)
      const HUE_BUCKETS = 60;
      let curBucket = -1;

      if (trailOn) {
        const BATCH = 500;
        for (let i = 0; i < n - 1; i += BATCH) {
          const end = Math.min(i + BATCH, n - 1);
          const mid = Math.floor((i + end) / 2);
          const sx  = toSX(xs[mid]), sy = toSY(ys[mid]);
          const hue = ((sx / W) * 0.5 + (sy / H) * 0.5) * 360;
          ctx.strokeStyle = `hsl(${hue.toFixed(1)},90%,60%)`;
          ctx.lineWidth   = 0.3;
          ctx.beginPath();
          ctx.moveTo(toSX(xs[i]), toSY(ys[i]));
          for (let j = i + 1; j <= end; j++) ctx.lineTo(toSX(xs[j]), toSY(ys[j]));
          ctx.stroke();
        }
      } else {
        for (let i = 0; i < n; i++) {
          const sx  = toSX(xs[i]), sy = toSY(ys[i]);
          const hue = ((sx / W) * 0.5 + (sy / H) * 0.5) * 360;
          const bucket = Math.round(((sx / W) * 0.5 + (sy / H) * 0.5) * (HUE_BUCKETS - 1));
          if (bucket !== curBucket) {
            ctx.fillStyle = `hsl(${hue.toFixed(1)},90%,60%)`;
            curBucket = bucket;
          }
          drawPoint(sx, sy);
        }
      }

    // ── Color mode 3 (iteration — index cycles through hues) ──────────────
    } else if (colorMode === 3) {
      ctx.globalAlpha = alpha;
      const HUE_PERIOD = 2000; // one full hue cycle every N iterations
      const HUE_BUCKETS = 60;
      let curBucket = -1;

      if (trailOn) {
        const BATCH = 500;
        for (let i = 0; i < n - 1; i += BATCH) {
          const end = Math.min(i + BATCH, n - 1);
          const mid = Math.floor((i + end) / 2);
          const hue = (mid % HUE_PERIOD) / HUE_PERIOD * 360;
          ctx.strokeStyle = `hsl(${hue.toFixed(1)},90%,60%)`;
          ctx.lineWidth   = 0.3;
          ctx.beginPath();
          ctx.moveTo(toSX(xs[i]), toSY(ys[i]));
          for (let j = i + 1; j <= end; j++) ctx.lineTo(toSX(xs[j]), toSY(ys[j]));
          ctx.stroke();
        }
      } else {
        for (let i = 0; i < n; i++) {
          const hue    = (i % HUE_PERIOD) / HUE_PERIOD * 360;
          const bucket = Math.round((i % HUE_PERIOD) / HUE_PERIOD * (HUE_BUCKETS - 1));
          if (bucket !== curBucket) {
            ctx.fillStyle = `hsl(${hue.toFixed(1)},90%,60%)`;
            curBucket = bucket;
          }
          drawPoint(toSX(xs[i]), toSY(ys[i]));
        }
      }
    }

    ctx.globalAlpha = 1;
  }
}
