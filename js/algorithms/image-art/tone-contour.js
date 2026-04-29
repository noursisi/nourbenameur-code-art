/**
 * Tone Contour — topographic-style isolines drawn at evenly-spaced
 * luminance levels of the underlying image. Marching-squares lookup
 * table extracts each iso-line; lines are drawn in palette-mapped colors
 * so the image reads like a contour map.
 */

import { Algorithm } from '../base.js';

const PALETTES = [
  // Mono — single fg color, intensity falls with level
  null,
  // Spectrum — full hue rotation
  (t) => `hsl(${t * 320}, 70%, 60%)`,
  // Sunset — warm gradient
  (t) => `hsl(${20 + t * 40}, 80%, ${45 + t * 20}%)`,
  // Cool — cyan to deep blue
  (t) => `hsl(${180 + t * 80}, 70%, ${40 + t * 30}%)`,
  // Cream — accent palette
  (t) => `rgba(232, 199, 158, ${0.35 + t * 0.6})`,
];

export class ToneContour extends Algorithm {
  constructor(engine) {
    super(engine);
    this._cap = null;
    this._capCtx = null;
  }

  get metadata() {
    return {
      name: 'Tone Contour',
      eq: 'iso-luminance × marching squares',
      cat: 'Image Art',
      desc: 'Topographic isolines along equal-brightness contours of your video. Each level is extracted with marching squares and tinted by palette.',
    };
  }

  get params() {
    return [
      { id: 'tc_levels',     label: 'Levels',    min: 3,   max: 24, step: 1   },
      { id: 'tc_lineWidth',  label: 'Stroke',    min: 0.4, max: 3,  step: 0.1 },
      { id: 'tc_palette',    label: 'Palette',   min: 0,   max: 4,  step: 1   },
      { id: 'tc_resolution', label: 'Detail',    min: 60,  max: 220,step: 10  },
      { id: 'tc_alpha',      label: 'Opacity',   min: 0.2, max: 1,  step: 0.05},
    ];
  }

  get detailParam() { return { id: 'tc_resolution', min: 60, max: 220, step: 10 }; }
  animate() {}

  randomize(state, set) {
    set('tc_levels', Math.round(5 + Math.random() * 14));
    set('tc_lineWidth', parseFloat((0.6 + Math.random() * 1.6).toFixed(1)));
    set('tc_palette', Math.floor(Math.random() * PALETTES.length));
    set('tc_resolution', Math.round(80 + Math.random() * 120));
    set('tc_alpha', parseFloat((0.4 + Math.random() * 0.55).toFixed(2)));
  }

  render(ctx, world) {
    const { W, H, state: s } = world;
    const levels = Math.round(s.tc_levels ?? 9);
    const lineWidth = s.tc_lineWidth ?? 1.0;
    const paletteIdx = Math.round(s.tc_palette ?? 1);
    const sW = Math.round(s.tc_resolution ?? 140);
    const alpha = s.tc_alpha ?? 0.7;
    const fg = s.fgColor || '#ffffff';

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

    const gray = new Float32Array(sW * sH);
    for (let i = 0; i < sW * sH; i++) {
      const j = i * 4;
      gray[i] = (d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114) / 255;
    }

    const cellW = W / (sW - 1);
    const cellH = H / (sH - 1);
    const palette = PALETTES[paletteIdx] ?? PALETTES[1];

    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;

    for (let l = 1; l <= levels; l++) {
      const t = l / (levels + 1); // iso level in (0, 1)
      ctx.strokeStyle = palette ? palette(t) : fg;

      ctx.beginPath();
      for (let y = 0; y < sH - 1; y++) {
        for (let x = 0; x < sW - 1; x++) {
          const tl = gray[y * sW + x];
          const tr = gray[y * sW + x + 1];
          const bl = gray[(y + 1) * sW + x];
          const br = gray[(y + 1) * sW + x + 1];

          // Marching squares mask — corners above iso threshold
          let mask = 0;
          if (tl >= t) mask |= 8;
          if (tr >= t) mask |= 4;
          if (br >= t) mask |= 2;
          if (bl >= t) mask |= 1;
          if (mask === 0 || mask === 15) continue;

          // Linear interp positions on each edge
          const px = x * cellW;
          const py = y * cellH;
          const tParam = (a, b) => {
            const denom = b - a;
            if (Math.abs(denom) < 1e-6) return 0.5;
            return Math.max(0, Math.min(1, (t - a) / denom));
          };
          const top    = { x: px + tParam(tl, tr) * cellW, y: py };
          const right  = { x: px + cellW, y: py + tParam(tr, br) * cellH };
          const bottom = { x: px + tParam(bl, br) * cellW, y: py + cellH };
          const left   = { x: px, y: py + tParam(tl, bl) * cellH };

          const seg = (a, b) => {
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
          };

          // Standard 16-case marching-squares table
          switch (mask) {
            case 1:  case 14: seg(left, bottom); break;
            case 2:  case 13: seg(bottom, right); break;
            case 3:  case 12: seg(left, right); break;
            case 4:  case 11: seg(top, right); break;
            case 5:           seg(left, top); seg(bottom, right); break;
            case 6:  case 9:  seg(top, bottom); break;
            case 7:  case 8:  seg(left, top); break;
            case 10:          seg(left, bottom); seg(top, right); break;
            default: break;
          }
        }
      }
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  collectSVG() { return null; }
}
