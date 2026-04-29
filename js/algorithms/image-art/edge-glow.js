/**
 * Edge Glow — Sobel edge detection painted as soft glowing strokes along
 * the gradient direction. Reads the canvas (image + video are already
 * drawn behind the algorithm) and overlays neon-line geometry that traces
 * subjects in real time.
 */

import { Algorithm } from '../base.js';

export class EdgeGlow extends Algorithm {
  constructor(engine) {
    super(engine);
    this._cap = null;
    this._capCtx = null;
  }

  get metadata() {
    return {
      name: 'Edge Glow',
      eq: '∇I × bloom',
      cat: 'Image Art',
      desc: 'Glowing strokes along the edges of your video. Sobel gradient detection painted as soft neon lines, perpendicular to local intensity gradient.',
    };
  }

  get params() {
    return [
      { id: 'eg_density',   label: 'Density',   min: 0.2,  max: 1.5, step: 0.05 },
      { id: 'eg_threshold', label: 'Threshold', min: 0.05, max: 0.6, step: 0.01 },
      { id: 'eg_glow',      label: 'Glow',      min: 0,    max: 1,   step: 0.05 },
      { id: 'eg_lineWidth', label: 'Stroke',    min: 0.5,  max: 4,   step: 0.1  },
      { id: 'eg_color',     label: 'Color',     min: 0,    max: 1,   step: 1    },
    ];
  }

  get detailParam() { return { id: 'eg_density', min: 0.2, max: 1.5, step: 0.05 }; }
  animate() {}

  randomize(state, set) {
    set('eg_density',   parseFloat((0.5 + Math.random() * 0.8).toFixed(2)));
    set('eg_threshold', parseFloat((0.08 + Math.random() * 0.25).toFixed(2)));
    set('eg_glow',      parseFloat((0.3 + Math.random() * 0.6).toFixed(2)));
    set('eg_lineWidth', parseFloat((0.8 + Math.random() * 2).toFixed(1)));
    set('eg_color',     Math.round(Math.random()));
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const density = s.eg_density ?? 0.7;
    const threshold = s.eg_threshold ?? 0.15;
    const glow = s.eg_glow ?? 0.5;
    const lineWidth = s.eg_lineWidth ?? 1.4;
    const useImageColor = Math.round(s.eg_color ?? 1) === 1;
    const fg = s.fgColor || '#ffffff';

    // Capture the canvas (image already drawn beneath us) into a low-res buffer.
    // Higher density = finer grid = more edges detected.
    const sW = Math.max(40, Math.round(80 * density));
    const sH = Math.max(24, Math.round(sW * H / W));
    if (!this._cap) {
      this._cap = document.createElement('canvas');
      this._capCtx = this._cap.getContext('2d', { willReadFrequently: true });
    }
    if (this._cap.width !== sW || this._cap.height !== sH) {
      this._cap.width = sW;
      this._cap.height = sH;
    }
    this._capCtx.drawImage(ctx.canvas, 0, 0, sW, sH);
    const d = this._capCtx.getImageData(0, 0, sW, sH).data;

    // Greyscale for gradient computation
    const gray = new Float32Array(sW * sH);
    for (let i = 0; i < sW * sH; i++) {
      const j = i * 4;
      gray[i] = (d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114) / 255;
    }

    const cellW = W / sW;
    const cellH = H / sH;

    ctx.save();
    if (glow > 0) {
      ctx.shadowBlur = 12 * glow;
      ctx.shadowColor = useImageColor ? '#ffffff' : fg;
    }
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    if (!useImageColor) ctx.strokeStyle = fg;

    // Sobel kernel — compute gradient at each interior cell, draw a stroke
    // perpendicular to the gradient (the edge direction).
    for (let y = 1; y < sH - 1; y++) {
      for (let x = 1; x < sW - 1; x++) {
        const tl = gray[(y - 1) * sW + (x - 1)];
        const tm = gray[(y - 1) * sW + x];
        const tr = gray[(y - 1) * sW + (x + 1)];
        const ml = gray[y * sW + (x - 1)];
        const mr = gray[y * sW + (x + 1)];
        const bl = gray[(y + 1) * sW + (x - 1)];
        const bm = gray[(y + 1) * sW + x];
        const br = gray[(y + 1) * sW + (x + 1)];
        const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
        const gy = (bl + 2 * bm + br) - (tl + 2 * tm + tr);
        const mag = Math.hypot(gx, gy);
        if (mag < threshold) continue;

        // Stroke direction = perpendicular to gradient
        const px = -gy;
        const py = gx;
        const pmag = Math.hypot(px, py);
        if (pmag < 1e-4) continue;
        const dx = (px / pmag) * cellW * 0.7;
        const dy = (py / pmag) * cellH * 0.7;
        const cx = (x + 0.5) * cellW;
        const cy = (y + 0.5) * cellH;

        if (useImageColor) {
          // Sample the source pixel for stroke color
          const j = (y * sW + x) * 4;
          ctx.strokeStyle = `rgb(${d[j]},${d[j + 1]},${d[j + 2]})`;
        }
        ctx.globalAlpha = Math.min(1, mag * 0.9);
        ctx.beginPath();
        ctx.moveTo(cx - dx, cy - dy);
        ctx.lineTo(cx + dx, cy + dy);
        ctx.stroke();
      }
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  collectSVG() { return null; }
}
