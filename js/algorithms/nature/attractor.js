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
    // Dramatic drift across parameter space — creates wildly shifting attractor shapes
    const t = s.time;
    s.att_a = -1.7 + Math.sin(t * 0.11) * 1.5 + Math.cos(t * 0.07) * 0.6;
    s.att_b =  1.3 + Math.cos(t * 0.09) * 1.4 + Math.sin(t * 0.13) * 0.5;
    s.att_c = -0.1 + Math.sin(t * 0.17) * 1.2;
    s.att_d = -1.21 + Math.cos(t * 0.13) * 1.1 + Math.sin(t * 0.19) * 0.4;
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

    // Density-based rendering: accumulate hits into a grid, then draw brightness
    const gridW = Math.ceil(W);
    const gridH = Math.ceil(H);
    const density = new Uint32Array(gridW * gridH);
    let maxDensity = 0;

    for (let i = 0; i < n; i++) {
      let sx = Math.floor(xs[i] * scale + offsetX);
      let sy = Math.floor(ys[i] * scale + offsetY);
      // Apply camera zoom offset
      sx = Math.floor((sx - W/2) * camZoom + W/2);
      sy = Math.floor((sy - H/2) * camZoom + H/2);
      if (sx >= 0 && sx < gridW && sy >= 0 && sy < gridH) {
        const idx = sy * gridW + sx;
        density[idx]++;
        if (density[idx] > maxDensity) maxDensity = density[idx];
      }
    }

    // Render density map
    const imgData = ctx.getImageData(0, 0, W, H);
    const fgR = parseInt(fg.slice(1,3), 16) || 255;
    const fgG = parseInt(fg.slice(3,5), 16) || 255;
    const fgB = parseInt(fg.slice(5,7), 16) || 255;
    const logMax = Math.log(maxDensity + 1);

    for (let y = 0; y < gridH && y < H; y++) {
      for (let x = 0; x < gridW && x < W; x++) {
        const d = density[y * gridW + x];
        if (d === 0) continue;
        // Log-scale brightness for better contrast
        const brightness = Math.log(d + 1) / logMax;
        const idx = (y * W + x) * 4;
        imgData.data[idx]     = Math.min(255, imgData.data[idx] + Math.floor(fgR * brightness));
        imgData.data[idx + 1] = Math.min(255, imgData.data[idx+1] + Math.floor(fgG * brightness));
        imgData.data[idx + 2] = Math.min(255, imgData.data[idx+2] + Math.floor(fgB * brightness));
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    ctx.restore();
  }
}
