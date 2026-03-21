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
      eq: "x'=sin(ay)+c·cos(ax), y'=sin(bx)+d·cos(by)",
      cat: 'Nature',
      desc: 'A strange attractor defined by four parameters. Small changes to a, b, c, d create wildly different fractal dust patterns.',
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
    s.att_a = (s.att_a || -1.7) + Math.sin(s.time * 0.05) * 0.003;
    s.att_b = (s.att_b ||  1.3) + Math.cos(s.time * 0.07) * 0.003;
  }

  render(ctx, W, H, s) {
    const a = s.att_a;
    const b = s.att_b;
    const c = s.att_c;
    const d = s.att_d;
    const n = Math.max(10000, Math.min(300000, Math.round(s.att_points)));
    const fg = this.engine.fg();
    const camZoom = s.camZoom || 1;
    const panX = s.camPanX || 0;
    const panY = s.camPanY || 0;

    // First pass: collect points and compute bounds
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    let px = 0, py = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

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

    const bW = maxX - minX || 1;
    const bH = maxY - minY || 1;
    const fitW = W * 0.88;
    const fitH = H * 0.88;
    const scale = Math.min(fitW / bW, fitH / bH);

    const offsetX = W / 2 - ((minX + maxX) / 2) * scale + panX;
    const offsetY = H / 2 - ((minY + maxY) / 2) * scale + panY;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.15;

    for (let i = 0; i < n; i++) {
      const sx = xs[i] * scale + offsetX;
      const sy = ys[i] * scale + offsetY;
      ctx.fillRect(sx, sy, 1, 1);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
