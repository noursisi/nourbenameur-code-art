/**
 * Diffusion Limited Aggregation — particles random-walk until they stick.
 * Creates crystal/coral/lightning growth patterns.
 */

import { Algorithm } from '../base.js';

export class DLA extends Algorithm {
  constructor(engine) {
    super(engine);
    this._grid = null;
    this._gridW = 0;
    this._gridH = 0;
    this._particles = 0;
    this._placed = 0;
    this._lastParams = '';
  }

  get metadata() {
    return {
      name: 'DLA Growth',
      eq: 'random walk → stick on contact',
      cat: 'Nature',
      desc: 'Diffusion Limited Aggregation: particles random-walk from edges and stick when touching existing structure. Creates frost, coral, and dendrite crystal patterns.',
    };
  }

  get params() {
    return [
      { id: 'dla_particles',   label: 'Particles',   min: 1000,  max: 20000,  step: 500  },
      { id: 'dla_stickiness',  label: 'Stickiness',  min: 0.1,   max: 1,      step: 0.05 },
      { id: 'dla_branchWidth', label: 'Branch Width', min: 1,     max: 5,      step: 0.5  },
    ];
  }

  get detailParam() {
    return { id: 'dla_particles', min: 1000, max: 20000, step: 1000 };
  }

  get cursorMap() {
    return (mx, _my, s) => {
      s.dla_stickiness = 0.1 + mx * 0.9;
    };
  }

  _initGrid(W, H) {
    this._gridW = Math.min(W, 400);
    this._gridH = Math.min(H, 400);
    this._grid = new Uint8Array(this._gridW * this._gridH);
    this._placed = 0;
    // Seed at center
    const cx = Math.floor(this._gridW / 2);
    const cy = Math.floor(this._gridH / 2);
    this._grid[cy * this._gridW + cx] = 1;
    this._placed = 1;
  }

  _hasNeighbor(x, y) {
    const w = this._gridW;
    const h = this._gridH;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && this._grid[ny * w + nx]) return true;
      }
    }
    return false;
  }

  _growParticles(count, stickiness) {
    const w = this._gridW;
    const h = this._gridH;
    let added = 0;

    for (let p = 0; p < count; p++) {
      // Start from random edge
      let x, y;
      const side = Math.random() * 4 | 0;
      if (side === 0) { x = Math.random() * w | 0; y = 0; }
      else if (side === 1) { x = Math.random() * w | 0; y = h - 1; }
      else if (side === 2) { x = 0; y = Math.random() * h | 0; }
      else { x = w - 1; y = Math.random() * h | 0; }

      let steps = 0;
      const maxSteps = (w + h) * 3;
      while (steps < maxSteps) {
        steps++;
        // Random walk
        x += (Math.random() * 3 | 0) - 1;
        y += (Math.random() * 3 | 0) - 1;
        if (x < 0 || x >= w || y < 0 || y >= h) break;
        if (this._grid[y * w + x]) break; // already occupied

        if (this._hasNeighbor(x, y) && Math.random() < stickiness) {
          this._grid[y * w + x] = 1;
          this._placed++;
          added++;
          break;
        }
      }
    }
    return added;
  }

  animate(s) {
    const paramKey = `${s.dla_particles}_${s.dla_stickiness}_${s.dla_branchWidth}`;
    if (paramKey !== this._lastParams) {
      this._grid = null;
      this._lastParams = paramKey;
    }
  }

  render(ctx, W, H, s) {
    const targetParticles = Math.max(1000, Math.min(20000, Math.round(s.dla_particles || 5000)));
    const stickiness = Math.max(0.1, Math.min(1, s.dla_stickiness || 0.5));
    const branchWidth = Math.max(1, Math.min(5, s.dla_branchWidth || 2));
    const fg = this.engine.fg();

    if (!this._grid) {
      this._initGrid(W, H);
    }

    // Grow incrementally
    if (this._placed < targetParticles) {
      const batch = s.playing ? Math.min(200, targetParticles - this._placed) : Math.min(targetParticles - this._placed, 2000);
      this._growParticles(batch, stickiness);
    }

    // Render grid
    const gw = this._gridW;
    const gh = this._gridH;
    const scaleX = W / gw;
    const scaleY = H / gh;

    ctx.fillStyle = fg;
    const bw = Math.max(branchWidth * scaleX, 1);
    const bh = Math.max(branchWidth * scaleY, 1);

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        if (this._grid[y * gw + x]) {
          ctx.fillRect(x * scaleX - bw / 2, y * scaleY - bh / 2, bw, bh);
        }
      }
    }
  }
}
