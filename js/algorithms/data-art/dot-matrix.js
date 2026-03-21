/**
 * Dot Matrix — variable-size dots on a grid, like the Stockhausen Kontakte poster.
 * Dot sizes are driven by noise, sine waves, radial gradient, diagonal bands, or binary.
 */

import { Algorithm } from '../base.js';

// ── Value noise ──────────────────────────────────────────────────────────────

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

function fbm2(x, y) {
  let val = 0, amp = 1, freq = 1, total = 0;
  for (let o = 0; o < 4; o++) {
    val += valueNoise(x * freq, y * freq) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / total;
}

export class DotMatrix extends Algorithm {
  get metadata() {
    return {
      name: 'Dot Matrix',
      eq: 'Grid + noise modulation',
      cat: 'Data Art',
      desc: 'Variable-size dots on a grid. Data made visible — like early computer printouts and electronic music scores.',
    };
  }

  get params() {
    return [
      { id: 'dm_cols',    label: 'Columns',  min: 10,  max: 80,  step: 1,   default: 30  },
      { id: 'dm_rows',    label: 'Rows',     min: 10,  max: 60,  step: 1,   default: 25  },
      { id: 'dm_maxSize', label: 'Max Size', min: 2,   max: 30,  step: 1,   default: 12  },
      { id: 'dm_pattern', label: 'Pattern',  min: 0,   max: 4,   step: 1,   default: 0   },
      { id: 'dm_spacing', label: 'Spacing',  min: 0.5, max: 2,   step: 0.1, default: 1   },
    ];
  }

  get detailParam() {
    return { id: 'dm_cols', min: 10, max: 80, step: 1 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.dm_pattern = Math.round(mx * 4);
      s.dm_maxSize = 2 + Math.round(my * 28);
    };
  }

  animate(s) {
    // time is advanced externally; used in render as offset
  }

  _patternValue(col, row, cols, rows, pattern, time, cx, cy) {
    const nx = col / cols;
    const ny = row / rows;
    switch (pattern) {
      case 0: // noise
        return fbm2(nx * 6 + time * 0.3, ny * 6 + time * 0.2);
      case 1: { // sine waves
        const t = time * 0.5;
        return (Math.sin(nx * Math.PI * 4 + t) * Math.cos(ny * Math.PI * 3 + t * 0.7) + 1) * 0.5;
      }
      case 2: { // radial gradient from center
        const dx = nx - 0.5;
        const dy = ny - 0.5;
        const r = Math.sqrt(dx * dx + dy * dy) * Math.SQRT2;
        const pulse = Math.sin(r * 8 - time * 1.5) * 0.5 + 0.5;
        return pulse * (1 - r * 0.5);
      }
      case 3: { // diagonal bands
        const diag = (nx + ny + time * 0.15) % 1;
        return Math.abs(Math.sin(diag * Math.PI * 6));
      }
      case 4: { // random binary (seeded by grid position)
        return hash2(col, row) > 0.4 ? 1 : 0;
      }
      default:
        return 0.5;
    }
  }

  render(ctx, W, H, s) {
    const cols    = Math.max(10, Math.min(80,  Math.round(s.dm_cols    ?? 30)));
    const rows    = Math.max(10, Math.min(60,  Math.round(s.dm_rows    ?? 25)));
    const maxSize = Math.max(2,  Math.min(30,  Math.round(s.dm_maxSize ?? 12)));
    const pattern = Math.max(0,  Math.min(4,   Math.round(s.dm_pattern ?? 0)));
    const spacing = Math.max(0.5, Math.min(2,  s.dm_spacing ?? 1));
    const time    = s.time ?? 0;
    const fg      = this.engine.fg(s);
    const bg      = this.engine.bg(s);
    const lw      = s.lineWeight ?? 1;

    const cellW = (W / cols) * spacing;
    const cellH = (H / rows) * spacing;
    const originX = (W - cellW * (cols - 1)) / 2;
    const originY = (H - cellH * (rows - 1)) / 2;

    ctx.save();

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const t = this._patternValue(col, row, cols, rows, pattern, time, W / 2, H / 2);
        // clamp to [0, 1]
        const v = Math.max(0, Math.min(1, t));
        const radius = v * maxSize;
        if (radius < 0.3) continue;

        const cx = originX + col * cellW;
        const cy = originY + row * cellH;

        // Vary between filled and hollow based on size
        const hollow = v < 0.25;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);

        if (hollow) {
          ctx.strokeStyle = fg;
          ctx.lineWidth = lw * 0.7;
          ctx.globalAlpha = 0.5 + v * 0.5;
          ctx.stroke();
        } else {
          ctx.fillStyle = fg;
          ctx.globalAlpha = 0.6 + v * 0.4;
          ctx.fill();
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
