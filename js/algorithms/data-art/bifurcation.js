/**
 * Bifurcation Diagram — the route to chaos.
 * Plots where x → r*x*(1-x) converges as r increases.
 * Period-doubling cascade into chaos with windows of order.
 */

import { Algorithm } from '../base.js';

export class Bifurcation extends Algorithm {
  get metadata() {
    return {
      name: 'Bifurcation',
      eq: 'x(n+1) = r * x(n) * (1 - x(n))',
      cat: 'Data Art',
      desc: 'The logistic map bifurcation diagram — the exact boundary where determinism becomes chaos. Period-doubling cascade, self-similar structure, windows of order within chaos.',
    };
  }

  get params() {
    return [
      { id: 'bif_rMin',       label: 'r Min',       min: 2.5,  max: 3.5,  step: 0.01  },
      { id: 'bif_rMax',       label: 'r Max',       min: 3.5,  max: 4.0,  step: 0.01  },
      { id: 'bif_iterations', label: 'Iterations',  min: 200,  max: 2000, step: 50    },
      { id: 'bif_skip',       label: 'Skip',        min: 100,  max: 500,  step: 50    },
    ];
  }

  get detailParam() {
    return { id: 'bif_iterations', min: 200, max: 2000, step: 100 };
  }

  get cursorMap() {
    return (mx, _my, s) => {
      // Zoom into a subrange based on cursor
      const center = 2.5 + mx * 1.5;
      const width = 0.3;
      s.bif_rMin = Math.max(2.5, center - width);
      s.bif_rMax = Math.min(4.0, center + width);
    };
  }

  animate(s) {
    // Subtle time-based shift of the view range
  }

  render(ctx, W, H, s) {
    const rMin = Math.max(2.5, Math.min(3.99, s.bif_rMin || 2.5));
    const rMax = Math.max(rMin + 0.01, Math.min(4.0, s.bif_rMax || 4.0));
    const iterations = Math.max(200, Math.min(2000, Math.round(s.bif_iterations || 500)));
    const skip = Math.max(100, Math.min(500, Math.round(s.bif_skip || 200)));
    const fg = this.engine.fg(s);

    const gridW = Math.min(W, 800);
    const gridH = Math.min(H, 800);
    const density = new Float32Array(gridW * gridH);
    let maxDensity = 0;

    // For each column, compute the logistic map
    for (let col = 0; col < gridW; col++) {
      const r = rMin + (col / gridW) * (rMax - rMin);
      let x = 0.5; // Initial condition

      // Skip transient
      for (let i = 0; i < skip; i++) {
        x = r * x * (1 - x);
      }

      // Plot steady-state values
      for (let i = 0; i < iterations; i++) {
        x = r * x * (1 - x);
        const row = Math.floor((1 - x) * (gridH - 1));
        if (row >= 0 && row < gridH) {
          const idx = row * gridW + col;
          density[idx]++;
          if (density[idx] > maxDensity) maxDensity = density[idx];
        }
      }
    }

    if (maxDensity === 0) return;

    // Parse fg color
    const r0 = parseInt(fg.slice(1, 3), 16) || 255;
    const g0 = parseInt(fg.slice(3, 5), 16) || 255;
    const b0 = parseInt(fg.slice(5, 7), 16) || 255;

    const imgData = ctx.createImageData(gridW, gridH);
    const data = imgData.data;
    const logMax = Math.log(maxDensity + 1);

    for (let i = 0; i < gridW * gridH; i++) {
      if (density[i] > 0) {
        const brightness = Math.log(density[i] + 1) / logMax;
        const alpha = Math.min(255, Math.floor(brightness * 255 * 2));
        data[i * 4] = r0;
        data[i * 4 + 1] = g0;
        data[i * 4 + 2] = b0;
        data[i * 4 + 3] = alpha;
      }
    }

    const offscreen = new OffscreenCanvas(gridW, gridH);
    const octx = offscreen.getContext('2d');
    octx.putImageData(imgData, 0, 0);
    ctx.drawImage(offscreen, (W - gridW) / 2, (H - gridH) / 2);
  }
}
