/**
 * Moire Interference — overlapping geometric grids create emergent patterns.
 * Simple superposition of identical patterns at slightly different angles.
 */

import { Algorithm } from '../base.js';

export class Moire extends Algorithm {
  get metadata() {
    return {
      name: 'Moire Interference',
      eq: 'superposition of rotated grids',
      cat: 'Physics',
      desc: 'Overlapping geometric grids at slightly different angles produce dramatic emergent interference patterns. Simple rules, alien structure.',
    };
  }

  get params() {
    return [
      { id: 'moire_layers',      label: 'Layers',      min: 2,   max: 5,   step: 1    },
      { id: 'moire_lineWidth',   label: 'Line Width',  min: 0.5, max: 3,   step: 0.1  },
      { id: 'moire_spacing',     label: 'Spacing',     min: 5,   max: 30,  step: 1    },
      { id: 'moire_pattern',     label: 'Pattern',     min: 0,   max: 3,   step: 1    },
      { id: 'moire_angleOffset', label: 'Angle Offset', min: 0,  max: 30,  step: 0.5  },
    ];
  }

  get detailParam() {
    return { id: 'moire_spacing', min: 5, max: 30, step: 1 };
  }

  get cursorMap() {
    return (mx, _my, s) => {
      s.moire_angleOffset = mx * 30;
    };
  }

  animate(s) {
    // Time-based rotation handled in render
  }

  render(ctx, W, H, s) {
    const layers = Math.max(2, Math.min(5, Math.round(s.moire_layers || 3)));
    const lineWidth = Math.max(0.5, Math.min(3, s.moire_lineWidth || 1));
    const spacing = Math.max(5, Math.min(30, s.moire_spacing || 12));
    const pattern = Math.max(0, Math.min(3, Math.round(s.moire_pattern || 0)));
    const angleOffset = Math.max(0, Math.min(30, s.moire_angleOffset || 5));
    const fg = this.engine.fg();
    const t = (s.time || 0) * 0.15;

    const cx = W / 2;
    const cy = H / 2;
    const diag = Math.sqrt(W * W + H * H);

    ctx.strokeStyle = fg;
    ctx.fillStyle = fg;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.5;

    for (let layer = 0; layer < layers; layer++) {
      const angle = (layer * angleOffset + t * (layer + 1) * 0.7) * Math.PI / 180;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      if (pattern === 0) {
        // Parallel lines
        ctx.beginPath();
        const count = Math.ceil(diag / spacing) + 1;
        for (let i = -count; i <= count; i++) {
          const y = i * spacing;
          ctx.moveTo(-diag, y);
          ctx.lineTo(diag, y);
        }
        ctx.stroke();
      } else if (pattern === 1) {
        // Concentric circles
        ctx.beginPath();
        const maxR = diag;
        for (let r = spacing; r < maxR; r += spacing) {
          ctx.moveTo(r, 0);
          ctx.arc(0, 0, r, 0, Math.PI * 2);
        }
        ctx.stroke();
      } else if (pattern === 2) {
        // Dot grid
        const count = Math.ceil(diag / spacing);
        const dotR = lineWidth * 1.5;
        ctx.beginPath();
        for (let iy = -count; iy <= count; iy++) {
          for (let ix = -count; ix <= count; ix++) {
            const px = ix * spacing;
            const py = iy * spacing;
            ctx.moveTo(px + dotR, py);
            ctx.arc(px, py, dotR, 0, Math.PI * 2);
          }
        }
        ctx.fill();
      } else {
        // Hex grid lines
        ctx.beginPath();
        const count = Math.ceil(diag / spacing) + 1;
        // Three sets of parallel lines at 60 degree intervals
        for (let dir = 0; dir < 3; dir++) {
          const a = dir * Math.PI / 3;
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          for (let i = -count; i <= count; i++) {
            const ox = -sin * i * spacing;
            const oy = cos * i * spacing;
            ctx.moveTo(ox - cos * diag, oy - sin * diag);
            ctx.lineTo(ox + cos * diag, oy + sin * diag);
          }
        }
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }
}
