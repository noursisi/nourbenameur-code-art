/**
 * Cellular Automata — Conway's Game of Life and variants.
 * Renders an evolving grid. Can be seeded randomly or from patterns.
 */

import { Algorithm } from '../base.js';

const RULES = [
  { name: 'Life', birth: [3], survive: [2, 3] },
  { name: 'HighLife', birth: [3, 6], survive: [2, 3] },
  { name: 'Day & Night', birth: [3, 6, 7, 8], survive: [3, 4, 6, 7, 8] },
  { name: 'Seeds', birth: [2], survive: [] },
  { name: 'Diamoeba', birth: [3, 5, 6, 7, 8], survive: [5, 6, 7, 8] },
];

export class CellularAutomata extends Algorithm {
  constructor(engine) {
    super(engine);
    this._grid = null;
    this._nextGrid = null;
    this._cols = 0;
    this._rows = 0;
    this._lastRule = -1;
    this._lastRes = 0;
    this._frameCount = 0;
    this._imageData = null;
  }

  get metadata() {
    return {
      name: 'Cellular Automata',
      eq: 'B/S rule notation',
      cat: 'Data Art',
      desc: 'Grid-based life simulation. Cells are born or die based on their neighbors. Multiple rulesets produce radically different emergent behavior.',
    };
  }

  get params() {
    return [
      { id: 'ca_resolution', label: 'Cell Size',   min: 2,  max: 16, step: 1   },
      { id: 'ca_rule',       label: 'Rule (0-4)',   min: 0,  max: 4,  step: 1   },
      { id: 'ca_fill',       label: 'Fill Density', min: 0.1, max: 0.8, step: 0.05 },
      { id: 'ca_speed',      label: 'Step Rate',    min: 1,  max: 10, step: 1   },
    ];
  }

  get detailParam() {
    return { id: 'ca_resolution', min: 2, max: 16, step: 1 };
  }

  _initGrid(cols, rows, fill) {
    this._cols = cols;
    this._rows = rows;
    this._grid = new Uint8Array(cols * rows);
    this._nextGrid = new Uint8Array(cols * rows);
    // Random fill
    for (let i = 0; i < cols * rows; i++) {
      this._grid[i] = Math.random() < fill ? 1 : 0;
    }
    this._frameCount = 0;
  }

  _step(ruleIdx) {
    const rule = RULES[Math.min(ruleIdx, RULES.length - 1)];
    const cols = this._cols;
    const rows = this._rows;
    const birth = new Set(rule.birth);
    const survive = new Set(rule.survive);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = (x + dx + cols) % cols;
            const ny = (y + dy + rows) % rows;
            neighbors += this._grid[ny * cols + nx];
          }
        }
        const alive = this._grid[y * cols + x];
        if (alive) {
          this._nextGrid[y * cols + x] = survive.has(neighbors) ? 1 : 0;
        } else {
          this._nextGrid[y * cols + x] = birth.has(neighbors) ? 1 : 0;
        }
      }
    }

    // Swap
    [this._grid, this._nextGrid] = [this._nextGrid, this._grid];
  }

  animate(world) { const { state: s } = world;
    if (!this._grid) return;
    const speed = Math.round(s.ca_speed ?? 3);
    const ruleIdx = Math.round(s.ca_rule ?? 0);
    this._frameCount++;
    if (this._frameCount % Math.max(1, 11 - speed) === 0) {
      this._step(ruleIdx);
    }
  }

  randomize(state, setFn) {
    // Re-seed on randomize
    this._grid = null;
    super.randomize(state, setFn);
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const res = Math.max(2, Math.round(s.ca_resolution ?? 4));
    const ruleIdx = Math.round(s.ca_rule ?? 0);
    const fill = s.ca_fill ?? 0.3;

    const cols = Math.floor(W / res);
    const rows = Math.floor(H / res);

    // Re-init if size or rule changed
    if (!this._grid || cols !== this._cols || rows !== this._rows ||
        ruleIdx !== this._lastRule || res !== this._lastRes) {
      this._initGrid(cols, rows, fill);
      this._lastRule = ruleIdx;
      this._lastRes = res;
    }

    const bg = this.engine.bg(s);
    const fg = this.engine.fg(s);
    const camZoom = s.camZoom ?? 1;

    if (!s.transparent) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2 + (s.camPanX || 0), -H / 2 + (s.camPanY || 0));

    // Use ImageData for performance
    if (!this._imageData || this._imageData.width !== W || this._imageData.height !== H) {
      this._imageData = ctx.createImageData(W, H);
    }
    const data = this._imageData.data;

    // Parse bg and fg colors
    const bgC = parseColor(bg);
    const fgC = parseColor(fg);

    // Clear to background
    for (let i = 0; i < data.length; i += 4) {
      data[i] = bgC[0];
      data[i + 1] = bgC[1];
      data[i + 2] = bgC[2];
      data[i + 3] = s.transparent ? 0 : 255;
    }

    // Draw live cells
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (this._grid[y * cols + x]) {
          const px = x * res;
          const py = y * res;
          for (let dy = 0; dy < res && py + dy < H; dy++) {
            for (let dx = 0; dx < res && px + dx < W; dx++) {
              const idx = ((py + dy) * W + px + dx) * 4;
              data[idx] = fgC[0];
              data[idx + 1] = fgC[1];
              data[idx + 2] = fgC[2];
              data[idx + 3] = 255;
            }
          }
        }
      }
    }

    ctx.putImageData(this._imageData, 0, 0);
    ctx.restore();
  }
}

function parseColor(hex) {
  if (!hex || hex[0] !== '#') return [0, 0, 0];
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
