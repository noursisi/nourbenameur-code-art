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

    this._svgCircles = [];
    for (let i = 1; i <= n; i++) {
      const r = c * Math.sqrt(i);
      const theta = i * divergence;
      const px = cx + r * Math.cos(theta);
      const py = cy + r * Math.sin(theta);
      ctx.beginPath();
      ctx.arc(px, py, dotSize, 0, Math.PI * 2);
      ctx.fill();
      this._svgCircles.push([px, py, dotSize]);
    }

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
