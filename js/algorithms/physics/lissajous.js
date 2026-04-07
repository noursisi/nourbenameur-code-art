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
      { id: 'liss_a',      label: 'Freq A',   min: 1,   max: 9,     step: 0.1  },
      { id: 'liss_b',      label: 'Freq B',   min: 1,   max: 9,     step: 0.1  },
      { id: 'liss_delta',  label: 'Phase δ',  min: 0,   max: 3.14,  step: 0.01 },
      { id: 'liss_points', label: 'Points',   min: 500, max: 30000, step: 100  },
      { id: 'liss_ampX',   label: 'Amp X',    min: 0.1, max: 2.0,   step: 0.05 },
      { id: 'liss_ampY',   label: 'Amp Y',    min: 0.1, max: 2.0,   step: 0.05 },
      { id: 'liss_echoes',  label: 'Echoes',  min: 0,   max: 12,    step: 1    },
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

  animate(world) { const { state: s } = world;
    s.liss_delta = ((s.liss_delta || 0) + 0.005) % (Math.PI * 2);
  }

  render(ctx, world) { const { W, H, state: s } = world;
    const a     = s.liss_a;
    const b     = s.liss_b;
    const delta = s.liss_delta;
    const n     = Math.max(500, Math.min(30000, Math.round(s.liss_points)));
    const ampX  = Math.max(0.1, s.liss_ampX ?? 1.0);
    const ampY  = Math.max(0.1, s.liss_ampY ?? 1.0);
    const fg    = this.engine.fg(s);
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

    ctx.lineWidth = s.lineWeight || 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const echoes = Math.round(s.liss_echoes ?? 0);
    const period = Math.PI * 2;
    this._svgPoints = [];

    // Draw echo copies first (behind, faded)
    for (let e = echoes; e >= 0; e--) {
      const echoPhase = delta + e * 0.12; // slight phase offset per echo
      const echoScale = 1 - e * 0.03; // slightly smaller
      const alpha = e === 0 ? 1 : Math.max(0.03, 0.3 * (1 - e / (echoes + 1)));

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = fg;
      ctx.beginPath();

      for (let i = 0; i <= n; i++) {
        const t = (i / n) * period;
        const x = cx + Math.sin(a * t + echoPhase) * radius * ampX * echoScale;
        const y = cy + Math.sin(b * t) * radius * ampY * echoScale;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        if (e === 0 && i % 5 === 0) this._svgPoints.push([x, y]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  collectSVG(world) { const { W, H, state: s } = world;
    if (!this._svgPoints.length) return null;
    const fg = this.engine.fg(s);
    const bg = this.engine.bg(s);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <polyline points="${this._svgPoints.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${fg}" stroke-width="${s.lineWeight || 1}"/>
</svg>`;
  }
}
