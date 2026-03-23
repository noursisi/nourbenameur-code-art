/**
 * Pixel Dissolve — scattered rectangles at various sizes dissolving across the canvas.
 * Like digital data fragmenting — corrupted memory, decomposing images.
 */

import { Algorithm } from '../base.js';

// ── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class PixelDissolve extends Algorithm {
  get metadata() {
    return {
      name: 'Pixel Dissolve',
      eq: 'Fragmented grid',
      cat: 'Data Art',
      desc: 'Digital fragments scattering — data dissolving into discrete blocks. Like corrupted memory or decomposing images.',
    };
  }

  get params() {
    return [
      { id: 'pd_density',   label: 'Density',    min: 10,  max: 200, step: 5,    default: 80   },
      { id: 'pd_minSize',   label: 'Min Size',   min: 2,   max: 10,  step: 1,    default: 3    },
      { id: 'pd_maxSize',   label: 'Max Size',   min: 10,  max: 60,  step: 2,    default: 30   },
      { id: 'pd_scatter',   label: 'Scatter',    min: 0,   max: 1,   step: 0.05, default: 0.3  },
      { id: 'pd_fillRatio', label: 'Fill Ratio', min: 0.1, max: 1,   step: 0.05, default: 0.7  },
    ];
  }

  get detailParam() {
    return { id: 'pd_density', min: 10, max: 200, step: 5 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.pd_scatter = mx;
      s.pd_maxSize = 10 + Math.round(my * 50);
    };
  }

  animate(world) { const { state: s } = world;
    // time drives per-block drift in render
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const density   = Math.max(10,  Math.min(200, Math.round(s.pd_density   ?? 80)));
    const minSize   = Math.max(2,   Math.min(10,  Math.round(s.pd_minSize   ?? 3)));
    const maxSize   = Math.max(10,  Math.min(60,  Math.round(s.pd_maxSize   ?? 30)));
    const scatter   = Math.max(0,   Math.min(1,   s.pd_scatter   ?? 0.3));
    const fillRatio = Math.max(0.1, Math.min(1,   s.pd_fillRatio ?? 0.7));
    const time      = s.time ?? 0;
    const fg        = this.engine.fg(s);
    const lw        = s.lineWeight ?? 1;

    // Use a seeded random so the layout is consistent frame-to-frame
    // (only drifts slowly with time, not re-randomised every frame)
    const seed = 12345;
    const rng = mulberry32(seed);

    ctx.save();

    for (let i = 0; i < density; i++) {
      const r0 = rng();
      const r1 = rng();
      const r2 = rng();
      const r3 = rng();
      const r4 = rng();

      const sizeRange = maxSize - minSize;
      const size = minSize + r2 * sizeRange;

      // Base position on a loose grid, then offset by scatter
      const gridCols = Math.ceil(Math.sqrt(density * (W / H)));
      const gridRows = Math.ceil(density / gridCols);
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      const gx = (col + 0.5) / gridCols * W;
      const gy = (row + 0.5) / gridRows * H;

      const scatterX = (r0 - 0.5) * W * scatter;
      const scatterY = (r1 - 0.5) * H * scatter;

      // Slow drift with time
      const driftX = Math.sin(time * 0.4 + r3 * Math.PI * 2) * size * 0.6;
      const driftY = Math.cos(time * 0.3 + r4 * Math.PI * 2) * size * 0.4;

      const x = gx + scatterX + driftX;
      const y = gy + scatterY + driftY;

      // Skip filled blocks based on fillRatio (use phase of drift for variation)
      const phase = Math.sin(time * 0.2 + r3 * 10) * 0.5 + 0.5;
      const alpha = 0.3 + phase * 0.6;

      if (r3 > fillRatio) {
        // Hollow / outline block
        ctx.strokeStyle = fg;
        ctx.lineWidth = lw * 0.8;
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeRect(x - size / 2, y - size / 2, size, size);
      } else {
        // Filled block
        ctx.fillStyle = fg;
        ctx.globalAlpha = alpha;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
