/**
 * Perlin Worms — particles follow a noise field, leaving permanent trails.
 * Over time reveals the hidden topology of the noise field.
 * Like making wind visible, or neural pathways.
 */

import { Algorithm } from '../base.js';

// Simple value noise
function hash2(x, y) {
  let h = ((x * 1619) ^ (y * 31337)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

function noise2d(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return (hash2(ix, iy) * (1 - ux) + hash2(ix + 1, iy) * ux) * (1 - uy) +
         (hash2(ix, iy + 1) * (1 - ux) + hash2(ix + 1, iy + 1) * ux) * uy;
}

export class PerlinWorms extends Algorithm {
  constructor(engine) {
    super(engine);
    this._trails = null;
    this._lastKey = '';
  }

  get metadata() {
    return {
      name: 'Perlin Worms',
      eq: 'angle = noise(x, y) * 2pi',
      cat: 'Nature',
      desc: 'Particles follow an invisible noise field, leaving permanent trails. Reveals hidden topology — like wind lines, magnetic fields, or neural pathways.',
    };
  }

  get params() {
    return [
      { id: 'pw_count',      label: 'Worms',       min: 50,    max: 500,   step: 10    },
      { id: 'pw_length',     label: 'Trail Length', min: 100,   max: 2000,  step: 50    },
      { id: 'pw_noiseScale', label: 'Noise Scale',  min: 0.001, max: 0.01,  step: 0.001 },
      { id: 'pw_thickness',  label: 'Thickness',    min: 0.5,   max: 3,     step: 0.1   },
    ];
  }

  get detailParam() {
    return { id: 'pw_count', min: 50, max: 500, step: 25 };
  }

  get cursorMap() {
    return (mx, _my, s) => {
      s.pw_noiseScale = 0.001 + mx * 0.009;
    };
  }

  _generateTrails(W, H, count, length, noiseScale, timeOffset) {
    const trails = [];
    for (let i = 0; i < count; i++) {
      const trail = [];
      let x = Math.random() * W;
      let y = Math.random() * H;
      for (let step = 0; step < length; step++) {
        trail.push(x, y);
        const angle = noise2d(x * noiseScale + timeOffset * 0.1, y * noiseScale + timeOffset * 0.07) * Math.PI * 4;
        x += Math.cos(angle) * 1.5;
        y += Math.sin(angle) * 1.5;
        // Wrap
        if (x < 0) x += W;
        if (x >= W) x -= W;
        if (y < 0) y += H;
        if (y >= H) y -= H;
      }
      trails.push(trail);
    }
    return trails;
  }

  animate(s) {
    // Regenerate trails when playing (time changes the noise offset)
    if (s.playing) {
      this._trails = null;
    }
  }

  render(ctx, W, H, s) {
    const count = Math.max(50, Math.min(500, Math.round(s.pw_count || 150)));
    const length = Math.max(100, Math.min(2000, Math.round(s.pw_length || 500)));
    const noiseScale = Math.max(0.001, Math.min(0.01, s.pw_noiseScale || 0.004));
    const thickness = Math.max(0.5, Math.min(3, s.pw_thickness || 1));
    const fg = this.engine.fg();
    const t = s.time || 0;

    const key = `${count}_${length}_${noiseScale}_${Math.floor(t * 2)}`;
    if (!this._trails || key !== this._lastKey) {
      this._trails = this._generateTrails(W, H, count, length, noiseScale, t);
      this._lastKey = key;
    }

    ctx.strokeStyle = fg;
    ctx.lineWidth = thickness;
    ctx.globalAlpha = 0.15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const trail of this._trails) {
      ctx.beginPath();
      ctx.moveTo(trail[0], trail[1]);
      for (let i = 2; i < trail.length; i += 2) {
        ctx.lineTo(trail[i], trail[i + 1]);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}
