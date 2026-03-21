/**
 * Lissajous Curves
 * x = sin(a*t + delta), y = sin(b*t)
 */

import { Algorithm } from '../base.js';

export class Lissajous extends Algorithm {
  constructor(engine) {
    super(engine);
    this._svgPoints = [];
  }

  get metadata() {
    return {
      name: 'Lissajous Curves',
      eq: 'x=sin(at+δ), y=sin(bt)',
      cat: 'Physics',
      desc: 'The ratio of two oscillation frequencies and their phase difference determines the closed curves named after Jules Antoine Lissajous.',
    };
  }

  get params() {
    return [
      { id: 'liss_a',      label: 'Freq A',  min: 1,   max: 9,     step: 0.1  },
      { id: 'liss_b',      label: 'Freq B',  min: 1,   max: 9,     step: 0.1  },
      { id: 'liss_delta',  label: 'Phase δ', min: 0,   max: 3.14,  step: 0.01 },
      { id: 'liss_points', label: 'Points',  min: 500, max: 30000, step: 100  },
    ];
  }

  get detailParam() {
    return { id: 'liss_points', min: 500, max: 30000, step: 500 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.liss_a = 1 + mx * 8;
      s.liss_b = 1 + my * 8;
    };
  }

  animate(s) {
    s.liss_delta = ((s.liss_delta || 0) + 0.005) % (Math.PI * 2);
  }

  render(ctx, W, H, s) {
    const a     = s.liss_a;
    const b     = s.liss_b;
    const delta = s.liss_delta;
    const n     = Math.max(500, Math.min(30000, Math.round(s.liss_points)));
    const fg    = this.engine.fg();
    const camZoom = s.camZoom || 1;
    const panX  = s.camPanX || 0;
    const panY  = s.camPanY || 0;

    const cx     = W / 2 + panX;
    const cy     = H / 2 + panY;
    const radius = Math.min(W, H) * 0.44;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.strokeStyle = fg;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    this._svgPoints = [];

    const period = Math.PI * 2;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * period;
      const x = cx + Math.sin(a * t + delta) * radius;
      const y = cy + Math.sin(b * t) * radius;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      if (i % 5 === 0) this._svgPoints.push([x, y]);
    }
    ctx.stroke();

    ctx.restore();
  }

  collectSVG(W, H, _s) {
    if (!this._svgPoints.length) return null;
    const fg = this.engine.fg();
    const bg = this.engine.bg();
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <polyline points="${this._svgPoints.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${fg}" stroke-width="1"/>
</svg>`;
  }
}
