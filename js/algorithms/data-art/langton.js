/**
 * Langton's Ant — a cellular automaton that appears chaotic then suddenly
 * builds a perfect highway. The emergence of order from chaos.
 */

import { Algorithm } from '../base.js';

const RULES = ['RL', 'RLR', 'LLRR', 'RLLR'];

export class Langton extends Algorithm {
  constructor(engine) {
    super(engine);
    this._grid = null;
    this._antX = 0;
    this._antY = 0;
    this._antDir = 0; // 0=up, 1=right, 2=down, 3=left
    this._stepsDone = 0;
    this._gridSize = 0;
    this._lastRule = -1;
    this._visitCount = null;
    this._maxVisit = 1;
  }

  get metadata() {
    return {
      name: "Langton's Ant",
      eq: 'turn → flip → move',
      cat: 'Data Art',
      desc: "A cellular automaton that appears chaotic for ~10000 steps then suddenly builds a perfect highway. The emergence of order from chaos — a metaphor for intelligence.",
    };
  }

  get params() {
    return [
      { id: 'lang_steps',    label: 'Steps',     min: 1000,  max: 200000, step: 1000 },
      { id: 'lang_rule',     label: 'Rule',      min: 0,     max: 3,      step: 1    },
      { id: 'lang_cellSize', label: 'Cell Size', min: 2,     max: 8,      step: 1    },
    ];
  }

  get detailParam() {
    return { id: 'lang_steps', min: 1000, max: 200000, step: 5000 };
  }

  get cursorMap() {
    return (mx, _my, s) => {
      s.lang_rule = Math.floor(mx * 3.99);
    };
  }

  _init(gridSize, rule) {
    this._gridSize = gridSize;
    const numStates = RULES[rule].length;
    this._grid = new Uint8Array(gridSize * gridSize);
    this._visitCount = new Uint32Array(gridSize * gridSize);
    this._antX = Math.floor(gridSize / 2);
    this._antY = Math.floor(gridSize / 2);
    this._antDir = 0;
    this._stepsDone = 0;
    this._maxVisit = 1;
    this._lastRule = rule;
  }

  _step(rule) {
    const ruleStr = RULES[rule];
    const numStates = ruleStr.length;
    const gs = this._gridSize;
    const idx = this._antY * gs + this._antX;
    const cellState = this._grid[idx];

    // Turn based on current cell state
    const turn = ruleStr[cellState];
    if (turn === 'R') {
      this._antDir = (this._antDir + 1) % 4;
    } else {
      this._antDir = (this._antDir + 3) % 4;
    }

    // Flip cell state
    this._grid[idx] = (cellState + 1) % numStates;
    this._visitCount[idx]++;
    if (this._visitCount[idx] > this._maxVisit) {
      this._maxVisit = this._visitCount[idx];
    }

    // Move
    const dx = [0, 1, 0, -1];
    const dy = [-1, 0, 1, 0];
    this._antX = ((this._antX + dx[this._antDir]) + gs) % gs;
    this._antY = ((this._antY + dy[this._antDir]) + gs) % gs;
    this._stepsDone++;
  }

  animate(s) {
    const rule = Math.max(0, Math.min(3, Math.round(s.lang_rule || 0)));
    if (rule !== this._lastRule) {
      this._grid = null;
    }
  }

  render(ctx, W, H, s) {
    const targetSteps = Math.max(1000, Math.min(200000, Math.round(s.lang_steps || 11000)));
    const rule = Math.max(0, Math.min(3, Math.round(s.lang_rule || 0)));
    const cellSize = Math.max(2, Math.min(8, Math.round(s.lang_cellSize || 3)));
    const fg = this.engine.fg(s);

    const gridSize = Math.floor(Math.min(W, H) / cellSize);

    if (!this._grid || rule !== this._lastRule || gridSize !== this._gridSize) {
      this._init(gridSize, rule);
    }

    // Run simulation
    if (this._stepsDone < targetSteps) {
      const batch = s.playing ? Math.min(2000, targetSteps - this._stepsDone) : (targetSteps - this._stepsDone);
      for (let i = 0; i < batch; i++) {
        this._step(rule);
        if (this._stepsDone >= targetSteps) break;
      }
    }

    // Parse fg color
    const r0 = parseInt(fg.slice(1, 3), 16) || 255;
    const g0 = parseInt(fg.slice(3, 5), 16) || 255;
    const b0 = parseInt(fg.slice(5, 7), 16) || 255;

    // Render as heatmap
    const gs = this._gridSize;
    const imgW = gs * cellSize;
    const imgH = gs * cellSize;
    const imgData = ctx.createImageData(imgW, imgH);
    const data = imgData.data;
    const logMax = Math.log(this._maxVisit + 1);

    for (let y = 0; y < gs; y++) {
      for (let x = 0; x < gs; x++) {
        const visits = this._visitCount[y * gs + x];
        if (visits > 0) {
          const brightness = Math.log(visits + 1) / logMax;
          const alpha = Math.min(255, Math.floor(brightness * 255));
          // Fill cell block
          for (let dy = 0; dy < cellSize; dy++) {
            for (let dx = 0; dx < cellSize; dx++) {
              const pi = ((y * cellSize + dy) * imgW + (x * cellSize + dx)) * 4;
              data[pi] = r0;
              data[pi + 1] = g0;
              data[pi + 2] = b0;
              data[pi + 3] = alpha;
            }
          }
        }
      }
    }

    const offscreen = new OffscreenCanvas(imgW, imgH);
    const octx = offscreen.getContext('2d');
    octx.putImageData(imgData, 0, 0);
    ctx.drawImage(offscreen, (W - imgW) / 2, (H - imgH) / 2);
  }
}
