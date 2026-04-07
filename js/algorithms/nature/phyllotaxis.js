/**
 * Phyllotaxis — sunflower spiral point placement using the golden angle.
 */

import { Algorithm } from '../base.js';

export class Phyllotaxis extends Algorithm {
  constructor(engine) {
    super(engine);
    this._svgCircles = [];
  }

  get metadata() {
    return {
      name: 'Phyllotaxis',
      eq: 'r = c√n, θ = n × 137.508°',
      cat: 'Nature',
      desc: 'Points placed at the golden angle (≈137.508°) produce the spiral patterns seen in sunflower seeds, pine cones, and leaf arrangements.',
    };
  }

  get params() {
    return [
      { id: 'phyllo_n',          label: 'Points',      min: 50,   max: 3000, step: 10   },
      { id: 'phyllo_divergence', label: 'Divergence°', min: 100,  max: 175,  step: 0.01 },
      { id: 'phyllo_dotsize',    label: 'Dot Size',    min: 0.5,  max: 8,    step: 0.5  },
      { id: 'phyllo_sizeVar',    label: 'Size Pulse',  min: 0,    max: 1,    step: 0.05 },
      { id: 'phyllo_breathe',    label: 'Breathe',     min: 0,    max: 1,    step: 0.05 },
    ];
  }

  get detailParam() {
    return { id: 'phyllo_n', min: 50, max: 3000, step: 100 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.phyllo_divergence = 100 + mx * 75;
      s.phyllo_dotsize = 0.5 + my * 7.5;
    };
  }

  animate(world) { const { state: s } = world;
    // Oscillate divergence around the golden angle
    s.phyllo_divergence = 137.508 + Math.sin(s.time * 0.3) * 5;
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const n = Math.max(50, Math.min(3000, Math.round(s.phyllo_n)));
    const divergence = (s.phyllo_divergence * Math.PI) / 180;
    const dotSize = Math.max(0.5, s.phyllo_dotsize);
    const fg = this.engine.fg(s);
    const camZoom = s.camZoom || 1;
    const panX = s.camPanX || 0;
    const panY = s.camPanY || 0;

    const cx = W / 2 + panX;
    const cy = H / 2 + panY;
    // Scale factor so outermost point fits within canvas
    const maxR = Math.min(W, H) * 0.47;
    const c = maxR / Math.sqrt(n);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.fillStyle = fg;
    const sizeVar = s.phyllo_sizeVar ?? 0;
    const breathe = s.phyllo_breathe ?? 0;
    const t = s.time || 0;

    this._svgCircles = [];
    for (let i = 1; i <= n; i++) {
      const frac = i / n; // 0→1 from center to edge
      const r = c * Math.sqrt(i);
      const theta = i * divergence;

      // Breathe: radial oscillation — dots pulse in/out like breathing
      const breatheOffset = breathe > 0 ? (1 + breathe * 0.15 * Math.sin(t * 2 + frac * 12)) : 1;
      const rr = r * breatheOffset;

      const px = cx + rr * Math.cos(theta);
      const py = cy + rr * Math.sin(theta);

      // Size varies: outer dots smaller, with a wave pulsing through
      let ds = dotSize;
      if (sizeVar > 0) {
        const wave = Math.sin(frac * 20 - t * 3) * 0.5 + 0.5; // wave travels outward
        ds = dotSize * (0.3 + 0.7 * (1 - frac * 0.6) + sizeVar * wave * 0.5);
      }

      // Opacity: subtle fade at edges
      const alpha = 0.4 + 0.6 * (1 - frac * 0.5);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px, py, ds, 0, Math.PI * 2);
      ctx.fill();
      this._svgCircles.push([px, py, ds]);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  collectSVG(world) { const { W, H, state: s } = world;
    if (!this._svgCircles.length) return null;
    const fg = this.engine.fg(s);
    const bg = this.engine.bg(s);
    const circles = this._svgCircles
      .map(([cx, cy, r]) => `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r}"/>`)
      .join('\n');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <g fill="${fg}">
${circles}
  </g>
</svg>`;
  }
}
