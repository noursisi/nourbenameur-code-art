/**
 * Golden Spiral — logarithmic spiral r = a * e^(b*theta)
 */

import { Algorithm } from '../base.js';

export class Spiral extends Algorithm {
  constructor(engine) {
    super(engine);
    this._svgPoints = [];
  }

  get metadata() {
    return {
      name: 'Golden Spiral',
      eq: 'r = a · e^(b·θ)',
      cat: 'Physics',
      desc: 'A logarithmic spiral where the distance from the origin grows exponentially with angle. The golden spiral approximates the Fibonacci spiral found in nature.',
    };
  }

  get params() {
    return [
      { id: 'spiral_turns',  label: 'Turns',  min: 3,   max: 50,   step: 1     },
      { id: 'spiral_growth', label: 'Growth', min: 0.02, max: 0.3, step: 0.005 },
      { id: 'spiral_dots',   label: 'Points', min: 200, max: 8000, step: 100   },
    ];
  }

  get detailParam() {
    return { id: 'spiral_dots', min: 200, max: 8000, step: 200 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.spiral_growth = 0.02 + mx * 0.28;
      s.spiral_turns  = Math.round(3 + my * 47);
    };
  }

  animate(s) {
    s.spiral_growth = 0.02 + (Math.sin(s.time * 0.2) * 0.5 + 0.5) * 0.28;
  }

  render(ctx, W, H, s) {
    const turns  = Math.max(3, Math.min(50, Math.round(s.spiral_turns)));
    const growth = Math.max(0.02, s.spiral_growth);
    const n      = Math.max(200, Math.min(8000, Math.round(s.spiral_dots)));
    const fg     = this.engine.fg(s);
    const camZoom = s.camZoom || 1;
    const panX   = s.camPanX || 0;
    const panY   = s.camPanY || 0;

    const cx     = W / 2 + panX;
    const cy     = H / 2 + panY;

    const maxTheta = turns * Math.PI * 2;
    // Scale so outermost point fits canvas
    const maxR   = growth === 0 ? 1 : Math.exp(growth * maxTheta);
    const radius = Math.min(W, H) * 0.44;
    const a      = radius / maxR;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.strokeStyle = fg;
    ctx.lineWidth = Math.max(1.2, s.lineWeight || 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    this._svgPoints = [];

    for (let i = 0; i <= n; i++) {
      const theta = (i / n) * maxTheta;
      const r = a * Math.exp(growth * theta);
      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      this._svgPoints.push([x, y]);
    }
    ctx.stroke();

    ctx.restore();
  }

  collectSVG(W, H, s) {
    if (!this._svgPoints.length) return null;
    const fg = this.engine.fg(s);
    const bg = this.engine.bg(s);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <polyline points="${this._svgPoints.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${fg}" stroke-width="${Math.max(1.2, s.lineWeight || 1)}"/>
</svg>`;
  }
}
