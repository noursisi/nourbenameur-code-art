/**
 * Pixel Mosaic — camera color sampled onto geometric blocks.
 * Without camera: uses gradient demo pattern.
 */

import { Algorithm } from '../base.js';

const OVERLAY_TEXTS = [
  'Concept', 'Rational', 'Formal', 'art', 'logic',
  'structure', 'essential', 'thought', 'judgement',
  'rational', 'irrational', 'absolute', 'mind',
];

export class PixelMosaic extends Algorithm {
  get metadata() {
    return {
      name: 'Pixel Mosaic',
      eq: 'color → blocks',
      cat: 'Camera Art',
      desc: 'Camera color sampled onto geometric blocks with text',
    };
  }

  get params() {
    return [
      { id: 'pm_cols', label: 'Columns', min: 5, max: 60, step: 1 },
      { id: 'pm_rows', label: 'Rows', min: 4, max: 45, step: 1 },
      { id: 'pm_gap', label: 'Gap', min: 0, max: 10, step: 1 },
      { id: 'pm_textDensity', label: 'Text Density', min: 0, max: 1, step: 0.05 },
      { id: 'pm_sizeVariation', label: 'Size Variation', min: 0, max: 1, step: 0.05 },
      { id: 'pm_roundness', label: 'Roundness', min: 0, max: 1, step: 0.05 },
    ];
  }

  render(ctx, world) {
    const { W, H, state } = world;
    const cols = state.pm_cols || 20;
    const rows = state.pm_rows || 15;
    const gap = state.pm_gap ?? 2;
    const textDensity = state.pm_textDensity ?? 0.15;
    const sizeVar = state.pm_sizeVariation ?? 0.3;
    const roundness = state.pm_roundness ?? 0;
    const cam = world.camera;
    const hasCamera = cam && cam.active;

    const cellW = W / cols;
    const cellH = H / rows;
    const t = state.time || 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const nx = (col + 0.5) / cols;
        const ny = (row + 0.5) / rows;

        let r, g, b;
        if (hasCamera) {
          const c = cam.color(nx, ny);
          r = c.r; g = c.g; b = c.b;
        } else {
          r = Math.floor(nx * 200 + Math.sin(t + col) * 55);
          g = Math.floor(ny * 150 + Math.cos(t * 0.7 + row) * 55);
          b = Math.floor(150 + Math.sin(t * 1.3 + col + row) * 105);
        }

        const hash = Math.sin(col * 127.1 + row * 311.7) * 0.5 + 0.5;
        const sizeScale = 1 - sizeVar * hash;
        const bw = (cellW - gap) * sizeScale;
        const bh = (cellH - gap) * sizeScale;

        const cx = col * cellW + cellW / 2;
        const cy = row * cellH + cellH / 2;

        ctx.save();
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        if (roundness > 0) {
          const rad = Math.min(roundness * bw * 0.5, bw / 2, bh / 2);
          ctx.beginPath();
          ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, rad);
          ctx.fill();
        } else {
          ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
        }
        ctx.restore();

        if (Math.random() < textDensity) {
          const text = OVERLAY_TEXTS[Math.floor(Math.random() * OVERLAY_TEXTS.length)];
          const fontSize = Math.min(cellW, cellH) * 0.6;
          ctx.save();
          ctx.font = `${fontSize}px monospace`;
          ctx.fillStyle = `rgba(${255 - r},${255 - g},${255 - b},0.7)`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, cx, cy);
          ctx.restore();
        }
      }
    }
  }
}
