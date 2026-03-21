/**
 * Contour Map — noise field with isoline rendering via marching squares lite.
 * Finds contour crossings along grid rows and columns, draws short line segments.
 * contour_animation_speed controls how fast the contours flow.
 */

import { Algorithm } from '../base.js';

// ── Value noise (same hash function as flow-field) ──────────────────────────

function hash2(x, y) {
  let h = ((x * 1619) ^ (y * 31337)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

function valueNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return (hash2(ix, iy) * (1 - ux) + hash2(ix + 1, iy) * ux) * (1 - uy) +
         (hash2(ix, iy + 1) * (1 - ux) + hash2(ix + 1, iy + 1) * ux) * uy;
}

function fbm(x, y, octaves) {
  let val = 0, amp = 1, freq = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    val += valueNoise(x * freq, y * freq) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / total;
}

export class Contour extends Algorithm {
  get metadata() {
    return {
      name: 'Contour Map',
      eq: 'isolines on fBm noise field',
      cat: 'Data Art',
      desc: 'Fractal Brownian Motion noise creates a terrain-like scalar field. Isolines trace elevation contours using a grid-marching approach.',
    };
  }

  get params() {
    return [
      { id: 'contour_levels',           label: 'Levels',       min: 3,    max: 40,   step: 1     },
      { id: 'contour_scale',            label: 'Scale',        min: 0.002, max: 0.02, step: 0.001 },
      { id: 'contour_octaves',          label: 'Octaves',      min: 1,    max: 5,    step: 1     },
      { id: 'contour_animation_speed',  label: 'Anim Speed',   min: 0,    max: 3,    step: 0.05  },
    ];
  }

  get detailParam() {
    return { id: 'contour_levels', min: 3, max: 40, step: 2 };
  }

  get cursorMap() {
    return (mx, _my, s) => {
      s.contour_scale = 0.002 + mx * 0.018;
    };
  }

  animate(s) {
    // Time naturally advances in app.js; contour uses it directly in render.
    // No extra mutation needed — the time offset in render drives the shift.
  }

  render(ctx, W, H, s) {
    const levels    = Math.max(3, Math.min(40, Math.round(s.contour_levels)));
    const scale     = Math.max(0.002, s.contour_scale);
    const octaves   = Math.max(1, Math.min(5, Math.round(s.contour_octaves)));
    const animSpeed = Math.max(0, s.contour_animation_speed !== undefined ? s.contour_animation_speed : 0.5);
    // Time offset shifts both x and y for diagonal flowing motion
    const timeOff   = (s.time || 0) * animSpeed * 0.25;
    const fg        = this.engine.fg();

    // Grid resolution: ~80 columns/rows is enough for smooth contours
    const cols = Math.min(120, Math.floor(W / 8));
    const rows = Math.min(120, Math.floor(H / 8));
    const cw = W / cols;
    const ch = H / rows;

    // Build noise grid — time offset in both x and y creates flowing diagonal motion
    const grid = new Float32Array((cols + 1) * (rows + 1));
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= cols; col++) {
        const nx = col * cw * scale + timeOff;
        const ny = row * ch * scale + timeOff * 0.7;
        grid[row * (cols + 1) + col] = fbm(nx, ny, octaves);
      }
    }

    ctx.strokeStyle = fg;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.7;

    // For each contour level, march along grid edges
    for (let lvl = 1; lvl < levels; lvl++) {
      const threshold = lvl / levels;

      ctx.beginPath();
      // Horizontal edges (vary col, row stays same)
      for (let row = 0; row <= rows; row++) {
        for (let col = 0; col < cols; col++) {
          const v0 = grid[row * (cols + 1) + col];
          const v1 = grid[row * (cols + 1) + col + 1];
          if ((v0 < threshold) !== (v1 < threshold)) {
            const t = (threshold - v0) / (v1 - v0);
            const x = (col + t) * cw;
            const y = row * ch;
            ctx.moveTo(x, y - 3);
            ctx.lineTo(x, y + 3);
          }
        }
      }
      // Vertical edges
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col <= cols; col++) {
          const v0 = grid[row       * (cols + 1) + col];
          const v1 = grid[(row + 1) * (cols + 1) + col];
          if ((v0 < threshold) !== (v1 < threshold)) {
            const t = (threshold - v0) / (v1 - v0);
            const x = col * cw;
            const y = (row + t) * ch;
            ctx.moveTo(x - 3, y);
            ctx.lineTo(x + 3, y);
          }
        }
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  collectSVG(W, H, s) {
    const levels  = Math.max(3, Math.min(40, Math.round(s.contour_levels)));
    const scale   = Math.max(0.002, s.contour_scale);
    const octaves = Math.max(1, Math.min(5, Math.round(s.contour_octaves)));
    const animSpeed = Math.max(0, s.contour_animation_speed !== undefined ? s.contour_animation_speed : 0.5);
    const timeOff = (s.time || 0) * animSpeed * 0.25;
    const fg      = this.engine.fg();

    const cols = Math.min(120, Math.floor(W / 8));
    const rows = Math.min(120, Math.floor(H / 8));
    const cw = W / cols;
    const ch = H / rows;

    const grid = new Float32Array((cols + 1) * (rows + 1));
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= cols; col++) {
        grid[row * (cols + 1) + col] = fbm(col * cw * scale + timeOff, row * ch * scale + timeOff * 0.7, octaves);
      }
    }

    let paths = '';
    for (let lvl = 1; lvl < levels; lvl++) {
      const threshold = lvl / levels;
      let d = '';
      for (let row = 0; row <= rows; row++) {
        for (let col = 0; col < cols; col++) {
          const v0 = grid[row * (cols + 1) + col];
          const v1 = grid[row * (cols + 1) + col + 1];
          if ((v0 < threshold) !== (v1 < threshold)) {
            const t = (threshold - v0) / (v1 - v0);
            const x = ((col + t) * cw).toFixed(1);
            const y = (row * ch).toFixed(1);
            d += `M${x},${(row * ch - 3).toFixed(1)}L${x},${(row * ch + 3).toFixed(1)}`;
          }
        }
      }
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col <= cols; col++) {
          const v0 = grid[row * (cols + 1) + col];
          const v1 = grid[(row + 1) * (cols + 1) + col];
          if ((v0 < threshold) !== (v1 < threshold)) {
            const t = (threshold - v0) / (v1 - v0);
            const x = (col * cw).toFixed(1);
            const y = ((row + t) * ch).toFixed(1);
            d += `M${(col * cw - 3).toFixed(1)},${y}L${(col * cw + 3).toFixed(1)},${y}`;
          }
        }
      }
      if (d) paths += `  <path d="${d}" stroke="${fg}" stroke-width="0.8" fill="none" opacity="0.7"/>\n`;
    }
    return paths;
  }
}
