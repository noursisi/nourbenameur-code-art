/**
 * Harmonograph — damped dual-pendulum Lissajous figure.
 * x = sin(f1*t + phase) * e^(-damping*t)
 * y = sin(f2*t) * e^(-damping*t)
 */

import { Algorithm } from '../base.js';

export class Harmonograph extends Algorithm {
  constructor(engine) {
    super(engine);
    this._svgPoints = [];
  }

  get metadata() {
    return {
      name: 'Harmonograph',
      eq: 'x=sin(f₁t+φ)·e^(-dt), y=sin(f₂t)·e^(-dt)',
      cat: 'Physics',
      desc: 'Two pendulums swinging at different frequencies create damped Lissajous figures. Near-integer frequency ratios produce slowly drifting quasi-periodic patterns.',
    };
  }

  get params() {
    return [
      { id: 'harm_f1',      label: 'Freq 1',  min: 1,   max: 7,      step: 0.01   },
      { id: 'harm_f2',      label: 'Freq 2',  min: 1,   max: 7,      step: 0.01   },
      { id: 'harm_phase',   label: 'Phase',   min: 0,   max: 3.14,   step: 0.01   },
      { id: 'harm_damping', label: 'Damping', min: 0,   max: 0.01,   step: 0.0002 },
      { id: 'harm_points',  label: 'Points',  min: 5000, max: 200000, step: 5000  },
    ];
  }

  get detailParam() {
    return { id: 'harm_points', min: 5000, max: 200000, step: 10000 };
  }

  get cursorMap() {
    return (mx, my, s) => {
      s.harm_f1 = 1 + mx * 6;
      s.harm_f2 = 1 + my * 6;
    };
  }

  animate(s) {
    s.harm_phase = (s.harm_phase + 0.002) % (Math.PI * 2);
  }

  render(ctx, W, H, s) {
    const f1      = s.harm_f1;
    const f2      = s.harm_f2;
    const phase   = s.harm_phase;
    const damping = s.harm_damping;
    const n       = Math.max(5000, Math.min(200000, Math.round(s.harm_points)));
    const fg      = this.engine.fg(s);
    const camZoom = s.camZoom || 1;
    const panX    = s.camPanX || 0;
    const panY    = s.camPanY || 0;

    const cx   = W / 2 + panX;
    const cy   = H / 2 + panY;
    const radius = Math.min(W, H) * 0.44;
    const dt   = (Math.PI * 2 * 10) / n; // 10 full cycles

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.strokeStyle = fg;
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    this._svgPoints = [];

    for (let i = 0; i <= n; i++) {
      const t   = i * dt;
      const decay = Math.exp(-damping * t);
      const x = cx + Math.sin(f1 * t + phase) * decay * radius;
      const y = cy + Math.sin(f2 * t) * decay * radius;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      if (i % 10 === 0) this._svgPoints.push([x, y]);
    }
    ctx.stroke();

    ctx.restore();
  }

  collectSVG(W, H, s) {
    if (!this._svgPoints.length) return null;
    const fg = this.engine.fg(s);
    const bg = this.engine.bg(s);
    const d = 'M ' + this._svgPoints.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L ');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <polyline points="${this._svgPoints.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="${fg}" stroke-width="0.8"/>
</svg>`;
  }
}
