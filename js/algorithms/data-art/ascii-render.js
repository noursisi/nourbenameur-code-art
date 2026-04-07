/**
 * ASCII Art — renders a pattern using text characters chosen by brightness.
 * The original computer art form. Characters selected by density of an underlying noise/wave field.
 */

import { Algorithm } from '../base.js';

// ── Character sets ────────────────────────────────────────────────────────────

const CHARSETS = [
  ' .:-=+*#%@',         // 0: full density ramp
  '0123456789',         // 1: numeric
  '01',                 // 2: binary
  ' \u2591\u2592\u2593\u2588', // 3: block characters ░▒▓█
];

// ── Value noise ───────────────────────────────────────────────────────────────

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

function brightness(col, row, cols, rows, pattern, time) {
  const nx = col / cols;
  const ny = row / rows;
  const t = time;
  switch (pattern) {
    case 0: // noise
      return fbm2(nx * 5 + t * 0.25, ny * 5 + t * 0.18);
    case 1: { // concentric circles
      const dx = nx - 0.5;
      const dy = ny - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      return (Math.sin(r * 10 - t * 1.2) + 1) * 0.5;
    }
    case 2: { // waves
      const wx = Math.sin(nx * Math.PI * 6 + t * 0.8);
      const wy = Math.cos(ny * Math.PI * 5 + t * 0.6);
      return (wx * wy + 1) * 0.5;
    }
    case 3: { // spiral
      const dx = nx - 0.5;
      const dy = ny - 0.5;
      const angle = Math.atan2(dy, dx);
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      return (Math.sin(angle * 4 + r * 8 - t * 1.5) + 1) * 0.5;
    }
    default:
      return 0.5;
  }
}

export class AsciiRender extends Algorithm {
  get metadata() {
    return {
      name: 'ASCII Art',
      eq: 'Characters as pixels',
      cat: 'Data Art',
      desc: 'Text characters as visual density — the original computer art form. Each character chosen by brightness.',
    };
  }

  get params() {
    return [
      { id: 'ascii_cols',      label: 'Columns',    min: 20,  max: 120, step: 5,  default: 60 },
      { id: 'ascii_charset',   label: 'Charset',    min: 0,   max: 3,   step: 1,  default: 0  },
      { id: 'ascii_pattern',   label: 'Pattern',    min: 0,   max: 3,   step: 1,  default: 0  },
      { id: 'ascii_fontSize',  label: 'Font Size',  min: 6,   max: 20,  step: 1,  default: 10 },
      { id: 'ascii_colorMode', label: 'Color Mode', min: 0,   max: 3,   step: 1,  default: 0  },
    ];
  }

  get detailParam() {
    return { id: 'ascii_cols', min: 20, max: 120, step: 5 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.ascii_pattern  = Math.round(mx * 3);
      s.ascii_fontSize = Math.round(6 + my * 14);
    };
  }

  animate(world) { const { state: s } = world;
    // time drives pattern drift
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const cols      = Math.max(20,  Math.min(120, Math.round(s.ascii_cols      ?? 60)));
    const charsetI  = Math.max(0,   Math.min(3,   Math.round(s.ascii_charset   ?? 0)));
    const pattern   = Math.max(0,   Math.min(3,   Math.round(s.ascii_pattern   ?? 0)));
    const fontSize  = Math.max(6,   Math.min(20,  Math.round(s.ascii_fontSize  ?? 10)));
    const colorMode = Math.max(0,   Math.min(3,   Math.round(s.ascii_colorMode ?? 0)));
    const time      = s.time ?? 0;
    const fg        = this.engine.fg(s);
    const charset   = CHARSETS[charsetI];

    // Derive rows from cols and aspect ratio
    const charAspect = 0.55; // typical monospace character width/height ratio
    const charW = W / cols;
    const charH = charW / charAspect;
    const rows = Math.ceil(H / charH);

    ctx.save();
    ctx.font = `${fontSize}px 'Courier New', Courier, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Set base fill color for modes that don't change per-character
    if (colorMode === 0) {
      ctx.fillStyle = fg;
    } else if (colorMode === 1) {
      ctx.fillStyle = '#33ff33';
    } else if (colorMode === 2) {
      ctx.fillStyle = '#ffaa33';
    }
    // mode 3 (rainbow) sets fillStyle per character below

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const b = brightness(col, row, cols, rows, pattern, time);
        const clamped = Math.max(0, Math.min(1, b));

        const charIdx = Math.floor(clamped * (charset.length - 1));
        const ch = charset[charIdx];
        if (ch === ' ') continue;

        const x = col * charW;
        const y = row * charH;

        if (colorMode === 3) {
          const hue = ((col / cols + row / rows * 0.5) * 360) % 360;
          ctx.fillStyle = `hsl(${hue.toFixed(1)},80%,65%)`;
        }

        ctx.globalAlpha = 0.5 + clamped * 0.5;
        ctx.fillText(ch, x, y);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
