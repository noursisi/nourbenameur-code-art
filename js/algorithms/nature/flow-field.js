/**
 * Flow Field — noise-based particle trails.
 * Uses a hash-based value noise function (no external dependency).
 */

import { Algorithm } from '../base.js';

// ── Inline value noise ──────────────────────────────────────────────────────

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
  // Smooth step
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const v00 = hash2(ix,     iy);
  const v10 = hash2(ix + 1, iy);
  const v01 = hash2(ix,     iy + 1);
  const v11 = hash2(ix + 1, iy + 1);
  return v00 + (v10 - v00) * ux + (v01 - v00) * uy + (v00 - v10 - v01 + v11) * ux * uy;
}

function noise(x, y) {
  return valueNoise(x, y) * 2 - 1; // remap to [-1, 1]
}

export class FlowField extends Algorithm {
  get metadata() {
    return {
      name: 'Flow Field',
      eq: 'θ(x,y) = noise(x·s, y·s)',
      cat: 'Nature',
      desc: 'Particles follow angles derived from a 2D value noise field, forming organic flow patterns that evolve over time.',
    };
  }

  get params() {
    return [
      { id: 'flow_scale',     label: 'Noise Scale',  min: 0.001, max: 0.02,  step: 0.001 },
      { id: 'flow_particles', label: 'Particles',    min: 500,   max: 10000, step: 200   },
      { id: 'flow_length',    label: 'Trail Length', min: 5,     max: 100,   step: 1     },
    ];
  }

  get detailParam() {
    return { id: 'flow_particles', min: 500, max: 10000, step: 300 };
  }

  get cursorMap() {
    return (mx, _my, s) => {
      s.flow_scale = 0.001 + mx * 0.019;
    };
  }

  animate(_s) {}

  render(ctx, W, H, s) {
    const scale  = Math.max(0.001, s.flow_scale);
    const nParts = Math.max(500, Math.min(10000, Math.round(s.flow_particles)));
    const length = Math.max(5, Math.min(100, Math.round(s.flow_length)));
    const timeOff = (s.time || 0) * 0.4;
    const fg = this.engine.fg();

    ctx.strokeStyle = fg;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.45;
    ctx.lineCap = 'round';

    // Seed RNG from particle index for stable but varied starts
    for (let i = 0; i < nParts; i++) {
      // Deterministic start position spread across canvas
      const seed = i * 1.618033988;
      let px = ((seed * 1000) % 1) * W;
      let py = ((seed * 10000) % 1) * H;

      ctx.beginPath();
      ctx.moveTo(px, py);

      for (let j = 0; j < length; j++) {
        const nx = px * scale;
        const ny = py * scale;
        // Use two noise calls for richer directional variety
        const angle = noise(nx + timeOff, ny) * Math.PI * 2;
        px += Math.cos(angle) * 2.5;
        py += Math.sin(angle) * 2.5;
        if (px < 0 || px > W || py < 0 || py > H) break;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}
