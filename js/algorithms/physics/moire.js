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
      { id: 'moire_rotSpeed',    label: 'Speed',       min: 0,   max: 3,   step: 0.1  },
      { id: 'moire_scale',       label: 'Scale',       min: 0.5, max: 3,   step: 0.1  },
      { id: 'moire_contrast',    label: 'Contrast',    min: 0.1, max: 1,   step: 0.05 },
      { id: 'moire_centerX',     label: 'Center X',    min: 0,   max: 1,   step: 0.05 },
      { id: 'moire_centerY',     label: 'Center Y',    min: 0,   max: 1,   step: 0.05 },
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

  animate(world) { const { state: s } = world;
    // Time-based rotation handled in render
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const layers = Math.max(2, Math.min(5, Math.round(s.moire_layers || 3)));
    const lineWidth = Math.max(0.5, Math.min(3, s.moire_lineWidth || 1)) * (s.lineWeight || 1);
    const baseSpacing = Math.max(5, Math.min(30, s.moire_spacing || 12));
    const pattern = Math.max(0, Math.min(3, Math.round(s.moire_pattern || 0)));
    const angleOffset = Math.max(0, Math.min(30, s.moire_angleOffset || 5));
    const rotSpeed = s.moire_rotSpeed !== undefined ? s.moire_rotSpeed : 0.7;
    const scale = s.moire_scale !== undefined ? s.moire_scale : 1.0;
    const contrast = s.moire_contrast !== undefined ? s.moire_contrast : 0.5;
    const centerX = s.moire_centerX !== undefined ? s.moire_centerX : 0.5;
    const centerY = s.moire_centerY !== undefined ? s.moire_centerY : 0.5;
    const spacing = baseSpacing * scale;
    const fg = this.engine.fg(s);
    const t = (s.time || 0) * 0.15;

    const cx = W * centerX;
    const cy = H * centerY;
    const diag = Math.sqrt(W * W + H * H);

    ctx.strokeStyle = fg;
    ctx.fillStyle = fg;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = contrast;

    for (let layer = 0; layer < layers; layer++) {
      const angle = (layer * angleOffset + t * (layer + 1) * rotSpeed) * Math.PI / 180;
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
