/**
 * Clifford Strange Attractor
 * x' = sin(a*y) + c*cos(a*x)
 * y' = sin(b*x) + d*cos(b*y)
 */

import { Algorithm } from '../base.js';

export class Attractor extends Algorithm {
  get metadata() {
    return {
      name: 'Clifford Attractor',
      eq: "x'=sin(ay)+c*cos(ax), y'=sin(bx)+d*cos(by)",
      cat: 'Nature',
      desc: 'A strange attractor defined by four parameters. Small changes create wildly different fractal patterns.',
    };
  }

  get params() {
    return [
      { id: 'att_a',      label: 'a',      min: -3,    max: 3,      step: 0.01    },
      { id: 'att_b',      label: 'b',      min: -3,    max: 3,      step: 0.01    },
      { id: 'att_c',      label: 'c',      min: -3,    max: 3,      step: 0.01    },
      { id: 'att_d',      label: 'd',      min: -3,    max: 3,      step: 0.01    },
      { id: 'att_points', label: 'Points', min: 10000, max: 300000, step: 10000   },
    ];
  }

  get detailParam() {
    return { id: 'att_points', min: 10000, max: 300000, step: 10000 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.att_a = -3 + mx * 6;
      s.att_b = -3 + my * 6;
    };
  }

  animate(s) {
    const t = s.time;
    s.att_a = -1.7 + Math.sin(t * 0.11) * 1.5 + Math.cos(t * 0.07) * 0.6;
    s.att_b =  1.3 + Math.cos(t * 0.09) * 1.4 + Math.sin(t * 0.13) * 0.5;
    s.att_c = -0.1 + Math.sin(t * 0.17) * 1.2;
    s.att_d = -1.21 + Math.cos(t * 0.13) * 1.1 + Math.sin(t * 0.19) * 0.4;
  }

  render(ctx, W, H, s) {
    const a = s.att_a, b = s.att_b, c = s.att_c, d = s.att_d;
    const n = Math.max(10000, Math.min(300000, Math.round(s.att_points)));
    const fg = this.engine.fg();
    const zoom = s.camZoom || 1;
    const panX = s.camPanX || 0;
    const panY = s.camPanY || 0;

    // Iterate attractor and collect points + bounds
    let px = 0.1, py = 0.1;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const nx = Math.sin(a * py) + c * Math.cos(a * px);
      const ny = Math.sin(b * px) + d * Math.cos(b * py);
      px = nx; py = ny;
      xs[i] = px; ys[i] = py;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    // Auto-fit to canvas
    const bW = maxX - minX || 1;
    const bH = maxY - minY || 1;
    const scale = Math.min(W * 0.85 / bW, H * 0.85 / bH) * zoom;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // Draw points
    ctx.fillStyle = fg;
    ctx.globalAlpha = Math.max(0.03, Math.min(0.6, 8000 / n));

    for (let i = 0; i < n; i++) {
      const sx = W / 2 + (xs[i] - cx) * scale + panX;
      const sy = H / 2 + (ys[i] - cy) * scale + panY;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    ctx.globalAlpha = 1;
  }
}
