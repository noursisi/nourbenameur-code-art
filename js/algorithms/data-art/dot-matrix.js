/**
 * Dot Matrix — variable-size dots on a grid, like the Stockhausen Kontakte poster.
 * Dot sizes are driven by noise, sine waves, radial gradient, diagonal bands, binary,
 * spiral, interference, or organic FBM.
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

// 3-octave FBM with time offset, used for organic pattern
function fbm3(x, y, t) {
  let val = 0, amp = 1, freq = 1, total = 0;
  for (let o = 0; o < 3; o++) {
    val += valueNoise(x * freq + t * 0.1 * freq, y * freq + t * 0.07 * freq) * amp;
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
      { id: 'dm_cols',      label: 'Columns',  min: 10,  max: 80,  step: 1,   default: 30  },
      { id: 'dm_rows',      label: 'Rows',     min: 10,  max: 60,  step: 1,   default: 25  },
      { id: 'dm_maxSize',   label: 'Max Size', min: 2,   max: 30,  step: 1,   default: 12  },
      { id: 'dm_pattern',   label: 'Pattern',  min: 0,   max: 7,   step: 1,   default: 0   },
      { id: 'dm_spacing',   label: 'Spacing',  min: 0.5, max: 2,   step: 0.1, default: 1   },
      { id: 'dm_colorMode', label: 'Color',    min: 0,   max: 3,   step: 1,   default: 0   },
      { id: 'dm_shape',     label: 'Shape',    min: 0,   max: 3,   step: 1,   default: 0   },
      { id: 'dm_invert',    label: 'Invert',   min: 0,   max: 1,   step: 1,   default: 0   },
      { id: 'dm_animSpeed', label: 'Speed',    min: 0.1, max: 5,   step: 0.1, default: 1   },
    ];
  }

  get detailParam() {
    return { id: 'dm_cols', min: 10, max: 80, step: 1 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.dm_pattern = Math.round(mx * 7);
      s.dm_maxSize = 2 + Math.round(my * 28);
    };
  }

  animate(world) {
    // time is advanced externally; used in render as offset
  }

  _patternValue(col, row, cols, rows, pattern, time) {
    const nx = col / cols;
    const ny = row / rows;
    switch (pattern) {
      case 0: // noise FBM
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
      case 5: { // spiral
        const dx = col - cols / 2;
        const dy = row - rows / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        return (Math.sin(dist * 0.3 - angle * 2 + time) + 1) / 2;
      }
      case 6: { // interference (two sources)
        const d1 = Math.sqrt((col - cols * 0.3) ** 2 + (row - rows * 0.3) ** 2);
        const d2 = Math.sqrt((col - cols * 0.7) ** 2 + (row - rows * 0.7) ** 2);
        return (Math.sin(d1 * 0.5 + time) + Math.sin(d2 * 0.5 + time) + 2) / 4;
      }
      case 7: { // organic FBM with time
        return fbm3(col * 0.08, row * 0.08, time * 0.3);
      }
      default:
        return 0.5;
    }
  }

  _dotColor(col, row, cols, rows, value, colorMode, time, fg) {
    switch (colorMode) {
      case 0: // mono
        return fg;
      case 1: { // position gradient
        const hue = ((col / cols) * 180 + (row / rows) * 180) % 360;
        return `hsl(${hue}, 70%, ${50 + value * 30}%)`;
      }
      case 2: { // value gradient (blue -> red)
        const hue = value * 240;
        return `hsl(${hue}, 80%, 55%)`;
      }
      case 3: { // rainbow time-shifted
        const hue = ((col + row) * 5 + time * 50) % 360;
        return `hsla(${hue}, 75%, 55%, ${0.3 + value * 0.7})`;
      }
      default:
        return fg;
    }
  }

  _drawShape(ctx, cx, cy, r, shape) {
    const w = r * 0.35;
    switch (shape) {
      case 0: // circle
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        break;
      case 1: // square
        ctx.rect(cx - r, cy - r, r * 2, r * 2);
        break;
      case 2: // diamond
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        break;
      case 3: // cross
        ctx.rect(cx - w, cy - r, w * 2, r * 2);
        ctx.rect(cx - r, cy - w, r * 2, w * 2);
        break;
    }
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const cols      = Math.max(10, Math.min(80, Math.round(s.dm_cols    ?? 30)));
    const rows      = Math.max(10, Math.min(60, Math.round(s.dm_rows    ?? 25)));
    const maxSize   = Math.max(2,  Math.min(30, Math.round(s.dm_maxSize ?? 12)));
    const pattern   = Math.max(0,  Math.min(7,  Math.round(s.dm_pattern ?? 0)));
    const spacing   = Math.max(0.5, Math.min(2, s.dm_spacing  ?? 1));
    const colorMode = Math.max(0,  Math.min(3,  Math.round(s.dm_colorMode ?? 0)));
    const shape     = Math.max(0,  Math.min(3,  Math.round(s.dm_shape     ?? 0)));
    const invert    = Math.round(s.dm_invert    ?? 0);
    const animSpeed = Math.max(0.1, Math.min(5, s.dm_animSpeed ?? 1));
    const time      = (s.time ?? 0) * animSpeed;
    const fg        = this.engine.fg(s);
    const lw        = s.lineWeight ?? 1;

    const cellW = (W / cols) * spacing;
    const cellH = (H / rows) * spacing;
    const originX = (W - cellW * (cols - 1)) / 2;
    const originY = (H - cellH * (rows - 1)) / 2;

    ctx.save();

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let v = this._patternValue(col, row, cols, rows, pattern, time);
        v = Math.max(0, Math.min(1, v));

        if (invert) v = 1 - v;

        const radius = v * maxSize;
        if (radius < 0.3) continue;

        const cx = originX + col * cellW;
        const cy = originY + row * cellH;
        const hollow = v < 0.25;
        const dotColor = this._dotColor(col, row, cols, rows, v, colorMode, time, fg);

        ctx.beginPath();
        this._drawShape(ctx, cx, cy, radius, shape);

        if (hollow) {
          ctx.strokeStyle = dotColor;
          ctx.lineWidth = lw * 0.7;
          ctx.globalAlpha = 0.5 + v * 0.5;
          ctx.stroke();
        } else {
          ctx.fillStyle = dotColor;
          ctx.globalAlpha = 0.6 + v * 0.4;
          ctx.fill();
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  collectSVG(world) {
    const { W, H, state: s } = world;
    const cols      = Math.max(10, Math.min(80, Math.round(s.dm_cols    ?? 30)));
    const rows      = Math.max(10, Math.min(60, Math.round(s.dm_rows    ?? 25)));
    const maxSize   = Math.max(2,  Math.min(30, Math.round(s.dm_maxSize ?? 12)));
    const pattern   = Math.max(0,  Math.min(7,  Math.round(s.dm_pattern ?? 0)));
    const spacing   = Math.max(0.5, Math.min(2, s.dm_spacing  ?? 1));
    const colorMode = Math.max(0,  Math.min(3,  Math.round(s.dm_colorMode ?? 0)));
    const shape     = Math.max(0,  Math.min(3,  Math.round(s.dm_shape     ?? 0)));
    const invert    = Math.round(s.dm_invert    ?? 0);
    const animSpeed = Math.max(0.1, Math.min(5, s.dm_animSpeed ?? 1));
    const time      = (s.time ?? 0) * animSpeed;
    const fg        = this.engine.fg(s);

    const cellW = (W / cols) * spacing;
    const cellH = (H / rows) * spacing;
    const originX = (W - cellW * (cols - 1)) / 2;
    const originY = (H - cellH * (rows - 1)) / 2;

    const elements = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let v = this._patternValue(col, row, cols, rows, pattern, time);
        v = Math.max(0, Math.min(1, v));

        if (invert) v = 1 - v;

        const radius = v * maxSize;
        if (radius < 0.3) continue;

        const cx = originX + col * cellW;
        const cy = originY + row * cellH;
        const hollow = v < 0.25;
        const dotColor = this._dotColor(col, row, cols, rows, v, colorMode, time, fg);
        const alpha = hollow ? (0.5 + v * 0.5) : (0.6 + v * 0.4);
        const opacity = alpha.toFixed(3);
        const w = radius * 0.35;

        if (hollow) {
          // stroke only
          switch (shape) {
            case 0:
              elements.push(
                `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${radius.toFixed(2)}" fill="none" stroke="${dotColor}" stroke-width="0.7" opacity="${opacity}"/>`
              );
              break;
            case 1:
              elements.push(
                `<rect x="${(cx - radius).toFixed(2)}" y="${(cy - radius).toFixed(2)}" width="${(radius * 2).toFixed(2)}" height="${(radius * 2).toFixed(2)}" fill="none" stroke="${dotColor}" stroke-width="0.7" opacity="${opacity}"/>`
              );
              break;
            case 2: {
              const pts = `${cx.toFixed(2)},${(cy - radius).toFixed(2)} ${(cx + radius).toFixed(2)},${cy.toFixed(2)} ${cx.toFixed(2)},${(cy + radius).toFixed(2)} ${(cx - radius).toFixed(2)},${cy.toFixed(2)}`;
              elements.push(
                `<polygon points="${pts}" fill="none" stroke="${dotColor}" stroke-width="0.7" opacity="${opacity}"/>`
              );
              break;
            }
            case 3:
              elements.push(
                `<rect x="${(cx - w).toFixed(2)}" y="${(cy - radius).toFixed(2)}" width="${(w * 2).toFixed(2)}" height="${(radius * 2).toFixed(2)}" fill="none" stroke="${dotColor}" stroke-width="0.7" opacity="${opacity}"/>`,
                `<rect x="${(cx - radius).toFixed(2)}" y="${(cy - w).toFixed(2)}" width="${(radius * 2).toFixed(2)}" height="${(w * 2).toFixed(2)}" fill="none" stroke="${dotColor}" stroke-width="0.7" opacity="${opacity}"/>`
              );
              break;
          }
        } else {
          // filled
          switch (shape) {
            case 0:
              elements.push(
                `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${radius.toFixed(2)}" fill="${dotColor}" opacity="${opacity}"/>`
              );
              break;
            case 1:
              elements.push(
                `<rect x="${(cx - radius).toFixed(2)}" y="${(cy - radius).toFixed(2)}" width="${(radius * 2).toFixed(2)}" height="${(radius * 2).toFixed(2)}" fill="${dotColor}" opacity="${opacity}"/>`
              );
              break;
            case 2: {
              const pts = `${cx.toFixed(2)},${(cy - radius).toFixed(2)} ${(cx + radius).toFixed(2)},${cy.toFixed(2)} ${cx.toFixed(2)},${(cy + radius).toFixed(2)} ${(cx - radius).toFixed(2)},${cy.toFixed(2)}`;
              elements.push(
                `<polygon points="${pts}" fill="${dotColor}" opacity="${opacity}"/>`
              );
              break;
            }
            case 3:
              elements.push(
                `<rect x="${(cx - w).toFixed(2)}" y="${(cy - radius).toFixed(2)}" width="${(w * 2).toFixed(2)}" height="${(radius * 2).toFixed(2)}" fill="${dotColor}" opacity="${opacity}"/>`,
                `<rect x="${(cx - radius).toFixed(2)}" y="${(cy - w).toFixed(2)}" width="${(radius * 2).toFixed(2)}" height="${(w * 2).toFixed(2)}" fill="${dotColor}" opacity="${opacity}"/>`
              );
              break;
          }
        }
      }
    }

    return elements.join('\n');
  }
}
